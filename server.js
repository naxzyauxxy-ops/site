import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const bareServer = createBareServer('/bare/');
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve UV files from node_modules
const uvPath = path.join(__dirname, 'node_modules', '@titaniumnetwork-dev', 'ultraviolet', 'dist');
app.use('/uv', express.static(uvPath));

// Override uv.config.js with correct paths
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

// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));

// Flooder API — runs server-side to bypass CORS/CF
app.post('/api/flood', async (req, res) => {
  const { gameCode, name, mode } = req.body;
  if (!gameCode || !name) return res.status(400).json({ error: 'missing fields' });

  try {
    const apiPath = mode === 'legacy' ? '/c/firebase/join' : '/api/players/join';
    const host = mode === 'legacy' ? 'fb.blooket.com' : 'play.blooket.com';

    const body = mode === 'legacy'
      ? JSON.stringify({ id: gameCode, name })
      : JSON.stringify({ gameCode, name, avatar: Math.floor(Math.random() * 50) + 1 });

    const resp = await fetch(`https://${host}${apiPath}`, {
      method: mode === 'legacy' ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Origin': 'https://play.blooket.com',
        'Referer': 'https://play.blooket.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      body
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (resp.ok || resp.status === 200 || resp.status === 201) {
      res.json({ ok: true, status: resp.status, data });
    } else {
      res.status(resp.status).json({ ok: false, status: resp.status, data });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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
