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

const allowedPhrasesByFile = new Map([
  [
    'src/content/quizzes/en/quiz-fx-depreciation-vs-inflation.json',
    ['The currency becomes risk-free.']
  ],
  [
    'src/content/quizzes/en/quiz-what-is-us-dollar.json',
    ['The U.S. economy must be risk-free.']
  ]
]);

let failures = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);

    if (st.isDirectory()) {
      walk(p);
    } else if (/\.(md|astro|ts|mjs|json)$/i.test(name)) {
      const relativePath = p.split(path.sep).join('/');
      let text = fs.readFileSync(p, 'utf8');

      for (const allowedPhrase of allowedPhrasesByFile.get(relativePath) ?? []) {
        text = text.replaceAll(allowedPhrase, '');
      }

      for (const pattern of banned) {
        if (pattern.test(text)) {
          failures.push(`${p}: ${pattern}`);
        }
      }
    }
  }
}

walk('src');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('compliance phrase check pass');
