// Beta — with cookieV2 timeout + retry
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const MAX_RETRIES = 3;

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`VoidHub — ${amount} bots on ${pin} (new modes)`);

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
}

let cfV2Res;
for (let attempt = 1; attempt <= 3; attempt++) {
    try {
        console.log(`connecting... (attempt ${attempt}/3)`);
        cfV2Res = await withTimeout(
            cookieV2('https://play.blooket.com/play?id=' + pin, 'beta'),
            8000
        );
        if (cfV2Res) break;
    } catch (e) {
        console.log(`attempt ${attempt} failed: ${e.message}`);
        if (attempt === 3) { console.log('Failed to connect after 3 attempts.'); process.exit(1); }
        await new Promise(r => setTimeout(r, 500));
    }
}

if (cfV2Res.incorrectType) { console.log('Wrong mode — try Classic.'); process.exit(0); }
console.log('connected! launching bots...');

let success = 0, fail = 0, done = 0;

async function tryJoin(i) {
    for (let a = 0; a <= MAX_RETRIES; a++) {
        try {
            const r = await Promise.race([
                join({ pin, name, amount }, cfV2Res, i),
                new Promise(r => setTimeout(() => r(0), 6000))
            ]);
            if (r == 2) { success++; done++; console.log(`[${done}/${amount}] Bot${i} joined`); return; }
        } catch {}
        if (a < MAX_RETRIES) await new Promise(r => setTimeout(r, 150));
    }
    fail++; done++;
    console.log(`[${done}/${amount}] Bot${i} failed`);
}

await Promise.all(Array.from({length: amount}, (_, i) => tryJoin(i + 1)));
console.log(`${success} bots joined!`);
console.log(`${fail} bots failed to join.`);
await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
