import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@nebula-services/bare-server-node';
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer('/ca/');
const PORT = process.env.PORT || 3000;

// Interstellar UV assets
const uvDist = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');
const histDist = path.join(__dirname, 'node_modules', '@mercuryworkshop', 'bare-mux', 'dist');

// Find bun
let BUN = (process.env.HOME || '/home/render') + '/.bun/bin/bun';
if (!existsSync(BUN)) { try { BUN = execSync('which bun').toString().trim(); } catch {} }
if (!existsSync(BUN)) BUN = '/root/.bun/bin/bun';
console.log('BUN:', BUN);

// Bootstrap BlooketFlooder
const FLOODER = path.join(__dirname, 'BlooketFlooder');
if (!existsSync(FLOODER)) {
  try {
    execSync('git clone https://github.com/VillainsRule/BlooketFlooder ' + FLOODER, { stdio: 'inherit' });
    execSync(BUN + ' i', { cwd: FLOODER, stdio: 'inherit' });
  } catch (e) { console.error('Clone failed:', e.message); }
}

app.use(express.json({ limit: '10kb' }));

// ── Flood API ──────────────────────────────────────────────
const floods = new Map();
let activeFloods = 0;
const MAX = 200;

setInterval(() => {
  const cut = Date.now() - 5 * 60 * 1000;
  for (const [id, f] of floods) if (f.done && f.start < cut) floods.delete(id);
}, 60000);

app.post('/api/flood/start', (req, res) => {
  const { gameCode, name, amount, mode } = req.body;
  if (!gameCode) return res.json({ ok: false, error: 'missing gameCode' });
  if (activeFloods >= MAX) return res.json({ ok: false, error: 'Server busy' });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const wrapper = mode === 'legacy' ? path.join(__dirname, 'run-legacy.mjs') : path.join(__dirname, 'run-beta.mjs');
  const proc = spawn(BUN, ['run', wrapper], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '0', PIN: gameCode, NAME: name || 'Bot', AMOUNT: String(Math.min(parseInt(amount) || 10, 500)) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const state = { proc, logs: [], done: false, start: Date.now(), joined: 0, failed: 0 };
  floods.set(id, state); activeFloods++;
  const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '').trim();
  proc.stdout.on('data', d => d.toString().split('\n').forEach(l => {
    l = strip(l); if (!l || state.logs.length >= 500) return;
    state.logs.push(l);
    const mj = l.match(/(\d+) bots? joined/i); if (mj) state.joined = +mj[1];
    const mf = l.match(/(\d+) bots? failed/i); if (mf) state.failed = +mf[1];
  }));
  proc.stderr.on('data', d => d.toString().split('\n').forEach(l => { l = strip(l); if (l && state.logs.length < 500) state.logs.push('ERR: ' + l); }));
  proc.on('close', code => { state.done = true; state.logs.push('Done (exit ' + code + ')'); activeFloods = Math.max(0, activeFloods - 1); setTimeout(() => floods.delete(id), 10 * 60 * 1000); });
  setTimeout(() => { if (!state.done) try { proc.kill('SIGTERM'); } catch {} }, 8 * 60 * 1000);
  res.json({ ok: true, id });
});

app.get('/api/flood/status/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.json({ error: 'not found' });
  res.json({ done: f.done, logs: f.logs.slice(-80), joined: f.joined, failed: f.failed, elapsed: Math.floor((Date.now() - f.start) / 1000) });
});

app.post('/api/flood/stop/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.json({ ok: false });
  try { f.proc.kill('SIGTERM'); } catch {}
  f.done = true; activeFloods = Math.max(0, activeFloods - 1);
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, floods: activeFloods, uptime: process.uptime() | 0 }));

// ── Interstellar UV Proxy ──────────────────────────────────
// SW - uses Interstellar's sw.js pattern
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(`importScripts('/assets/mathematics/bundle.js');
importScripts('/assets/mathematics/config.js');
importScripts('/assets/mathematics/sw.js');
const uv = new UVServiceWorker();
self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    if (event.request.url.startsWith(location.origin + '/a/')) {
      return await uv.fetch(event);
    }
    return await fetch(event.request);
  })());
});`);
});

// UV config - Interstellar style prefix /a/
app.get('/assets/mathematics/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(`self.__uv$config = {
  prefix: "/a/",
  bare: "/ca/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/assets/mathematics/handler.js",
  bundle: "/assets/mathematics/bundle.js",
  config: "/assets/mathematics/config.js",
  sw: "/assets/mathematics/sw.js",
};`);
});

// Serve UV bundle and sw from @titaniumnetwork-dev/ultraviolet
app.get('/assets/mathematics/bundle.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(uvDist, 'uv.bundle.js'));
});
app.get('/assets/mathematics/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(uvDist, 'uv.sw.js'));
});
app.get('/assets/mathematics/handler.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(uvDist, 'uv.handler.js'));
});

// Legacy /uv/ paths still work too
app.get('/uv/sw.js', (req, res) => res.redirect('/sw.js'));
app.use('/uv', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=86400'); next(); }, express.static(uvDist));

// Static
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m', etag: true }));
app.get('*', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ── HTTP + Bare ────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) return bareServer.routeRequest(req, res);
  app(req, res);
});
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) bareServer.routeUpgrade(req, socket, head);
  else socket.destroy();
});
server.keepAliveTimeout = 65000;
server.maxConnections = 2000;
server.listen(PORT, () => console.log('Void Hub listening on ' + PORT));
