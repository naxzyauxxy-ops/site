import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;
const uvDist = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');

// ── Find bun ───────────────────────────────────────────────
let BUN = (process.env.HOME || '/home/render') + '/.bun/bin/bun';
if (!existsSync(BUN)) { try { BUN = execSync('which bun').toString().trim(); } catch {} }
if (!existsSync(BUN)) BUN = '/root/.bun/bin/bun';
console.log('BUN:', BUN, '| exists:', existsSync(BUN));

// ── Bootstrap BlooketFlooder ───────────────────────────────
const FLOODER = path.join(__dirname, 'BlooketFlooder');
if (!existsSync(FLOODER)) {
  console.log('Cloning BlooketFlooder...');
  try {
    execSync('git clone https://github.com/VillainsRule/BlooketFlooder ' + FLOODER, { stdio: 'inherit' });
    execSync(BUN + ' i', { cwd: FLOODER, stdio: 'inherit' });
    console.log('BlooketFlooder ready');
  } catch (e) { console.error('Clone failed:', e.message); }
} else {
  console.log('BlooketFlooder present');
}

// ── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  const ae = req.headers['accept-encoding'] || '';
  if (!ae.includes('gzip')) return next();
  const _send = res.send.bind(res);
  res.send = function (body) {
    if (!body || res.headersSent) return _send(body);
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    if (buf.length < 1024) return _send(body);
    res.setHeader('Content-Encoding', 'gzip');
    res.removeHeader('Content-Length');
    zlib.gzip(buf, (err, gz) => { if (err) return _send(body); _send(gz); });
  };
  next();
});

// ── Flood state ────────────────────────────────────────────
const floods = new Map();
let activeFloods = 0;
const MAX = 200;

setInterval(() => {
  const cut = Date.now() - 5 * 60 * 1000;
  for (const [id, f] of floods) if (f.done && f.start < cut) floods.delete(id);
}, 60000);

// ── Flood API ──────────────────────────────────────────────
app.post('/api/flood/start', (req, res) => {
  const { gameCode, name, amount, mode } = req.body;
  if (!gameCode) return res.json({ ok: false, error: 'missing gameCode' });
  if (activeFloods >= MAX) return res.json({ ok: false, error: 'Server busy' });

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const wrapper = mode === 'legacy'
    ? path.join(__dirname, 'run-legacy.mjs')
    : path.join(__dirname, 'run-beta.mjs');

  console.log(`[flood] ${BUN} run ${wrapper} PIN=${gameCode} AMT=${amount}`);

  const proc = spawn(BUN, ['run', wrapper], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '0', PIN: gameCode, NAME: name || 'Bot', AMOUNT: String(Math.min(parseInt(amount) || 10, 500)) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const state = { proc, logs: [], done: false, start: Date.now(), joined: 0, failed: 0 };
  floods.set(id, state);
  activeFloods++;

  const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '').trim();
  proc.stdout.on('data', d => d.toString().split('\n').forEach(l => {
    l = strip(l); if (!l || state.logs.length >= 500) return;
    state.logs.push(l);
    const mj = l.match(/(\d+) bots? joined/i); if (mj) state.joined = +mj[1];
    const mf = l.match(/(\d+) bots? failed/i); if (mf) state.failed = +mf[1];
  }));
  proc.stderr.on('data', d => d.toString().split('\n').forEach(l => {
    l = strip(l); if (l && state.logs.length < 500) state.logs.push('ERR: ' + l);
  }));
  proc.on('error', err => { state.done = true; state.logs.push('Spawn error: ' + err.message); activeFloods = Math.max(0, activeFloods - 1); });
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

// ── UV ─────────────────────────────────────────────────────
app.get('/uv/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`importScripts('/uv/uv.bundle.js');importScripts('/uv/uv.config.js');importScripts('/uv/uv.sw.js');const sw=new UVServiceWorker();self.addEventListener('fetch',e=>e.respondWith(sw.fetch(e)));`);
});

app.get('/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`(function(){const e=typeof Ultraviolet!=='undefined'?Ultraviolet.codec.xor.encode:s=>encodeURIComponent(s);const d=typeof Ultraviolet!=='undefined'?Ultraviolet.codec.xor.decode:s=>decodeURIComponent(s);const c={prefix:'/uv/service/',bare:'/bare/',encodeUrl:e,decodeUrl:d,handler:'/uv/uv.handler.js',client:'/uv/uv.client.js',bundle:'/uv/uv.bundle.js',config:'/uv/uv.config.js',sw:'/uv/uv.sw.js'};if(typeof self!=='undefined')self.__uv$config=c;if(typeof window!=='undefined')window.__uv$config=c;})();`);
});

app.use('/uv', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=86400'); next(); }, express.static(uvDist));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '10m', etag: true }));
app.get('*', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ── Server ─────────────────────────────────────────────────
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
server.listen(PORT, () => console.log('Blooket Hub listening on ' + PORT + ' | max floods: ' + MAX));
