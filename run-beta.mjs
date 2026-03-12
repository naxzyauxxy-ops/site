// Wrapper: bypasses enquirer, takes args from env
import cookieV2 from './BlooketFlooder/src/common/cookieV2.js';
import join from './BlooketFlooder/src/beta/join.js';

const pin = process.env.PIN;
const name = process.env.NAME || 'Bot';
const amount = parseInt(process.env.AMOUNT) || 10;

if (!pin) { console.error('missing PIN'); process.exit(1); }

console.log(`Flooding ${pin} with ${amount} bots (beta)`);

const cfV2Res = await cookieV2('https://play.blooket.com/play?id=' + pin, 'beta');

if (cfV2Res.incorrectType) {
    console.log('Wrong mode — try Classic instead');
    process.exit(1);
}

let success = 0, fail = 0;
const config = { pin, name, amount };

for (let i = 1; i <= amount; i++) {
    join(config, cfV2Res, i).then(result => {
        if (result == 2) success++; else fail++;
        if (success + fail == amount) {
            console.log(`${success} bots joined!`);
            console.log(`${fail} bots failed to join.`);
        }
    });
}
