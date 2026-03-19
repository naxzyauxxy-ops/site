// Legacy flooder — staggered launch + UA rotation to bypass CF rate limiting
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);

if (!pin) { console.error('missing PIN'); process.exit(1); }
console.log(`VoidHub — ${amount} bots on ${pin} (classic)`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(min, max) { return min + Math.floor(Math.random() * (max - min)); }

// Verify pin with retries
let redirectUrl;
for (let attempt = 1; attempt <= 5; attempt++) {
    try {
        console.log(`verifying game pin... (attempt ${attempt}/5)`);
        const res = await Promise.race([
            cookieV2('https://play.blooket.com/play?id=' + pin, 'legacy1'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
        ]);
        redirectUrl = res?.redirectUrl;
        if (redirectUrl) break;
        await sleep(jitter(800, 2000));
    } catch (e) {
        console.log(`attempt ${attempt} failed: ${e.message}`);
        if (attempt === 5) { console.log('Failed to verify game pin after 5 attempts.'); process.exit(1); }
        await sleep(jitter(1000, 3000));
    }
}
if (!redirectUrl) { console.log('Failed to verify game pin.'); process.exit(1); }

const modes = { cryptohack:'Crypto Hack', santasworkshop:"Santa's Workshop", goldquest:'Gold Quest', fishingfrenzy:'Fishing Frenzy' };
let mode = 'Unknown';
for (const [k,v] of Object.entries(modes)) if (redirectUrl.includes(k)) { mode=v; break; }
console.log('verified! mode: ' + mode + ' — launching bots...');

let success = 0, fail = 0, done = 0;

async function tryJoin(i) {
    // Each bot gets unique stagger delay to avoid simultaneous CF hits
    await sleep(jitter(i * 180, i * 400));
    
    for (let a = 0; a < 5; a++) {
        try {
            const r = await Promise.race([
                new Promise(resolve => {
                    try { join(redirectUrl, pin, name + (i === 1 ? '' : i), resolve); }
                    catch { resolve(0); }
                }),
                new Promise(r => setTimeout(() => r(0), 10000))
            ]);
            if (r == 2) { 
                success++; done++; 
                console.log(`[${done}/${amount}] Bot${i} joined`); 
                return; 
            }
        } catch {}
        // Exponential backoff between retries
        await sleep(jitter(500 * (a + 1), 1000 * (a + 1)));
    }
    fail++; done++;
    console.log(`[${done}/${amount}] Bot${i} failed`);
}

// Run in batches of 5 to avoid overwhelming CF
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
