// Beta wrapper — mirrors BlooketFlooder/src/beta/index.js without enquirer
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`BlooketFlooder — ${amount} bots on ${pin} (new modes)`);

const cfV2Res = await cookieV2('https://play.blooket.com/play?id=' + pin, 'beta');
if (process.env.DEBUG) console.log('obtained cfV2Res.', cfV2Res);

if (cfV2Res.incorrectType) {
    console.log('This game mode should NOT be botted using New Modes.');
    console.log('Switch to Classic mode instead.');
    process.exit(0);
}

let success = 0;
let fail = 0;

for (let i = 1; i <= amount; i++) {
    join({ pin, name, amount }, cfV2Res, i).then((result) => {
        if (result == 2) success++;
        else fail++;

        if (success + fail == amount) {
            console.log(`\n${success} bots joined!`);
            console.log(`${fail} bots failed to join.`);
        }
    }).catch(() => {
        fail++;
        if (success + fail == amount) {
            console.log(`\n${success} bots joined!`);
            console.log(`${fail} bots failed to join.`);
        }
    });

    // 100ms delay between spawns — same as original
    await new Promise(r => setTimeout(r, 100));
}

// Keep alive until all bots finish (max 5 min)
await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
