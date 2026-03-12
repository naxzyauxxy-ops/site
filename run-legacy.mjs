// Legacy wrapper
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const BATCH = 20;

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

// Run in parallel batches of 20 with 50ms between waves (was sequential 300ms each)
for (let i = 1; i <= amount; i += BATCH) {
    const wave = [];
    for (let j = i; j < Math.min(i + BATCH, amount + 1); j++) {
        wave.push(new Promise(resolve => {
            join(redirectUrl, pin, name + (j === 1 ? '' : j), (result) => {
                if (result == 2) success++; else fail++;
                if (success + fail == amount) {
                    console.log(`${success} bots joined!`);
                    console.log(`${fail} bots failed to join.`);
                }
                resolve();
            });
        }));
    }
    await Promise.all(wave);
    console.log(`Wave ${Math.ceil(i/BATCH)}: ${success} joined, ${fail} failed`);
    if (i + BATCH <= amount) await new Promise(r => setTimeout(r, 50));
}

await new Promise(r => setTimeout(r, 5 * 60 * 1000));
process.exit(0);
