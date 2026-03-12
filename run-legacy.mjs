// Wrapper: bypasses enquirer, takes args from env
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/legacy/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = parseInt(process.env.AMOUNT) || 10;

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`Flooding ${pin} with ${amount} bots (legacy)`);

let success = 0, fail = 0;

const tasks = [];
for (let i = 1; i <= amount; i++) {
    const botName = name + (i == 1 ? '' : i);
    const redirectUrl = `https://play.blooket.com/play?id=${pin}`;
    
    const p = join(redirectUrl, pin, botName, (result) => {
        if (result?.status === 'joined') success++; else fail++;
        if (success + fail == amount) {
            console.log(`${success} bots joined!`);
            console.log(`${fail} bots failed to join.`);
        }
    });
    tasks.push(p);
    await new Promise(r => setTimeout(r, 150));
}
