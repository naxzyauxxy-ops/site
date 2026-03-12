// Beta wrapper with retry
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const BATCH = 20;
const MAX_RETRIES = 3;

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`BlooketFlooder — ${amount} bots on ${pin} (new modes)`);

const cfV2Res = await cookieV2('https://play.blooket.com/play?id=' + pin, 'beta');
if (cfV2Res.incorrectType) {
    console.log('Wrong mode — try Classic instead.');
    process.exit(0);
}

let success = 0, fail = 0;

async function tryJoin(i, retries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const r = await join({ pin, name, amount }, cfV2Res, i);
            if (r == 2) { success++; return; }
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
                continue;
            }
        } catch (e) {
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
                continue;
            }
        }
        fail++;
    }
}

for (let i = 1; i <= amount; i += BATCH) {
    const wave = [];
    for (let j = i; j < Math.min(i + BATCH, amount + 1); j++) {
        wave.push(tryJoin(j, MAX_RETRIES));
    }
    await Promise.all(wave);
    console.log(`Wave ${Math.ceil(i/BATCH)}: ${success} joined, ${fail} failed`);
    if (i + BATCH <= amount) await new Promise(r => setTimeout(r, 50));
}

console.log(`${success} bots joined!`);
console.log(`${fail} bots failed to join.`);
await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
