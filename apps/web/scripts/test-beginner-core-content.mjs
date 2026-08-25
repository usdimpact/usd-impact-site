import fs from 'node:fs';
import path from 'node:path';

const files = {
  starter: 'src/pages/starter-guide.md',
  startHere: 'src/content/pages/start-here.md',
  dollarFramework: 'src/content/frameworks/dollar-framework.md',
  transmission: 'src/content/frameworks/framework-dollar-transmission-chain.md',
  dashboard: 'src/content/frameworks/framework-three-dial-dashboard.md',
};

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), 'utf8');
const failures = [];
const texts = Object.fromEntries(Object.entries(files).map(([key, relativePath]) => [key, read(relativePath)]));

for (const [key, text] of Object.entries(texts)) {
  if (/four\s+macro\s+dials?/i.test(text) || /four-dial/i.test(text) || /four\s+dials?/i.test(text)) {
    failures.push(`${files[key]} still describes the framework as four dials`);
  }
}

for (const key of ['startHere', 'dollarFramework', 'transmission', 'dashboard']) {
  const text = texts[key];
  if (!/^status:\s+"published"/m.test(text)) failures.push(`${files[key]} must remain published`);
  const body = text.split('---').slice(2).join('---').trim();
  if (body.length < 1800) failures.push(`${files[key]} has regressed to a thin/skeleton body`);
  for (const phrase of ['dollar direction', 'real-rate', 'liquidity']) {
    if (!text.toLowerCase().includes(phrase)) failures.push(`${files[key]} missing canonical concept: ${phrase}`);
  }
}

for (const requiredLink of [
  '/start-here/',
  '/dollar-framework/',
  '/framework/dollar-transmission-chain/',
  '/framework/three-dial-dashboard/',
]) {
  if (!texts.starter.includes(requiredLink)) failures.push(`starter guide missing learning-path link ${requiredLink}`);
}

if (!texts.startHere.includes('same stronger dollar can mean different things')) {
  failures.push('Start Here must retain the worked same-dollar/different-regime example');
}
if (!texts.transmission.includes('one dollar move, two different regimes')) {
  failures.push('Dollar Transmission Chain must retain its worked two-regime example');
}
if (!texts.dollarFramework.includes('not a fourth macro dial')) {
  failures.push('Dollar Framework must explicitly keep broad-dollar confirmation inside Dial 1');
}
if (!texts.dashboard.includes('not an extra dial')) {
  failures.push('Three-Dial Dashboard must explicitly keep cross-asset confirmation outside the dial count');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('beginner core content regression pass');
