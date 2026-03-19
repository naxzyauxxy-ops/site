import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@nebula-services/bare-server-node';
import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer('/ca/');
const PORT = process.env.PORT || 3000;

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

const BUILD_ID = Date.now().toString(36); // unique per server boot
app.get('/api/health', (req, res) => res.json({ ok: true, floods: activeFloods, uptime: process.uptime() | 0, build: BUILD_ID }));

// ── Auth / session API ─────────────────────────────────────

const OWNER    = 'naxzyauxxy';
const USERS_FILE = './users.json';

// Load users from disk, fallback to defaults
function loadUsers() {
  try {
    if (existsSync(USERS_FILE)) {
      return JSON.parse(readFileSync(USERS_FILE, 'utf8'));
    }
  } catch(e) { console.error('Failed to load users.json:', e.message); }
  // Defaults — only used on first ever boot
  return {
    users: { 'naxzyauxxy': 'Gmoder23' },
    admins: ['naxzyauxxy'],
    noLimit: ['naxzyauxxy'],
    disabled: []
  };
}

function saveUsers() {
  try {
    writeFileSync(USERS_FILE, JSON.stringify({
      users: USERS,
      admins: [...ADMINS],
      noLimit: [...NO_LIMIT],
      disabled: [...DISABLED]
    }, null, 2));
  } catch(e) { console.error('Failed to save users.json:', e.message); }
}

const data     = loadUsers();
const USERS    = data.users;
const ADMINS   = new Set(data.admins);
const NO_LIMIT = new Set(data.noLimit);
const DISABLED = new Set(data.disabled);

// ── IP tracking & auto-ban ─────────────────────────────────
const IP_FILE = './ips.json';
const USER_IPS = new Map(); // username -> Set of IPs seen

function loadIPs() {
  try {
    if (existsSync(IP_FILE)) {
      const d = JSON.parse(readFileSync(IP_FILE, 'utf8'));
      for (const [u, ips] of Object.entries(d)) USER_IPS.set(u, new Set(ips));
    }
  } catch(e) {}
}

function saveIPs() {
  try {
    const out = {};
    for (const [u, ips] of USER_IPS.entries()) out[u] = [...ips];
    writeFileSync(IP_FILE, JSON.stringify(out, null, 2));
  } catch(e) {}
}

function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

loadIPs();

const SESSIONS_FILE = './sessions.json';

// Load sessions from disk
function loadSessions() {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const d = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
      return { sessions: new Map(d.sessions||[]), userSession: new Map(d.userSession||[]) };
    }
  } catch(e) {}
  return { sessions: new Map(), userSession: new Map() };
}

function saveSessions() {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify({
      sessions: [...sessions.entries()],
      userSession: [...userSession.entries()]
    }));
  } catch(e) {}
}

const { sessions, userSession } = loadSessions();

function makeToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);

}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'missing fields' });
  const u = username.trim().toLowerCase();
  if (!USERS[u] || USERS[u] !== password) return res.json({ ok: false, error: 'invalid credentials' });
  if (DISABLED.has(u)) return res.json({ ok: false, error: 'Your account has been disabled for violating the Terms of Service (account sharing). To regain access, pay the $30 reactivation fee via CashApp $skylerondat.' });
  // Track IP and auto-disable on multiple IPs (skip for owner/no-limit accounts)
  if (u !== OWNER && !NO_LIMIT.has(u)) {
    const ip = getIP(req);
    if (!USER_IPS.has(u)) USER_IPS.set(u, new Set());
    const ips = USER_IPS.get(u);
    ips.add(ip);
    saveIPs();
    // More than 1 unique IP = sharing detected → auto-disable
    if (ips.size > 1) {
      DISABLED.add(u);
      const tok = userSession.get(u);
      if (tok) { sessions.delete(tok); userSession.delete(u); saveSessions(); }
      saveUsers();
      console.log(\`[AUTO-BAN] \${u} disabled — \${ips.size} IPs detected: \${[...ips].join(', ')}\`);
      return res.json({ ok: false, error: 'Your account has been disabled for violating the Terms of Service (account sharing). To regain access, pay the $30 reactivation fee via CashApp $skylerondat.' });
    }
  }
  if (!NO_LIMIT.has(u)) {
    const oldToken = userSession.get(u);
    if (oldToken) sessions.delete(oldToken);
  }
  const token = makeToken();
  sessions.set(token, u);
  userSession.set(u, token);
  saveSessions();
  res.json({ ok: true, token, isAdmin: ADMINS.has(u) });
});

app.post('/api/auth/check', (req, res) => {
  const { token } = req.body || {};
  if (!token || !sessions.has(token)) return res.json({ ok: false });
  const u = sessions.get(token);
  res.json({ ok: true, isAdmin: ADMINS.has(u) });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body || {};
  if (token && sessions.has(token)) {
    const u = sessions.get(token);
    sessions.delete(token);
    if (userSession.get(u) === token) userSession.delete(u);
    saveSessions();
  }
  res.json({ ok: true });
});

// ── Admin API ───────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-auth-token'] || (req.body && req.body.token);
  if (!token || !sessions.has(token)) return res.json({ ok: false, error: 'not authenticated' });
  const u = sessions.get(token);
  if (!ADMINS.has(u)) return res.json({ ok: false, error: 'not authorized' });
  req.adminUser = u;
  next();
}

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const list = Object.keys(USERS).map(u => ({
    username: u,
    isAdmin: ADMINS.has(u),
    noLimit: NO_LIMIT.has(u),
    online: userSession.has(u),
    disabled: DISABLED.has(u),
    ipCount: (USER_IPS.get(u) || new Set()).size,
    ips: [...(USER_IPS.get(u) || [])],
  }));
  res.json({ ok: true, users: list });
});

app.post('/api/admin/users/create', requireAdmin, (req, res) => {
  const { username, password, noLimit } = req.body || {};
  if (!username || !password) return res.json({ ok: false, error: 'username and password required' });
  const u = username.trim().toLowerCase();
  if (USERS[u]) return res.json({ ok: false, error: 'username already exists' });
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return res.json({ ok: false, error: '3-20 chars, letters/numbers/underscore only' });
  USERS[u] = password;
  if (noLimit) NO_LIMIT.add(u);
  saveUsers();
  res.json({ ok: true });
});

app.post('/api/admin/users/delete', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  if (u === OWNER) return res.json({ ok: false, error: 'cannot modify the owner account' });
  if (ADMINS.has(u) && req.adminUser !== OWNER) return res.json({ ok: false, error: 'only the owner can modify admin accounts' });
  if (!USERS[u]) return res.json({ ok: false, error: 'user not found' });
  const tok = userSession.get(u);
  if (tok) sessions.delete(tok);
  userSession.delete(u);
  delete USERS[u];
  NO_LIMIT.delete(u);
  ADMINS.delete(u);
  DISABLED.delete(u);
  saveUsers();
  res.json({ ok: true });
});

app.post('/api/admin/users/password', requireAdmin, (req, res) => {
  const { username, password } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  if (!USERS[u]) return res.json({ ok: false, error: 'user not found' });
  if (!password || password.length < 4) return res.json({ ok: false, error: 'password too short' });
  USERS[u] = password;
  const tok = userSession.get(u);
  if (tok) { sessions.delete(tok); userSession.delete(u); }
  saveUsers();
  res.json({ ok: true });
});

app.post('/api/admin/users/kick', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  const tok = userSession.get(u);
  if (tok) { sessions.delete(tok); userSession.delete(u); }
  res.json({ ok: true });
});

// Promote to admin
app.post('/api/admin/users/promote', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  if (!USERS[u]) return res.json({ ok: false, error: 'user not found' });
  ADMINS.add(u);
  NO_LIMIT.add(u);
  saveUsers();
  res.json({ ok: true });
});

// Demote from admin (cannot touch OWNER)
app.post('/api/admin/users/demote', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  if (u === OWNER) return res.json({ ok: false, error: 'cannot demote the owner' });
  ADMINS.delete(u);
  // Kick their session so their next checkSession returns isAdmin: false
  const tok = userSession.get(u);
  if (tok) { sessions.delete(tok); userSession.delete(u); saveSessions(); }
  saveUsers();
  res.json({ ok: true });
});

app.post('/api/admin/users/disable', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  if (u === OWNER) return res.json({ ok: false, error: 'cannot modify the owner account' });
  if (ADMINS.has(u) && req.adminUser !== OWNER) return res.json({ ok: false, error: 'only the owner can modify admin accounts' });
  if (!USERS[u]) return res.json({ ok: false, error: 'user not found' });
  DISABLED.add(u);
  saveUsers();
  // Kick their session immediately
  const tok = userSession.get(u);
  if (tok) { sessions.delete(tok); userSession.delete(u); }
  res.json({ ok: true });
});

app.post('/api/admin/users/enable', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const u = (username || '').trim().toLowerCase();
  DISABLED.delete(u);
  // Clear IP history so they get a fresh start
  USER_IPS.delete(u);
  saveUsers();
  saveIPs();
  res.json({ ok: true });
});

// ── Static files (includes pre-built UV assets in public/) ──
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));

// ── Announcements ───────────────────────────────────────────
let announcement = null; // { text, type }

app.get('/api/announcement', (req, res) => {
  res.json(announcement || {});
});

app.post('/api/admin/announcement', requireAdmin, (req, res) => {
  const { text, type } = req.body || {};
  if (!text) return res.json({ ok: false, error: 'text required' });
  announcement = { text: String(text).slice(0, 300), type: type || 'info' };
  res.json({ ok: true });
});

app.post('/api/admin/announcement/clear', requireAdmin, (req, res) => {
  announcement = null;
  res.json({ ok: true });
});

// SW needs special headers
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});
// ── Game player - no login required, just serves the game ──
app.get('/play', (req, res) => {
  const src = req.query.src || '';
  if (!src) return res.status(400).send('missing src');
  res.setHeader('Cache-Control', 'no-cache');
  const ann = announcement ? JSON.stringify(announcement) : 'null';
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game</title><style>*{margin:0;padding:0}html,body{width:100%;height:100%;background:#000;overflow:hidden}iframe{width:100%;height:100%;border:none}#ann{display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px)}#ann-box{width:min(560px,90vw);padding:40px;border-radius:14px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px}#ann-text{font-family:system-ui,sans-serif;font-size:clamp(1.1rem,3vw,1.6rem);font-weight:900;line-height:1.3}#ann-btn{margin-top:8px;padding:10px 32px;border-radius:6px;border:none;font-family:system-ui,sans-serif;font-size:0.65rem;font-weight:700;letter-spacing:0.1em;cursor:pointer;background:#fff;color:#000}</style></head><body><iframe src="${src.replace(/"/g,'&quot;')}" allowfullscreen></iframe><div id="ann"><div id="ann-box"><div id="ann-icon" style="font-size:2.5rem"></div><div id="ann-text"></div><button id="ann-btn" onclick="document.getElementById('ann').style.display='none'">DISMISS</button></div></div><script>var A=${ann};if(A&&A.text){var icons={info:'📢',warn:'⚠️',error:'🚨',success:'✅'};var colors={info:{bg:'#0d1b2a',border:'#1565c0',text:'#64b5f6'},warn:{bg:'#1a1200',border:'#ff9800',text:'#ffb74d'},error:{bg:'#1a0000',border:'#ff3c5a',text:'#ff6b6b'},success:{bg:'#001a08',border:'#4caf50',text:'#81c784'}};var c=colors[A.type]||colors.info;var box=document.getElementById('ann-box');box.style.background=c.bg;box.style.border='1px solid '+c.border;document.getElementById('ann-icon').textContent=icons[A.type]||icons.info;var t=document.getElementById('ann-text');t.style.color=c.text;t.textContent=A.text;document.getElementById('ann').style.display='flex';}</script></body></html>`);
});

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
