// Gimkit Bot Flooder
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const axios = require('axios');
const { WebSocket } = require('ws');

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 30);

if (!pin) { process.exit(1); }
console.log(amount + ' bots → ' + pin);

const K = "Gimkit Web ⁤‍‍⁡‌‍⁢‌⁢⁡⁢‍⁢‍⁤‍‌‌‌‍‍⁡⁢‍‍⁢⁣‍‌⁢⁡‌‌‍‍‍⁡‌‌⁢⁡‌⁢⁣‍⁢‌⁢⁡⁢‌⁡‌⁡‌⁢‍‍‍⁡‍⁣‌‍‌‍‌‍‍‍⁡‍‌‍‍‍⁢⁡‌‌⁤‌⁢‌‍⁣⁣⁤‍⁡‌⁢‌‍⁢⁡⁤⁡‌‍⁡⁢‌‍⁤⁡⁢‌‌⁡‌⁢‌⁢‌‌‌⁣‌‌‍⁤⁡‍⁡⁤‌⁡‍⁡‌⁡⁢⁣⁤⁤‌‌‌‌⁡‌‍⁣‌⁡‌‍⁢‍‌⁢‌⁡⁢⁡‍⁢⁡‍⁡‌⁡‍⁢‍‌‍‍‍⁡‌‍‌⁡‍⁤‌⁢‍‌‌⁡‌⁡‍‌⁡‍⁢‍‍⁣⁢‍‌‍⁡‍⁢⁡‌⁣⁢‌‍‌‍⁢⁡‍⁡⁢‌‍⁢‍‍⁤‌‍‌⁢‌‌‍‌‍‌‍⁡‍⁡‍⁡‍‍‍⁣⁢‍⁡‌‍⁤⁢⁡‌⁢‌‍‌⁡‌⁡⁢⁣⁡‍⁢‌‌⁣⁣⁡⁢‌‍⁡⁢‌⁣⁢‌‍⁡⁢‍‍‌⁢‌⁡‌‍‍‌‌‌⁢⁡‍⁤⁡⁢‌⁤Client V3.1";
let rid = null, j = 0, f = 0;

async function getRoom() {
  if (rid) return rid;
  const r = await axios.post('https://www.gimkit.com/api/matchmaker/find-info-from-code', { code: String(pin) });
  rid = r.data.roomId;
  if (!rid) throw new Error('Game not found — check the code');
  return rid;
}

async function bot(n) {
  try {
    const roomId = await getRoom();
    const r1 = await axios.post('https://www.gimkit.com/api/matchmaker/join', { clientType: K, roomId, name: n });
    const d = r1.data;
    if (!d.serverUrl) throw new Error(JSON.stringify(d.message || d));
    const r2 = await axios.post(d.serverUrl + '/matchmake/joinById/' + d.roomId, { intentId: d.intentId });
    const p = r2.data;
    if (!p.room) throw new Error('Join rejected');
    const ws = new WebSocket('wss' + d.serverUrl.slice(5) + '/' + p.room.processId + '/' + d.roomId + '?sessionId=' + p.sessionId);
    ws.on('open', () => { j++; console.log(j + ' bots joined'); });
    ws.on('error', () => { f++; console.log(f + ' bots failed'); });
  } catch(e) {
    f++;
    console.log('failed: ' + (e.response ? JSON.stringify(e.response.data) : e.message));
  }
}

for (let i = 0; i < amount; i++) {
  bot(name + (amount > 1 ? (i + 1) : ''));
  await new Promise(r => setTimeout(r, 500));
}
await new Promise(r => setTimeout(r, 12000));
console.log('Done. ' + j + ' joined, ' + f + ' failed.');
process.exit(0);
