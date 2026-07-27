import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const checklistDownload = '/downloads/USD_Impact_Weekly_Dollar_Regime_Checklist_Lead_Magnet.pdf';
const routes = {
  dollarLesson: '/dollar/what-is-the-us-dollar',
  dollarQuiz: '/dollar/what-is-the-us-dollar/quiz',
  fxLesson: '/fx/fx-depreciation-vs-inflation',
  fxQuiz: '/fx/fx-depreciation-vs-inflation/quiz',
  dxyLesson: '/dxy/what-is-dxy',
  dxyQuiz: '/dxy/what-is-dxy/quiz',
  broadLesson: '/dxy/dxy-vs-broad-usd',
  broadQuiz: '/dxy/dxy-vs-broad-usd/quiz',
  regimeLesson: '/regime/how-to-read-the-dollar',
  regimeQuiz: '/regime/how-to-read-the-dollar/quiz',
  goldLesson: '/gold/usd-gold',
  goldQuiz: '/gold/usd-gold/quiz',
  wtiLesson: '/energy/usd-wti',
  wtiQuiz: '/energy/usd-wti/quiz',
  roadmap: '/quiz/',
};

const pagePath = (route) => path.join(distRoot, route.replace(/^\//, ''), 'index.html');
const failures = [];
const requiredRoutes = [
  '/start-here',
  '/book/read-the-dollar-first',
  routes.dollarLesson,
  routes.fxLesson,
  routes.dxyLesson,
  routes.broadLesson,
  routes.regimeLesson,
  routes.goldLesson,
  routes.wtiLesson,
  '/framework/dollar-transmission-chain',
  '/lead-magnets/weekly-dollar-regime-checklist',
  '/privacy',
];

for (const route of requiredRoutes) {
  if (!fs.existsSync(pagePath(route))) failures.push(`Missing published route: ${route}.`);
}

for (const output of ['news/index.html', 'news/2026-07-22/index.html', 'news/feed.xml', 'news/latest.json']) {
  if (!fs.existsSync(path.join(distRoot, output))) failures.push(`Missing Daily USD Impact output: /${output}.`);
}

const homepage = path.join(distRoot, 'index.html');
if (!fs.existsSync(homepage)) failures.push('Homepage was not generated.');
else {
  const html = fs.readFileSync(homepage, 'utf8');
  if (!html.includes('Join the book waitlist')) failures.push('Homepage waitlist CTA label is missing.');
  if (!html.includes('href="/news/"')) failures.push('Homepage Daily USD Impact link is missing.');
}

const lessonChecks = [
  [routes.dollarLesson, 'Take Quiz 2', routes.dollarQuiz],
  [routes.fxLesson, 'FX Depreciation vs Inflation: What Is the Difference?', '$105'],
  [routes.dxyLesson, 'Take Quiz 4', routes.dxyQuiz],
  [routes.broadLesson, 'DXY vs Broad USD: Which Dollar Signal Matters?', routes.broadQuiz],
  [routes.regimeLesson, 'Take Quiz 6', routes.regimeQuiz],
  [routes.goldLesson, 'Take Quiz 7', routes.goldQuiz],
  [routes.wtiLesson, 'USD and WTI: Why Oil Is Not Only a Dollar Trade', '$1,000,000'],
];
for (const [route, requiredText, requiredLink] of lessonChecks) {
  const file = pagePath(route);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(requiredText)) failures.push(`${route} is missing required text: ${requiredText}.`);
  if (!html.includes(requiredLink)) failures.push(`${route} is missing required link or learning block: ${requiredLink}.`);
}

const releasedQuizzes = [
  [routes.dollarQuiz, 'Quiz 2 of 12', routes.dollarLesson],
  [routes.fxQuiz, 'Quiz 3 of 12', routes.fxLesson],
  [routes.dxyQuiz, 'Quiz 4 of 12', routes.dxyLesson],
  [routes.broadQuiz, 'Quiz 5 of 12', routes.broadLesson],
  [routes.regimeQuiz, 'Quiz 6 of 12', routes.regimeLesson],
  [routes.goldQuiz, 'Quiz 7 of 12', routes.goldLesson],
];
for (const [route, label, lesson] of releasedQuizzes) {
  const file = pagePath(route);
  if (!fs.existsSync(file)) {
    failures.push(`Released quiz was not generated: ${route}.`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(label)) failures.push(`${route} is missing ${label}.`);
  if (!html.includes(`href="${lesson}"`)) failures.push(`${route} does not link to ${lesson}.`);
}

if (fs.existsSync(pagePath(routes.wtiQuiz))) {
  failures.push(`Unreleased Quiz 8 was generated at ${routes.wtiQuiz}.`);
}

for (const file of ['api/waitlist.js', 'api/daily-news-source.js']) {
  if (!fs.existsSync(path.resolve(file))) failures.push(`Required Vercel function is missing: ${file}.`);
}
if (!fs.existsSync(path.join(distRoot, checklistDownload.replace(/^\//, '')))) {
  failures.push(`Checklist PDF is missing: ${checklistDownload}.`);
}
if (fs.existsSync(pagePath('/benchmark/usd-impact-benchmark-dashboard'))) {
  failures.push('Draft benchmark route was generated.');
}

const sitemap = path.join(distRoot, 'sitemap-0.xml');
if (!fs.existsSync(sitemap)) failures.push('Generated sitemap-0.xml is missing.');
else {
  const xml = fs.readFileSync(sitemap, 'utf8');
  for (const route of [
    routes.dollarLesson,
    routes.fxLesson,
    routes.fxQuiz,
    routes.dxyLesson,
    routes.dxyQuiz,
    routes.broadLesson,
    routes.broadQuiz,
    routes.regimeLesson,
    routes.regimeQuiz,
    routes.goldLesson,
    routes.goldQuiz,
    routes.wtiLesson,
  ]) {
    if (!xml.includes(`${route}/`)) failures.push(`Released route is missing from sitemap: ${route}.`);
  }
  if (xml.includes(`${routes.wtiQuiz}/`)) failures.push('Unreleased Quiz 8 appears in sitemap.');
  if (xml.includes('benchmark/usd-impact-benchmark-dashboard')) failures.push('Draft benchmark route appears in sitemap.');
}

if (failures.length > 0) {
  console.error(`Production build verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('production build verification pass');