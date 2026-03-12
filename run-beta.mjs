// Beta — max speed, all bots fire simultaneously with retry
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const MAX_RETRIES = 3;

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`VoidHub — ${amount} bots on ${pin} (new modes)`);

const cfV2Res = await cookieV2('https://play.blooket.com/play?id=' + pin, 'beta');
if (cfV2Res.incorrectType) { console.log('Wrong mode — try Classic.'); process.exit(0); }

let success = 0, fail = 0, done = 0;

async function tryJoin(i) {
    for (let a = 0; a <= MAX_RETRIES; a++) {
        try {
            const r = await join({ pin, name, amount }, cfV2Res, i);
            if (r == 2) { success++; done++; console.log(`[${done}/${amount}] Bot${i} joined`); return; }
        } catch {}
        if (a < MAX_RETRIES) await new Promise(r => setTimeout(r, 150));
    }
    fail++; done++;
    console.log(`[${done}/${amount}] Bot${i} failed`);
}

// Fire ALL bots at once — no waves, no delays
await Promise.all(Array.from({length: amount}, (_, i) => tryJoin(i + 1)));

console.log(`${success} bots joined!`);
console.log(`${fail} bots failed to join.`);
await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
