// Legacy wrapper with retry
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const BATCH = 20;
const MAX_RETRIES = 3;

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`BlooketFlooder — ${amount} bots on ${pin} (classic)`);
console.log('verifying game pin...');

const { redirectUrl } = await cookieV2('https://play.blooket.com/play?id=' + pin, 'legacy1');
if (!redirectUrl) { console.log('Failed to verify game pin.'); process.exit(1); }

const modes = { cryptohack:'Crypto Hack', santasworkshop:"Santa's Workshop", goldquest:'Gold Quest', fishingfrenzy:'Fishing Frenzy' };
let mode = 'Unknown';
for (const [k,v] of Object.entries(modes)) { if (redirectUrl.includes(k)) { mode=v; break; } }
console.log('verified! mode: ' + mode);

let success = 0, fail = 0;

async function tryJoin(i, retries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const result = await new Promise(resolve => {
            try {
                join(redirectUrl, pin, name + (i === 1 ? '' : i), (r) => resolve(r));
            } catch(e) { resolve(0); }
        });
        if (result == 2) { success++; return; }
        if (attempt < retries) {
            await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        }
    }
    fail++;
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
