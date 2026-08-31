import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const checklistDownload = '/downloads/USD_Impact_Weekly_Dollar_Regime_Checklist_Lead_Magnet.pdf';
const routes = {
  dollarLesson: '/dollar/what-is-the-us-dollar', dollarQuiz: '/dollar/what-is-the-us-dollar/quiz',
  fxLesson: '/fx/fx-depreciation-vs-inflation', fxQuiz: '/fx/fx-depreciation-vs-inflation/quiz',
  dxyLesson: '/dxy/what-is-dxy', dxyQuiz: '/dxy/what-is-dxy/quiz',
  broadLesson: '/dxy/dxy-vs-broad-usd', broadQuiz: '/dxy/dxy-vs-broad-usd/quiz',
  regimeLesson: '/regime/how-to-read-the-dollar', regimeQuiz: '/regime/how-to-read-the-dollar/quiz',
  goldLesson: '/gold/usd-gold', goldQuiz: '/gold/usd-gold/quiz',
  wtiLesson: '/energy/usd-wti', wtiQuiz: '/energy/usd-wti/quiz',
  lngLesson: '/energy/lng-natural-gas', lngQuiz: '/energy/lng-natural-gas/quiz',
  equitiesLesson: '/equities/usd-equities', equitiesQuiz: '/equities/usd-equities/quiz',
  bitcoinLesson: '/bitcoin/usd-bitcoin', bitcoinQuiz: '/bitcoin/usd-bitcoin/quiz',
  currencyRiskLesson: '/fx/usd-and-currency-risk', currencyRiskQuiz: '/fx/usd-and-currency-risk/quiz',
};
const pagePath = (route) => path.join(distRoot, route.replace(/^\//, ''), 'index.html');
const failures = [];
const requiredRoutes = ['/start-here','/book/read-the-dollar-first','/audiobook/read-the-dollar-first','/video-library',routes.dollarLesson,routes.fxLesson,routes.dxyLesson,routes.broadLesson,routes.regimeLesson,routes.goldLesson,routes.wtiLesson,routes.lngLesson,routes.equitiesLesson,routes.bitcoinLesson,routes.currencyRiskLesson,'/framework/dollar-transmission-chain','/lead-magnets/weekly-dollar-regime-checklist','/privacy','/terms','/refund-policy'];
for (const route of requiredRoutes) if (!fs.existsSync(pagePath(route))) failures.push(`Missing published route: ${route}.`);
for (const output of ['news/index.html','news/2026-07-22/index.html','news/feed.xml','news/latest.json']) if (!fs.existsSync(path.join(distRoot, output))) failures.push(`Missing Daily USD Impact output: /${output}.`);
for (const output of ['reports/index.html','reports/weekly/2026-07-31/index.html']) if (!fs.existsSync(path.join(distRoot, output))) failures.push(`Missing USD Impact Reports output: /${output}.`);
const checklistAnalytics = pagePath('/internal/checklist-analytics');
if (!fs.existsSync(checklistAnalytics)) failures.push('Checklist analytics dashboard was not generated.');
else if (!fs.readFileSync(checklistAnalytics, 'utf8').includes('content="noindex, nofollow"')) failures.push('Checklist analytics dashboard is missing noindex metadata.');
const monthlyReportRoot = path.resolve('src/content/monthly-reports');
for (const file of fs.readdirSync(monthlyReportRoot).filter((name) => name.endsWith('.md'))) {
  const source = fs.readFileSync(path.join(monthlyReportRoot, file), 'utf8');
  const status = source.match(/^status:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim();
  const slug = source.match(/^slug:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1]?.trim();
  if (status === 'published' && (!slug || !fs.existsSync(pagePath(slug)))) {
    failures.push(`Published monthly report was not generated: ${slug ?? file}.`);
  }
}

const homepage = path.join(distRoot, 'index.html');
if (!fs.existsSync(homepage)) failures.push('Homepage was not generated.');
else {
  const html = fs.readFileSync(homepage, 'utf8');
  if (!html.includes('Join the book waitlist')) failures.push('Homepage waitlist CTA label is missing.');
  if (!html.includes('data-home-library-pass-cta')) failures.push('Homepage fail-closed Library Pass CTA is missing.');
  if (!html.includes('data-home-checkout-readiness="checking"')) failures.push('Homepage Library Pass CTA is missing its initial checking state.');
  if (!html.includes('Read the Dollar First is now available.</strong> Get')) failures.push('English launch announcement spacing is missing.');
  if (!html.includes('Read the Dollar First ya está disponible.</strong> Accede')) failures.push('Spanish launch announcement spacing is missing.');
  if (!html.includes('href="/news/"')) failures.push('Homepage Daily USD Impact link is missing.');
  if (!html.includes('href="/terms/"')) failures.push('Homepage footer Terms link is missing.');
  if (!html.includes('href="/refund-policy/"')) failures.push('Homepage footer Refund Policy link is missing.');
}

const productPage = pagePath('/book/read-the-dollar-first');
if (fs.existsSync(productPage)) {
  const html = fs.readFileSync(productPage, 'utf8');
  for (const requiredText of ['Guided Interactive Edition', '51-film USD Impact Video Library', 'USD 39.00', 'USD 49.00', 'one-time', '14-day Refund Policy', 'ongoing access']) {
    if (!html.includes(requiredText)) failures.push(`Product page is missing domain-review text: ${requiredText}.`);
  }
}

const videoLibraryPage = pagePath('/video-library');
if (fs.existsSync(videoLibraryPage)) {
  const html = fs.readFileSync(videoLibraryPage, 'utf8');
  const filmLinks = html.match(/href="\/guided-edition\/video-library\/[a-z0-9-]+\/?"/g) || [];
  if (filmLinks.length !== 51) failures.push(`Public video library contains ${filmLinks.length} film links instead of 51.`);
  if (!html.includes('51-film')) failures.push('Public video library is missing the 51-film overview.');
  if (/[a-f0-9]{32}/i.test(html)) failures.push('Public video library exposes a Stream UID.');
  if (html.includes('cloudflarestream.com')) failures.push('Public video library exposes a playback origin.');
}

const audiobookPage = pagePath('/audiobook/read-the-dollar-first');
if (fs.existsSync(audiobookPage)) {
  const html = fs.readFileSync(audiobookPage, 'utf8');
  for (const requiredText of ['Library Pass', '20 chapters', 'Chapter 13 - What to Watch from Here', 'Sign in to listen']) {
    if (!html.includes(requiredText)) failures.push(`Audiobook page is missing required protected-access content: ${requiredText}.`);
  }
  for (const forbiddenText of ['data-audiobook-player', 'public.blob.vercel-storage.com', '<audio']) {
    if (html.includes(forbiddenText)) failures.push(`Audiobook page exposes forbidden public-player content: ${forbiddenText}.`);
  }
}

const lessonChecks = [
  [routes.dollarLesson,'Take Quiz 2',routes.dollarQuiz],
  [routes.fxLesson,'FX Depreciation vs Inflation: What Is the Difference?','$105'],
  [routes.dxyLesson,'Take Quiz 4',routes.dxyQuiz],
  [routes.broadLesson,'DXY vs Broad USD: Which Dollar Signal Matters?',routes.broadQuiz],
  [routes.regimeLesson,'Take Quiz 6',routes.regimeQuiz],
  [routes.goldLesson,'USD and Gold: How the Dollar, Real Yields, and Stress Shape Gold','$10,000'],
  [routes.wtiLesson,'USD and WTI: Why Oil Is Not Only a Dollar Trade','$1,000,000'],
  [routes.lngLesson,'USD and LNG / Natural Gas: Why Gas Is More Regional Than Oil','$240,000'],
  [routes.equitiesLesson,'USD and Equities: How the Dollar Affects Earnings, Margins, and Valuations','$100,000,000'],
  [routes.bitcoinLesson,'USD and Bitcoin: Liquidity, Risk Appetite, Adoption, and Volatility','$10,000'],
  [routes.currencyRiskLesson,'USD and FX: Currency Pairs, Translation Risk, and Hedging Logic','$100,000'],
];
for (const [route, requiredText, requiredBlock] of lessonChecks) {
  const file = pagePath(route);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(requiredText)) failures.push(`${route} is missing required text: ${requiredText}.`);
  if (!html.includes(requiredBlock)) failures.push(`${route} is missing required link or learning block: ${requiredBlock}.`);
}

const releasedQuizzes = [
  [routes.dollarQuiz,'Quiz 2 of 12',routes.dollarLesson], [routes.fxQuiz,'Quiz 3 of 12',routes.fxLesson],
  [routes.dxyQuiz,'Quiz 4 of 12',routes.dxyLesson], [routes.broadQuiz,'Quiz 5 of 12',routes.broadLesson],
  [routes.regimeQuiz,'Quiz 6 of 12',routes.regimeLesson], [routes.goldQuiz,'Quiz 7 of 12',routes.goldLesson],
  [routes.wtiQuiz,'Quiz 8 of 12',routes.wtiLesson], [routes.lngQuiz,'Quiz 9 of 12',routes.lngLesson],
  [routes.equitiesQuiz,'Quiz 10 of 12',routes.equitiesLesson], [routes.bitcoinQuiz,'Quiz 11 of 12',routes.bitcoinLesson],
  [routes.currencyRiskQuiz,'Quiz 12 of 12',routes.currencyRiskLesson],
];
for (const [route, label, lesson] of releasedQuizzes) {
  const file = pagePath(route);
  if (!fs.existsSync(file)) { failures.push(`Released quiz was not generated: ${route}.`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(label)) failures.push(`${route} is missing ${label}.`);
  if (!html.includes(`href="${lesson}"`)) failures.push(`${route} does not link to ${lesson}.`);
}
const finalQuizHtml = fs.existsSync(pagePath(routes.currencyRiskQuiz)) ? fs.readFileSync(pagePath(routes.currencyRiskQuiz), 'utf8') : '';
if (finalQuizHtml && !finalQuizHtml.includes('data-quiz-completion-link')) failures.push('Quiz 12 is missing the completion link contract.');
for (const file of ['api/waitlist.js','api/daily-news-source.js','api/catalyst-brief-source.js','api/guided-edition.js','api/account.js','src/lib/video-library-handler.js','src/lib/video-progress-handler.js','src/lib/book-delivery-handler.js','src/lib/private-book.js','middleware.js']) if (!fs.existsSync(path.resolve(file))) failures.push(`Required Vercel function, protected handler, or middleware is missing: ${file}.`);
const apiFunctionFiles = fs.readdirSync(path.resolve('api')).filter((name) => name.endsWith('.js'));
if (apiFunctionFiles.length > 12) failures.push(`Vercel function-source count is ${apiFunctionFiles.length}; the Hobby limit is 12.`);
const vercelConfig = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
const rewrites = new Map((vercelConfig.rewrites || []).map((rewrite) => [rewrite.source, rewrite.destination]));
if (rewrites.get('/guided-edition/video-library') !== '/api/guided-edition?__video_library=1') failures.push('Protected video catalog is not consolidated into the Guided Edition function.');
if (rewrites.get('/guided-edition/book') !== '/api/guided-edition?__book=1') failures.push('Protected book delivery is not consolidated into the Guided Edition function.');
if (rewrites.get('/guided-edition/book/:path*') !== '/api/guided-edition?__book=1&__book_path=:path*') failures.push('Protected book download routing is missing.');
if (rewrites.get('/api/video-progress') !== '/api/account?action=video-progress') failures.push('Video progress is not consolidated into the account function.');
if (!fs.existsSync(path.join(distRoot, checklistDownload.replace(/^\//, '')))) failures.push(`Checklist PDF is missing: ${checklistDownload}.`);
if (fs.existsSync(pagePath('/benchmark/usd-impact-benchmark-dashboard'))) failures.push('Draft benchmark route was generated.');
if (fs.existsSync(pagePath('/guided-edition'))) failures.push('Protected Guided Edition was generated as public static HTML.');
if (fs.existsSync(pagePath('/guided-edition/book'))) failures.push('Protected book delivery was generated as public static HTML.');

const sitemap = path.join(distRoot, 'sitemap-0.xml');
if (!fs.existsSync(sitemap)) failures.push('Generated sitemap-0.xml is missing.');
else {
  const xml = fs.readFileSync(sitemap, 'utf8');
  const protectedRoutes = [
    '/start-here','/start-here/quiz',routes.dollarLesson,routes.dollarQuiz,routes.fxLesson,routes.fxQuiz,
    routes.dxyLesson,routes.dxyQuiz,routes.broadLesson,routes.broadQuiz,routes.regimeLesson,routes.regimeQuiz,
    routes.goldLesson,routes.goldQuiz,routes.wtiLesson,routes.wtiQuiz,routes.lngLesson,routes.lngQuiz,
    routes.equitiesLesson,routes.equitiesQuiz,routes.bitcoinLesson,routes.bitcoinQuiz,
    routes.currencyRiskLesson,routes.currencyRiskQuiz,'/guided-edition','/guided-edition/video-library','/guided-edition/book',
  ];
  for (const route of protectedRoutes) {
    if (xml.includes(`${route}/`)) failures.push(`Protected learning route appears in sitemap: ${route}.`);
  }
  if (xml.includes('benchmark/usd-impact-benchmark-dashboard')) failures.push('Draft benchmark route appears in sitemap.');
  if (xml.includes('internal/checklist-analytics')) failures.push('Checklist analytics dashboard appears in sitemap.');
}
if (failures.length > 0) { console.error(`Production build verification failed:\n${failures.join('\n')}`); process.exit(1); }
console.log('production build verification pass');
