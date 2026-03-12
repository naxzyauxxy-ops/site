// Legacy wrapper — mirrors BlooketFlooder/src/legacy/index.js without enquirer
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`BlooketFlooder — ${amount} bots on ${pin} (classic)`);
console.log('verifying game pin...');

const modes = {
    cryptohack: 'Crypto Hack',
    santasworkshop: "Santa's Workshop",
    goldquest: 'Gold Quest',
    fishingfrenzy: 'Fishing Frenzy'
};

const { redirectUrl } = await cookieV2('https://play.blooket.com/play?id=' + pin, 'legacy1');
if (!redirectUrl) {
    console.log('Failed to verify game pin.');
    process.exit(1);
}

let mode = 'Unknown';
for (const [key, value] of Object.entries(modes)) {
    if (redirectUrl.includes(key)) { mode = value; break; }
}

console.log('verified game pin! mode: ' + mode);

let success = 0;
let fail = 0;

for (let i = 1; i <= amount; i++) {
    join(redirectUrl, pin, name + (i === 1 ? '' : i), (result) => {
        if (result == 2) success++;
        else fail++;

        if (success + fail == amount) {
            console.log(`${success} bots joined!`);
            console.log(`${fail} bots failed to join.`);
        }
    });

    // 300ms delay between spawns — same as original
    await new Promise(r => setTimeout(r, 300));
}

// Keep alive until all bots finish (max 5 min)
await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
