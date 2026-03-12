import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;
const BUN = process.env.HOME + '/.bun/bin/bun';
const uvDist = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');

app.use(express.json());

// ── Flood API ──────────────────────────────────────────────
const floods = new Map();

app.post('/api/flood/start', async (req, res) => {
  const { gameCode, name, amount, mode } = req.body;
  if (!gameCode) return res.json({ ok: false, error: 'missing gameCode' });
  const id = Date.now().toString();
  const wrapper = mode === 'legacy'
    ? path.join(__dirname, 'run-legacy.mjs')
    : path.join(__dirname, 'run-beta.mjs');
  const proc = spawn(BUN, ['run', wrapper], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '0', PIN: gameCode, NAME: name || 'Bot', AMOUNT: String(amount || 10) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  proc.stdout.on('data', d => d.toString().replace(/\x1b\[[0-9;]*m/g,'').split('\n').forEach(l => { if(l.trim()) logs.push(l.trim()); }));
  proc.stderr.on('data', d => d.toString().replace(/\x1b\[[0-9;]*m/g,'').split('\n').forEach(l => { if(l.trim()) logs.push('ERR: '+l.trim()); }));
  floods.set(id, { proc, logs, done: false, start: Date.now() });
  proc.on('close', code => { const f=floods.get(id); if(f){f.done=true;f.logs.push(`Process exited (${code})`);} });
  res.json({ ok: true, id });
});

app.get('/api/flood/status/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.json({ error: 'not found' });
  let joined=0, failed=0;
  f.logs.forEach(l => {
    const m=l.match(/(\d+) bots joined/); if(m) joined=+m[1];
    const m2=l.match(/(\d+) bots failed/); if(m2) failed=+m2[1];
  });
  res.json({ done: f.done, logs: f.logs.slice(-60), joined, failed, elapsed: Math.floor((Date.now()-f.start)/1000) });
});

app.post('/api/flood/stop/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.json({ ok: false });
  try { f.proc.kill('SIGTERM'); } catch {}
  f.done = true;
  res.json({ ok: true });
});

// ── UV Service Worker (absolute paths, correct headers) ────
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

// ── UV Config (works in both SW and page context) ──────────
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
  if (typeof self !== 'undefined') self.__uv$config = cfg;
  if (typeof window !== 'undefined') window.__uv$config = cfg;
})();`);
});

// ── UV static files ────────────────────────────────────────
app.use('/uv', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache');
  next();
}, express.static(uvDist));

// ── Static + fallback ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── HTTP server with Bare ──────────────────────────────────
const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) bareServer.routeRequest(req, res);
  else app(req, res);
});
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) bareServer.routeUpgrade(req, socket, head);
  else socket.destroy();
});
server.listen(PORT, () => console.log('Listening on port ' + PORT));
