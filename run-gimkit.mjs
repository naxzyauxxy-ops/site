// Gimkit Bot Flooder - uses correct matchmaker API
const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 30);

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`Gimkit Flooder — ${amount} bots on pin ${pin}`);

let joined = 0, failed = 0;

async function getRoomInfo(code) {
  const res = await fetch('https://www.gimkit.com/api/matchmaker/find-info-from-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ code: String(code) })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getIntent(roomId, botName) {
  const clientType = 'Gimkit Web Client V3.1';
  const res = await fetch('https://www.gimkit.com/api/matchmaker/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ roomId, name: botName, clientType })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function joinRoom(serverUrl, roomId, sessionId) {
  // Colyseus join via HTTP then upgrade to WS
  const joinUrl = `${serverUrl}/matchmake/joinById/${roomId}`;
  const res = await fetch(joinUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ sessionId })
  });
  if (!res.ok) throw new Error(`join HTTP ${res.status}`);
  return res.json();
}

async function spawnBot(botName) {
  try {
    const roomInfo = await getRoomInfo(pin);
    if (!roomInfo.roomId) throw new Error('No roomId — game may not exist');

    const intent = await getIntent(roomInfo.roomId, botName);
    if (!intent.sessionId) throw new Error('No sessionId — ' + JSON.stringify(intent));

    // Try to join via Colyseus HTTP endpoint
    await joinRoom(intent.serverUrl, intent.roomId, intent.sessionId);
    joined++;
    console.log(`${joined} bots joined`);
  } catch(e) {
    failed++;
    console.log(`Bot failed: ${e.message}`);
  }
}

// Stagger bots
for (let i = 0; i < amount; i++) {
  await spawnBot(name + (amount > 1 ? (i + 1) : ''));
  await new Promise(r => setTimeout(r, 300));
}

console.log(`Done. ${joined} joined, ${failed} failed.`);
process.exit(0);
