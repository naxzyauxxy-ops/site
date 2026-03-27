
// Gimkit Bot Flooder
// Uses Socket.IO to join Gimkit games

import { io } from 'socket.io-client';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 30);

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`Gimkit Flooder — ${amount} bots on ${pin}`);

const GIMKIT_URL = 'https://gimkit.com';
const SOCKET_URL = 'https://server.gimkit.com';

let joined = 0, failed = 0;

async function getGameInfo(code) {
  try {
    const res = await fetch(`${GIMKIT_URL}/api/games/${code}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) throw new Error('Game not found');
    return await res.json();
  } catch(e) {
    throw new Error('Could not find game: ' + e.message);
  }
}

async function spawnBot(code, botName, index) {
  return new Promise((resolve) => {
    try {
      const socket = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 8000,
        query: { gameCode: code }
      });

      let done = false;
      const cleanup = () => { if(!done){ done=true; try{socket.disconnect();}catch{} } };
      const timeout = setTimeout(() => { if(!done){ failed++; console.log(`Bot ${index} timeout`); cleanup(); resolve(); } }, 10000);

      socket.on('connect', () => {
        socket.emit('join', {
          gameCode: code,
          name: botName + (amount > 1 ? index : ''),
          device: { type: 'desktop' }
        });
      });

      socket.on('joined', () => {
        joined++;
        console.log(`${joined} bots joined`);
        clearTimeout(timeout);
        // Stay connected briefly then disconnect
        setTimeout(() => { cleanup(); resolve(); }, 5000);
      });

      socket.on('error', (e) => { failed++; console.log(`Bot ${index} error: ${e}`); clearTimeout(timeout); cleanup(); resolve(); });
      socket.on('connect_error', (e) => { failed++; console.log(`Bot ${index} connect error: ${e.message}`); clearTimeout(timeout); cleanup(); resolve(); });
      socket.on('join_error', (e) => { failed++; console.log(`Bot ${index} join error: ${e}`); clearTimeout(timeout); cleanup(); resolve(); });

    } catch(e) { failed++; console.log(`Bot ${index} spawn error: ${e.message}`); resolve(); }
  });
}

// Launch bots in batches of 5
const BATCH = 5;
for(let i = 0; i < amount; i += BATCH) {
  const batch = [];
  for(let j = i; j < Math.min(i + BATCH, amount); j++) {
    batch.push(spawnBot(pin, name, j + 1));
    await new Promise(r => setTimeout(r, 200)); // stagger
  }
  await Promise.all(batch);
}

console.log(`Done. ${joined} joined, ${failed} failed.`);
process.exit(0);
