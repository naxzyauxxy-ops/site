// Legacy — max speed, all bots fire simultaneously with retry
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const MAX_RETRIES = 3;

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`VoidHub — ${amount} bots on ${pin} (classic)`);
console.log('verifying game pin...');

const { redirectUrl } = await cookieV2('https://play.blooket.com/play?id=' + pin, 'legacy1');
if (!redirectUrl) { console.log('Failed to verify game pin.'); process.exit(1); }

const modes = { cryptohack:'Crypto Hack', santasworkshop:"Santa's Workshop", goldquest:'Gold Quest', fishingfrenzy:'Fishing Frenzy' };
let mode = 'Unknown';
for (const [k,v] of Object.entries(modes)) if (redirectUrl.includes(k)) { mode=v; break; }
console.log('verified! mode: ' + mode);

let success = 0, fail = 0, done = 0;

async function tryJoin(i) {
    for (let a = 0; a <= MAX_RETRIES; a++) {
        const r = await new Promise(resolve => {
            try { join(redirectUrl, pin, name + (i === 1 ? '' : i), resolve); }
            catch { resolve(0); }
        });
        if (r == 2) { success++; done++; console.log(`[${done}/${amount}] Bot${i} joined`); return; }
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
