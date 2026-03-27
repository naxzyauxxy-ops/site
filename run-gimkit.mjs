// Gimkit Bot Flooder — correct API flow
import { WebSocket } from 'ws';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 30);

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`Gimkit Flooder — ${amount} bots on pin ${pin}`);

// The clientType needs this exact hidden unicode string to pass Gimkit's auth check
const CLIENT_TYPE = "Gimkit \u2061\u200D\u2064\u200D\u2061\u200C\u200D\u2062\u200D\u2062\u200D\u2061\u200C\u200D\u2062\u2061\u2064\u200D\u200D\u200D\u2061\u2062\u200D\u2062\u2061\u200D\u200C\u200D\u200C\u200D\u2061\u2061\u2061\u200D\u200D\u200C\u2062\u2061\u2062\u2061\u2061\u2061\u200D\u2063\u200C\u200D\u200C\u2061\u2064\u200D\u200C\u200D\u2061\u2064\u2061\u2062\u2061\u2062\u2061\u200D\u2062\u200D\u200D\u2062\u2063\u2061\u200C\u2062\u200D\u2063\u200C\u2061\u200D\u2063\u2061\u200C\u2061\u2061\u2062\u200D\u200C\u2064\u2062\u200D\u200C\u2062\u2061\u200D\u2061\u2061\u200D\u2062\u200D\u2062\u200C\u2061\u2062\u2063\u2061\u200C\u2061\u2064\u200D\u2061\u2061\u200C\u200D\u2062\u2063\u2062\u2061\u200D\u2061\u2063\u200D\u200D\u2062\u2061\u2061\u200D\u200D\u2061\u200C\u2064\u2061\u200C\u2062\u2061\u2062\u200D\u2061\u200C\u200D\u2062\u200C\u2062\u2061\u200D\u200C\u2062\u2061\u2062\u200C\u2061\u200C\u2062\u200D\u200D\u200D\u2061\u2063\u2062\u200D\u200C\u200D\u2061\u200D\u200C\u2062\u200C\u2062\u2061\u2061\u200C\u2062\u2063\u200C\u2064\u2062\u2061\u200D\u200D\u2061\u200D\u2062\u2061\u2062\u2061\u2063\u2061\u200C\u2061\u200D\u2061\u2061\u2063\u200D\u2064\u2062\u2061\u2062\u200D\u2061\u2064\u200C\u2061\u2064\u200C\u2061\u2061\u200D\u200D\u200D\u200D\u200D\u200C\u2062\u2061\u2061\u200D\u200D\u2062\u200C\u200D\u200C\u200D\u2062\u200D\u2062\u2061\u2061\u2062\u2061\u200C\u2061\u200C\u2061\u2061\u200C\u200D\u2061\u2062\u200D\u200C\u2061\u2062\u200C\u200D\u2063\u200D\u200C\u2064\u2061\u2061\u200D\u2061\u200D\u2062\u200D\u2063\u200D\u2063\u2064\u200C\u200D\u200D\u2063\u2061\u200C\u200D\u200C\u2061\u2062\u2061\u2064\u200D\u2064\u2061\u2062\u2061\u200C\u200D\u2061\u2062\u200D\u200D\u200D\u200C\u200D\u200D\u200C\u2062\u200D\u2062\u200D\u2062\u200C\u2061\u200D\u200C\u2061\u200C\u2064\u200D\u2061Web Client V3.1";

let joined = 0, failed = 0;

async function findRoomInfo(code) {
  const res = await fetch('https://www.gimkit.com/api/matchmaker/find-info-from-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: String(code) })
  });
  return res.json();
}

async function getIntent(roomId, botName) {
  const res = await fetch('https://www.gimkit.com/api/matchmaker/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, name: botName, clientType: CLIENT_TYPE })
  });
  return res.json();
}

async function spawnBot(botName) {
  return new Promise(async (resolve) => {
    try {
      const roomInfo = await findRoomInfo(pin);
      if (!roomInfo.roomId) throw new Error('Game not found - check the code');

      const intent = await getIntent(roomInfo.roomId, botName);
      if (!intent.serverUrl) throw new Error('No server URL: ' + JSON.stringify(intent));

      // Join via Colyseus HTTP
      const joinUrl = `${intent.serverUrl}/matchmake/joinById/${intent.roomId}`;
      const joinRes = await fetch(joinUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: intent.intentId })
      });
      const joinData = await joinRes.json();
      if (!joinData.room) throw new Error('Join failed: ' + JSON.stringify(joinData));

      // Connect via WebSocket
      const wsUrl = `${intent.serverUrl.replace('https', 'wss')}/${joinData.room.processId}/${joinData.room.roomId}?sessionId=${joinData.sessionId}`;
      const ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        joined++;
        console.log(`${joined} bots joined`);
        ws.close();
        resolve();
      }, 3000);

      ws.on('open', () => {
        joined++;
        console.log(`${joined} bots joined`);
        clearTimeout(timeout);
        setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 5000);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        failed++;
        console.log(`Bot failed: ws error`);
        resolve();
      });

    } catch(e) {
      failed++;
      console.log(`Bot failed: ${e.message}`);
      resolve();
    }
  });
}

// Stagger bots in batches
const BATCH = 3;
for (let i = 0; i < amount; i += BATCH) {
  const batch = [];
  for (let j = i; j < Math.min(i + BATCH, amount); j++) {
    batch.push(spawnBot(name + (amount > 1 ? (j + 1) : '')));
    await new Promise(r => setTimeout(r, 250));
  }
  await Promise.all(batch);
}

console.log(`Done. ${joined} joined, ${failed} failed.`);
process.exit(0);
