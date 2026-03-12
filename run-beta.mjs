// Beta wrapper
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const BATCH = 20;

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`BlooketFlooder — ${amount} bots on ${pin} (new modes)`);

const cfV2Res = await cookieV2('https://play.blooket.com/play?id=' + pin, 'beta');
if (cfV2Res.incorrectType) {
    console.log('Wrong mode — try Classic instead.');
    process.exit(0);
}

let success = 0, fail = 0;

for (let i = 1; i <= amount; i += BATCH) {
    const wave = [];
    for (let j = i; j < Math.min(i + BATCH, amount + 1); j++) {
        wave.push(
            join({ pin, name, amount }, cfV2Res, j)
                .then(r => { if (r == 2) success++; else fail++; })
                .catch(() => { fail++; })
        );
    }
    await Promise.all(wave);
    console.log(`Wave ${Math.ceil(i/BATCH)}: ${success} joined, ${fail} failed`);
    if (i + BATCH <= amount) await new Promise(r => setTimeout(r, 50));
}

console.log(`${success} bots joined!`);
console.log(`${fail} bots failed to join.`);
await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
