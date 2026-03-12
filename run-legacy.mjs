// Optimized legacy wrapper
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = Math.min(parseInt(process.env.AMOUNT) || 10, 500);
const BATCH = 10;

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`Flooding ${pin} with ${amount} bots (classic)`);

let cfV2Res;
try {
  cfV2Res = await cookieV2('https://play.blooket.com/play?id=' + pin, 'legacy');
} catch(e) {
  console.error('Cookie fetch failed:', e.message);
  process.exit(1);
}

if (cfV2Res.incorrectType) {
  console.log('Wrong mode — try New Modes instead');
  process.exit(1);
}

let success = 0, fail = 0;
const config = { pin, name, amount };

for (let i = 1; i <= amount; i += BATCH) {
  const wave = [];
  for (let j = i; j < Math.min(i + BATCH, amount + 1); j++) {
    wave.push(
      join(config, cfV2Res, j)
        .then(r => { if (r == 2) success++; else fail++; })
        .catch(() => { fail++; })
    );
  }
  await Promise.all(wave);
  console.log(`Progress: ${success + fail}/${amount} (${success} joined, ${fail} failed)`);
  if (i + BATCH <= amount) await new Promise(r => setTimeout(r, 300));
}

console.log(`${success} bots joined!`);
console.log(`${fail} bots failed to join.`);
process.exit(0);
