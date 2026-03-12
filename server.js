import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;
const FLOODER_DIR = path.join(__dirname, 'BlooketFlooder');
const BUN = process.env.HOME + '/.bun/bin/bun';

app.use(express.json());

const uvPath = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');
app.use('/uv', express.static(uvPath));
app.get('/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`self.__uv$config={prefix:'/uv/service/',bare:'/bare/',encodeUrl:Ultraviolet.codec.xor.encode,decodeUrl:Ultraviolet.codec.xor.decode,handler:'/uv/uv.handler.js',client:'/uv/uv.client.js',bundle:'/uv/uv.bundle.js',config:'/uv/uv.config.js',sw:'/uv/uv.sw.js'};`);
});
app.use(express.static(path.join(__dirname, 'public')));

const floods = new Map();

app.post('/api/flood/start', async (req, res) => {
  const { gameCode, name, amount, mode } = req.body;
  if (!gameCode) return res.status(400).json({ error: 'missing gameCode' });

  const id = Date.now().toString();
  const entry = mode === 'legacy'
    ? path.join(FLOODER_DIR, 'src', 'legacy', 'index.js')
    : path.join(FLOODER_DIR, 'src', 'beta', 'index.js');

  const proc = spawn(BUN, ['run', entry], {
    cwd: FLOODER_DIR,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Answer the 3 enquirer prompts: pin, name, amount
  setTimeout(() => proc.stdin.write(gameCode + '\n'), 300);
  setTimeout(() => proc.stdin.write((name || 'Bot') + '\n'), 600);
  setTimeout(() => proc.stdin.write(String(amount || 10) + '\n'), 900);

  const logs = [];
  proc.stdout.on('data', d => {
    d.toString().replace(/\x1b\[[0-9;]*m/g, '').split('\n').forEach(l => {
      if (l.trim()) logs.push(l.trim());
    });
  });
  proc.stderr.on('data', d => {
    d.toString().replace(/\x1b\[[0-9;]*m/g, '').split('\n').forEach(l => {
      if (l.trim()) logs.push('ERR: ' + l.trim());
    });
  });

  floods.set(id, { proc, logs, done: false, start: Date.now() });
  proc.on('close', () => { const f = floods.get(id); if (f) f.done = true; });

  res.json({ ok: true, id });
});

app.get('/api/flood/status/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  let joined = 0, failed = 0;
  f.logs.forEach(l => {
    const m = l.match(/(\d+) bots joined/); if (m) joined = +m[1];
    if (l.includes('failed to join')) { const m2 = l.match(/(\d+) bots failed/); if (m2) failed = +m2[1]; }
  });
  res.json({ done: f.done, logs: f.logs.slice(-60), joined, failed, elapsed: Math.floor((Date.now() - f.start) / 1000) });
});

app.post('/api/flood/stop/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  try { f.proc.kill('SIGTERM'); } catch {}
  f.done = true;
  res.json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) bareServer.routeRequest(req, res);
  else app(req, res);
});
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) bareServer.routeUpgrade(req, socket, head);
  else socket.destroy();
});
server.listen(PORT, () => console.log('Running on port ' + PORT));
