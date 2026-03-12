import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';
import { spawn } from 'child_process';
import { createServer as createNetServer } from 'net';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;
const BUN = process.env.HOME + '/.bun/bin/bun';
const uvDist = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');

// ── Performance: compression + optimized JSON parsing ──────
app.use(compression());
app.use(express.json({ limit: '10kb' }));

// ── Flood state ────────────────────────────────────────────
const floods = new Map();
const MAX_CONCURRENT_FLOODS = 200; // per-server cap
let activeFloods = 0;

// Cleanup finished floods older than 5 min to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, f] of floods) {
    if (f.done && f.start < cutoff) floods.delete(id);
  }
}, 60_000);

// ── Flood API ──────────────────────────────────────────────
app.post('/api/flood/start', (req, res) => {
  const { gameCode, name, amount, mode } = req.body;
  if (!gameCode) return res.json({ ok: false, error: 'missing gameCode' });

  if (activeFloods >= MAX_CONCURRENT_FLOODS) {
    return res.json({ ok: false, error: 'Server busy — try again in a moment' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const wrapper = mode === 'legacy'
    ? path.join(__dirname, 'run-legacy.mjs')
    : path.join(__dirname, 'run-beta.mjs');

  const proc = spawn(BUN, ['run', wrapper], {
    cwd: __dirname,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      PIN: gameCode,
      NAME: name || 'Bot',
      AMOUNT: String(Math.min(parseInt(amount) || 10, 500)) // cap per-session
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const state = { proc, logs: [], done: false, start: Date.now(), joined: 0, failed: 0 };
  floods.set(id, state);
  activeFloods++;

  const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '').trim();

  proc.stdout.on('data', d => {
    d.toString().split('\n').forEach(line => {
      const l = stripAnsi(line);
      if (!l) return;
      if (state.logs.length < 500) state.logs.push(l);
      // parse counts inline so status endpoint is O(1)
      const mj = l.match(/(\d+) bots? joined/i); if (mj) state.joined = +mj[1];
      const mf = l.match(/(\d+) bots? failed/i); if (mf) state.failed = +mf[1];
    });
  });

  proc.stderr.on('data', d => {
    d.toString().split('\n').forEach(line => {
      const l = stripAnsi(line);
      if (l && state.logs.length < 500) state.logs.push('ERR: ' + l);
    });
  });

  proc.on('close', code => {
    state.done = true;
    state.logs.push(`Done (exit ${code})`);
    activeFloods = Math.max(0, activeFloods - 1);
    // Auto-kill after 10 min
    setTimeout(() => floods.delete(id), 10 * 60 * 1000);
  });

  // Safety: kill runaway floods after 8 min
  setTimeout(() => {
    if (!state.done) { try { proc.kill('SIGTERM'); } catch {} }
  }, 8 * 60 * 1000);

  res.json({ ok: true, id });
});

app.get('/api/flood/status/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.json({ error: 'not found' });
  res.json({
    done: f.done,
    logs: f.logs.slice(-80),
    joined: f.joined,
    failed: f.failed,
    elapsed: Math.floor((Date.now() - f.start) / 1000)
  });
});

app.post('/api/flood/stop/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.json({ ok: false });
  try { f.proc.kill('SIGTERM'); } catch {}
  f.done = true;
  activeFloods = Math.max(0, activeFloods - 1);
  res.json({ ok: true });
});

// ── Health check (for uptime monitors) ─────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, floods: activeFloods, uptime: process.uptime() | 0 });
});

// ── UV Service Worker ──────────────────────────────────────
app.get('/uv/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(`importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts('/uv/uv.sw.js');
const sw = new UVServiceWorker();
self.addEventListener('fetch', event => event.respondWith(sw.fetch(event)));`);
});

// ── UV Config ──────────────────────────────────────────────
app.get('/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(`(function(){
  const enc = typeof Ultraviolet !== 'undefined'
    ? Ultraviolet.codec.xor.encode
    : (str) => encodeURIComponent(str);
  const dec = typeof Ultraviolet !== 'undefined'
    ? Ultraviolet.codec.xor.decode
    : (str) => decodeURIComponent(str);
  const cfg = {
    prefix: '/uv/service/',
    bare: '/bare/',
    encodeUrl: enc,
    decodeUrl: dec,
    handler: '/uv/uv.handler.js',
    client: '/uv/uv.client.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js'
  };
  if (typeof self !== 'undefined') self.__uv\$config = cfg;
  if (typeof window !== 'undefined') window.__uv\$config = cfg;
})();`);
});

// ── UV static files (cache aggressively — these never change) ──
app.use('/uv', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  next();
}, express.static(uvDist));

// ── Static files (aggressive caching for assets) ───────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '10m',
  etag: true,
  lastModified: true
}));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── HTTP server with Bare ──────────────────────────────────
const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) return bareServer.routeRequest(req, res);
  app(req, res);
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) bareServer.routeUpgrade(req, socket, head);
  else socket.destroy();
});

// Tune for high concurrency
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.maxConnections = 2000;

server.listen(PORT, () => console.log(`Blooket Hub listening on ${PORT} | max floods: ${MAX_CONCURRENT_FLOODS}`));
