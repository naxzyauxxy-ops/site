// Legacy — with cookieV2 timeout + retry
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const MAX_RETRIES = 3;

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`VoidHub — ${amount} bots on ${pin} (classic)`);

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
}

// Retry cookieV2 up to 3 times with 8s timeout each
let redirectUrl;
for (let attempt = 1; attempt <= 3; attempt++) {
    try {
        console.log(`verifying game pin... (attempt ${attempt}/3)`);
        const res = await withTimeout(
            cookieV2('https://play.blooket.com/play?id=' + pin, 'legacy1'),
            8000
        );
        redirectUrl = res.redirectUrl;
        if (redirectUrl) break;
        console.log('No redirect URL, retrying...');
    } catch (e) {
        console.log(`attempt ${attempt} failed: ${e.message}`);
        if (attempt === 3) { console.log('Failed to verify game pin after 3 attempts.'); process.exit(1); }
        await new Promise(r => setTimeout(r, 500));
    }
}
if (!redirectUrl) { console.log('Failed to verify game pin.'); process.exit(1); }

const modes = { cryptohack:'Crypto Hack', santasworkshop:"Santa's Workshop", goldquest:'Gold Quest', fishingfrenzy:'Fishing Frenzy' };
let mode = 'Unknown';
for (const [k,v] of Object.entries(modes)) if (redirectUrl.includes(k)) { mode=v; break; }
console.log('verified! mode: ' + mode + ' — launching bots...');

let success = 0, fail = 0, done = 0;

async function tryJoin(i) {
    for (let a = 0; a <= MAX_RETRIES; a++) {
        const r = await Promise.race([
            new Promise(resolve => {
                try { join(redirectUrl, pin, name + (i === 1 ? '' : i), resolve); }
                catch { resolve(0); }
            }),
            new Promise(r => setTimeout(() => r(0), 6000))
        ]);
        if (r == 2) { success++; done++; console.log(`[${done}/${amount}] Bot${i} joined`); return; }
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
