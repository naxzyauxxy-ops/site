// Gimkit Bot Flooder — uses gimkit-flooder.js approach
import axios from 'axios';
import { WebSocket } from 'ws';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 30);

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log('Gimkit Flooder — ' + amount + ' bots on pin ' + pin);

const SECRET = "Gimkit Web ⁤‍‍⁡‌‍⁢‌⁢⁡⁢‍⁢‍⁤‍‌‌‌‍‍⁡⁢‍‍⁢⁣‍‌⁢⁡‌‌‍‍‍⁡‌‌⁢⁡‌⁢⁣‍⁢‌⁢⁡⁢‌⁡‌⁡‌⁢‍‍‍⁡‍⁣‌‍‌‍‌‍‍‍⁡‍‌‍‍‍⁢⁡‌‌⁤‌⁢‌‍⁣⁣⁤‍⁡‌⁢‌‍⁢⁡⁤⁡‌‍⁡⁢‌‍⁤⁡⁢‌‌⁡‌⁢‌⁢‌‌‌⁣‌‌‍⁤⁡‍⁡⁤‌⁡‍⁡‌⁡⁢⁣⁤⁤‌‌‌‌⁡‌‍⁣‌⁡‌‍⁢‍‌⁢‌⁡⁢⁡‍⁢⁡‍⁡‌⁡‍⁢‍‌‍‍‍⁡‌‍‌⁡‍⁤‌⁢‍‌‌⁡‌⁡‍‌⁡‍⁢‍‍⁣⁢‍‌‍⁡‍⁢⁡‌⁣⁢‌‍‌‍⁢⁡‍⁡⁢‌‍⁢‍‍⁤‌‍‌⁢‌‌‍‌‍‌‍⁡‍⁡‍⁡‍‍‍⁣⁢‍⁡‌‍⁤⁢⁡‌⁢‌‍‌⁡‌⁡⁢⁣⁡‍⁢‌‌⁣⁣⁡⁢‌‍⁡⁢‌⁣⁢‌‍⁡⁢‍‍‌⁢‌⁡‌‍‍‌‌‌⁢⁡‍⁤⁡⁢‌⁤Client V3.1";
const APIS = {
  roomId: 'https://www.gimkit.com/api/matchmaker/find-info-from-code',
  matchMaker: 'https://www.gimkit.com/api/matchmaker/join'
};

let joined = 0, failed = 0;
let cachedRoomId = null;

async function getRoomId() {
  if (cachedRoomId) return cachedRoomId;
  const r = await axios.post(APIS.roomId, { code: pin });
  cachedRoomId = r.data.roomId;
  return cachedRoomId;
}

async function joinBot(botName) {
  try {
    const roomId = await getRoomId();
    const r = await axios.post(APIS.matchMaker, { clientType: SECRET, roomId, name: botName });
    const room = r.data;
    const socketUrl = room.serverUrl + '/matchmake/joinById/' + room.roomId;
    const matchmake = await axios.post(socketUrl, { intentId: room.intentId });
    const player = matchmake.data;
    const wsUrl = 'wss' + room.serverUrl.substr(5) + '/' + player.room.processId + '/' + room.roomId + '?sessionId=' + player.sessionId;
    const socket = new WebSocket(wsUrl);
    socket.on('open', () => {
      joined++;
      console.log(joined + ' bots joined');
    });
    socket.on('error', () => {
      failed++;
      console.log(failed + ' bots failed');
    });
  } catch(e) {
    failed++;
    const msg = e.response ? JSON.stringify(e.response.data) : e.message;
    console.log('Bot failed: ' + msg);
  }
}

// Stagger bots
for (let i = 0; i < amount; i++) {
  joinBot(name + (amount > 1 ? (i + 1) : ''));
  await new Promise(r => setTimeout(r, 400));
}

// Wait for all to connect
await new Promise(r => setTimeout(r, 8000));
console.log('Done. ' + joined + ' joined, ' + failed + ' failed.');
process.exit(0);
