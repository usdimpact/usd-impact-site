import fs from 'node:fs';
import path from 'node:path';

const files = {
  component: 'src/components/FrameworkEvidenceChain.astro',
  daily: 'src/pages/news/[date].astro',
  score: 'src/pages/score.astro',
  weekly: 'src/pages/reports/weekly/[date].astro',
  startHere: 'src/content/pages/start-here.md',
};

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), 'utf8');
const sources = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, read(value)]));
const failures = [];

for (const label of ['Learn', 'Daily', 'Score', 'Weekly']) {
  if (!sources.component.includes(`label: '${label}'`)) failures.push(`Evidence Chain missing stage ${label}.`);
}
for (const href of [
  '/start-here/',
  '/news/',
  '/score/',
  '/glossary/dxy/',
  '/glossary/broad-usd/',
  '/glossary/real-rates/',
  '/glossary/liquidity-stress/',
  '/framework/dollar-transmission-chain/',
]) {
  if (!sources.component.includes(href)) failures.push(`Evidence Chain missing required link ${href}.`);
}
if (!sources.component.includes('Learn → Daily → Score → Weekly')) failures.push('Evidence Chain heading changed unexpectedly.');
if (!sources.component.includes("not a substitute for the Score's published eight-variable formula")) {
  failures.push('Evidence Chain must distinguish learning lenses from the Score formula.');
}

if (!sources.daily.includes("FrameworkEvidenceChain from '../../components/FrameworkEvidenceChain.astro'")) failures.push('Daily route must import the Evidence Chain.');
if (!sources.daily.includes('<FrameworkEvidenceChain current="daily" />')) failures.push('Daily route must identify the Daily stage.');

if (!sources.score.includes("FrameworkEvidenceChain from '../components/FrameworkEvidenceChain.astro'")) failures.push('Score route must import the Evidence Chain.');
if (!sources.score.includes('current="score"')) failures.push('Score route must identify the Score stage.');
if (!sources.score.includes("latestWeeklyReport?.data.slug ?? '/reports/'")) failures.push('Score route must link the Weekly stage to the latest Weekly Brief when available.');
if (!sources.score.includes('/score/methodology/')) failures.push('Score route must retain the methodology link.');

if (!sources.weekly.includes("FrameworkEvidenceChain from '../../../components/FrameworkEvidenceChain.astro'")) failures.push('Weekly route must import the Evidence Chain.');
if (!sources.weekly.includes('current="weekly" weeklyHref={entry.data.slug}')) failures.push('Weekly route must identify its current Weekly stage.');
if (!sources.weekly.includes('entry.data.sourceEditions.map')) failures.push('Weekly route must retain exact Daily-edition provenance.');
if (!sources.weekly.includes('entry.data.score.sourceUrl')) failures.push('Weekly route must retain the archived Score provenance link.');

for (const required of ['/news/', '/score/', '/reports/']) {
  if (!sources.startHere.includes(required)) failures.push(`Start Here must retain the broader learning-path link ${required}.`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('framework evidence-chain navigation contract pass');
