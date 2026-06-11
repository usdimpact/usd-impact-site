import fs from 'node:fs';
import path from 'node:path';
const banned = [
  /guaranteed return/i,
  /buy now/i,
  /sell now/i,
  /profit guarantee/i,
  /risk-free/i,
  /sure profit/i,
  /will outperform/i,
  /personalized recommendation/i
];
let failures = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(md|astro|ts|mjs|json)$/i.test(name)) {
      const text = fs.readFileSync(p, 'utf8');
      for (const pattern of banned) if (pattern.test(text)) failures.push(`${p}: ${pattern}`);
    }
  }
}
walk('src');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('compliance phrase check pass');
