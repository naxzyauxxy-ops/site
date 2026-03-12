import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';
import { spawn, execSync } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;
const FLOODER_DIR = path.join(__dirname, 'flooder');

app.use(express.json());

// Serve UV files from node_modules
const uvPath = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');
app.use('/uv', express.static(uvPath));

app.get('/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`/*global Ultraviolet*/
self.__uv$config = {
    prefix: '/uv/service/',
    bare: '/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js',
    client: '/uv/uv.client.js',
    bundle: '/uv/uv.bundle.js',
    config: '/uv/uv.config.js',
    sw: '/uv/uv.sw.js',
};`);
});

app.use(express.static(path.join(__dirname, 'public')));

// Active flood processes
const floods = new Map();

app.post('/api/flood/start', async (req, res) => {
  const { gameCode, name, amount, mode } = req.body;
  if (!gameCode) return res.status(400).json({ error: 'missing gameCode' });

  const id = Date.now().toString();

  // Write a config file for the flooder to read
  const cfg = { pin: gameCode, name: name || 'Bot', amount: parseInt(amount) || 10 };

  try {
    // Check bun is available
    execSync('bun --version', { stdio: 'ignore' });
  } catch {
    return res.status(500).json({ error: 'bun not installed on server' });
  }

  const entryFile = mode === 'legacy'
    ? path.join(FLOODER_DIR, 'src', 'legacy', 'index.js')
    : path.join(FLOODER_DIR, 'src', 'beta', 'index.js');

  // We run bun with input piped in to answer the prompts
  const answers = `${gameCode}\n${cfg.name}\n${cfg.amount}\n`;

  const proc = spawn('bun', ['run', entryFile], {
    cwd: FLOODER_DIR,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdin.write(answers);
  proc.stdin.end();

  const logs = [];
  let joined = 0, failed = 0;

  proc.stdout.on('data', d => {
    const text = d.toString().replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!text) return;
    text.split('\n').forEach(line => {
      if (!line.trim()) return;
      logs.push(line);
      if (line.includes('joined')) joined++;
      if (line.includes('failed') || line.includes('faled')) failed++;
    });
  });

  proc.stderr.on('data', d => {
    logs.push('ERR: ' + d.toString().replace(/\x1b\[[0-9;]*m/g, '').trim());
  });

  floods.set(id, { proc, logs, joined, failed, done: false, startTime: Date.now() });

  proc.on('close', () => {
    const f = floods.get(id);
    if (f) f.done = true;
  });

  res.json({ ok: true, id });
});

app.get('/api/flood/status/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });

  // Count from logs
  let joined = 0, failed = 0;
  f.logs.forEach(l => {
    if (l.includes('joined!') || l.match(/\d+ bots joined/)) {
      const m = l.match(/(\d+) bots joined/);
      if (m) joined = parseInt(m[1]);
      else joined++;
    }
    if (l.includes('failed')) failed++;
  });

  res.json({
    done: f.done,
    logs: f.logs.slice(-50),
    joined,
    failed,
    elapsed: Math.floor((Date.now() - f.startTime) / 1000)
  });
});

app.post('/api/flood/stop/:id', (req, res) => {
  const f = floods.get(req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  try { f.proc.kill('SIGTERM'); } catch {}
  f.done = true;
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log('Running on port ' + PORT);
});
