import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const checklistDownload = '/downloads/USD_Impact_Weekly_Dollar_Regime_Checklist_Lead_Magnet.pdf';
const bookRouteHref = '/book/read-the-dollar-first/';
const bookWaitlistHref = '/book/read-the-dollar-first/#book-waitlist';
const checklistPdf = path.join(distRoot, checklistDownload.replace(/^\//, ''));
const homepage = path.join(distRoot, 'index.html');
const bookPage = path.join(distRoot, 'book', 'read-the-dollar-first', 'index.html');
const privacyPage = path.join(distRoot, 'privacy', 'index.html');
const waitlistFunction = path.resolve('api', 'waitlist.js');
const dailyNewsSourceFunction = path.resolve('api', 'daily-news-source.js');
const benchmarkRoute = path.join(
  distRoot,
  'benchmark',
  'usd-impact-benchmark-dashboard',
  'index.html',
);
const sitemap = path.join(distRoot, 'sitemap-0.xml');

const requiredRoutes = [
  'start-here/index.html',
  'book/read-the-dollar-first/index.html',
  'framework/dollar-transmission-chain/index.html',
  'lead-magnets/weekly-dollar-regime-checklist/index.html',
  'privacy/index.html',
];

const requiredNewsOutputs = [
  'news/index.html',
  'news/2026-07-22/index.html',
  'news/feed.xml',
  'news/latest.json',
];

const downloadCtaPages = [
  'index.html',
  ...requiredRoutes.filter((route) => route !== 'privacy/index.html'),
];

const failures = [];

for (const route of requiredRoutes) {
  if (!fs.existsSync(path.join(distRoot, route))) {
    failures.push(`Missing published route in production build: /${route.replace(/index\.html$/, '')}`);
  }
}

for (const output of requiredNewsOutputs) {
  if (!fs.existsSync(path.join(distRoot, output))) {
    failures.push(`Missing Daily USD Impact output in production build: /${output.replace(/index\.html$/, '')}`);
  }
}

for (const route of downloadCtaPages) {
  const page = path.join(distRoot, route);
  if (!fs.existsSync(page)) {
    failures.push(`Cannot verify checklist CTA because the page is missing: /${route}`);
    continue;
  }

  const html = fs.readFileSync(page, 'utf8');
  if (!html.includes(`href="${checklistDownload}"`)) {
    failures.push(`Checklist CTA on /${route} does not link directly to ${checklistDownload}.`);
  }
}

if (!fs.existsSync(homepage)) {
  failures.push('Homepage was not generated.');
} else {
  const homepageHtml = fs.readFileSync(homepage, 'utf8');
  if (!homepageHtml.includes(`href="${bookWaitlistHref}"`)) {
    failures.push(`Homepage waitlist CTA does not link to ${bookWaitlistHref}.`);
  }
  if (!homepageHtml.includes('Join the book waitlist')) {
    failures.push('Homepage does not use the "Join the book waitlist" CTA label.');
  }
  if (!homepageHtml.includes('Daily USD Impact') || !homepageHtml.includes('href="/news/"')) {
    failures.push('Homepage does not expose the Daily USD Impact module and archive link.');
  }
}

if (!fs.existsSync(bookPage)) {
  failures.push('Book page was not generated.');
} else {
  const bookHtml = fs.readFileSync(bookPage, 'utf8');
  if (!bookHtml.includes('href="#book-waitlist"')) {
    failures.push('Book-page primary CTA does not target the embedded waitlist form.');
  }
  if (!bookHtml.includes('id="book-waitlist"') || !bookHtml.includes('data-waitlist-form')) {
    failures.push('Book page does not contain the waitlist form.');
  }
  if (!bookHtml.includes('/api/waitlist')) {
    failures.push('Book waitlist form does not submit to /api/waitlist.');
  }
  if (bookHtml.includes(`<a class="button primary" href="${bookRouteHref}">`)) {
    failures.push('Book-page primary CTA still links back to the book page itself.');
  }
}

if (!fs.existsSync(privacyPage)) {
  failures.push('Waitlist privacy notice was not generated.');
}

if (!fs.existsSync(waitlistFunction)) {
  failures.push('Vercel waitlist function is missing: api/waitlist.js');
}

if (!fs.existsSync(dailyNewsSourceFunction)) {
  failures.push('Vercel Daily USD Impact source function is missing: api/daily-news-source.js');
}

if (!fs.existsSync(checklistPdf)) {
  failures.push(`Checklist PDF is missing from production output: ${checklistDownload}`);
}

if (fs.existsSync(benchmarkRoute)) {
  failures.push('Draft benchmark route was generated in production output.');
}

if (!fs.existsSync(sitemap)) {
  failures.push('Generated sitemap-0.xml is missing.');
} else {
  const sitemapXml = fs.readFileSync(sitemap, 'utf8');
  if (sitemapXml.includes('benchmark/usd-impact-benchmark-dashboard')) {
    failures.push('Draft benchmark route appears in the generated sitemap.');
  }
  if (!sitemapXml.includes('/news/2026-07-22/')) {
    failures.push('Published Daily USD Impact edition is missing from the sitemap.');
  }
}

if (failures.length > 0) {
  console.error(`Production build verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('production build verification pass');
