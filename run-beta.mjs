// Beta flooder — staggered launch + CF bypass
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`VoidHub — ${amount} bots on ${pin} (new modes)`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(min, max) { return min + Math.floor(Math.random() * (max - min)); }

let cfV2Res;
for (let attempt = 1; attempt <= 5; attempt++) {
    try {
        console.log(`connecting... (attempt ${attempt}/5)`);
        cfV2Res = await Promise.race([
            cookieV2('https://play.blooket.com/play?id=' + pin, 'beta'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
        ]);
        if (cfV2Res) break;
    } catch (e) {
        console.log(`attempt ${attempt} failed: ${e.message}`);
        if (attempt === 5) { console.log('Failed to connect after 5 attempts.'); process.exit(1); }
        await sleep(jitter(1000, 3000));
    }
}

if (cfV2Res?.incorrectType) { console.log('Wrong mode — try Classic.'); process.exit(0); }
console.log('connected! launching bots...');

let success = 0, fail = 0, done = 0;

async function tryJoin(i) {
    await sleep(jitter(i * 180, i * 400));
    
    for (let a = 0; a < 5; a++) {
        try {
            const r = await Promise.race([
                join({ pin, name, amount }, cfV2Res, i),
                new Promise(r => setTimeout(() => r(0), 10000))
            ]);
            if (r == 2) { 
                success++; done++; 
                console.log(`[${done}/${amount}] Bot${i} joined`); 
                return; 
            }
        } catch {}
        await sleep(jitter(500 * (a + 1), 1000 * (a + 1)));
    }
    fail++; done++;
    console.log(`[${done}/${amount}] Bot${i} failed`);
}

const BATCH = 5;
for (let i = 0; i < amount; i += BATCH) {
    const batch = Array.from({length: Math.min(BATCH, amount - i)}, (_, j) => tryJoin(i + j + 1));
    await Promise.all(batch);
    if (i + BATCH < amount) await sleep(jitter(800, 1500));
}

console.log(`${success} bots joined!`);
console.log(`${fail} bots failed to join.`);
await sleep(5 * 60 * 1000);
process.exit(0);
