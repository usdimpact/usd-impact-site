import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const checklistDownload = '/downloads/USD_Impact_Weekly_Dollar_Regime_Checklist_Lead_Magnet.pdf';
const bookRouteHref = '/book/read-the-dollar-first/';
const bookWaitlistHref = '/book/read-the-dollar-first/#book-waitlist';
const dollarLessonHref = '/dollar/what-is-the-us-dollar';
const dollarQuizHref = '/dollar/what-is-the-us-dollar/quiz';
const fxLessonHref = '/fx/fx-depreciation-vs-inflation';
const fxQuizHref = '/fx/fx-depreciation-vs-inflation/quiz';
const dxyLessonHref = '/dxy/what-is-dxy';
const dxyQuizHref = '/dxy/what-is-dxy/quiz';
const quizRoadmapHref = '/quiz/';
const startHereHref = '/start-here/';
const checklistPdf = path.join(distRoot, checklistDownload.replace(/^\//, ''));
const homepage = path.join(distRoot, 'index.html');
const bookPage = path.join(distRoot, 'book', 'read-the-dollar-first', 'index.html');
const dollarLessonPage = path.join(distRoot, 'dollar', 'what-is-the-us-dollar', 'index.html');
const dollarQuizPage = path.join(distRoot, 'dollar', 'what-is-the-us-dollar', 'quiz', 'index.html');
const fxLessonPage = path.join(distRoot, 'fx', 'fx-depreciation-vs-inflation', 'index.html');
const fxQuizPage = path.join(distRoot, 'fx', 'fx-depreciation-vs-inflation', 'quiz', 'index.html');
const dxyLessonPage = path.join(distRoot, 'dxy', 'what-is-dxy', 'index.html');
const dxyQuizPage = path.join(distRoot, 'dxy', 'what-is-dxy', 'quiz', 'index.html');
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
  'dollar/what-is-the-us-dollar/index.html',
  'fx/fx-depreciation-vs-inflation/index.html',
  'dxy/what-is-dxy/index.html',
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
  ...requiredRoutes.filter(
    (route) => ![
      'privacy/index.html',
      'dollar/what-is-the-us-dollar/index.html',
      'fx/fx-depreciation-vs-inflation/index.html',
      'dxy/what-is-dxy/index.html',
    ].includes(route),
  ),
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

if (!fs.existsSync(dollarLessonPage)) {
  failures.push('Dollar foundations lesson was not generated.');
} else {
  const lessonHtml = fs.readFileSync(dollarLessonPage, 'utf8');
  if (!lessonHtml.includes(`href="${dollarQuizHref}"`)) {
    failures.push(`Dollar lesson does not link to Quiz 2 at ${dollarQuizHref}.`);
  }
  if (!lessonHtml.includes('Take Quiz 2')) {
    failures.push('Dollar lesson does not expose the Take Quiz 2 CTA.');
  }
  if (!lessonHtml.includes(`href="${startHereHref}"`)) {
    failures.push(`Dollar lesson does not link back to ${startHereHref}.`);
  }
  if (lessonHtml.includes(`<a class="button secondary" href="${startHereHref}" download`)) {
    failures.push('Dollar lesson Start Here CTA is incorrectly marked as a download.');
  }
}

if (!fs.existsSync(dollarQuizPage)) {
  failures.push('Quiz 2 page was not generated.');
} else {
  const quizHtml = fs.readFileSync(dollarQuizPage, 'utf8');
  if (!quizHtml.includes(`href="${dollarLessonHref}"`)) {
    failures.push(`Quiz 2 does not expose its published lesson link at ${dollarLessonHref}.`);
  }
}

if (!fs.existsSync(fxLessonPage)) {
  failures.push('FX depreciation versus inflation lesson was not generated.');
} else {
  const lessonHtml = fs.readFileSync(fxLessonPage, 'utf8');
  if (!lessonHtml.includes('FX Depreciation vs Inflation: What Is the Difference?')) {
    failures.push('FX lesson title is missing from its generated page.');
  }
  if (!lessonHtml.includes(`href="${quizRoadmapHref}"`)) {
    failures.push(`FX lesson does not link to the quiz roadmap at ${quizRoadmapHref}.`);
  }
  if (!lessonHtml.includes(`href="${dollarLessonHref}"`)) {
    failures.push(`FX lesson does not link back to ${dollarLessonHref}.`);
  }
  if (lessonHtml.includes(`<a class="button secondary" href="${dollarLessonHref}" download`)) {
    failures.push('FX lesson return CTA is incorrectly marked as a download.');
  }
  if (!lessonHtml.includes('$100') || !lessonHtml.includes('$105')) {
    failures.push('FX lesson is missing the required domestic purchasing-power learning block.');
  }
}

if (!fs.existsSync(fxQuizPage)) {
  failures.push('Quiz 3 page was not generated.');
} else {
  const quizHtml = fs.readFileSync(fxQuizPage, 'utf8');
  if (!quizHtml.includes(`href="${fxLessonHref}"`)) {
    failures.push(`Quiz 3 does not expose its published lesson link at ${fxLessonHref}.`);
  }
  if (!quizHtml.includes('Quiz 3 of 12')) {
    failures.push('Quiz 3 numbering is missing from its generated page.');
  }
}

if (!fs.existsSync(dxyLessonPage)) {
  failures.push('DXY foundations lesson was not generated.');
} else {
  const lessonHtml = fs.readFileSync(dxyLessonPage, 'utf8');
  if (!lessonHtml.includes('What Is DXY?')) {
    failures.push('DXY lesson title is missing from its generated page.');
  }
  if (!lessonHtml.includes('57.6%') || !lessonHtml.includes('Japanese yen')) {
    failures.push('DXY lesson is missing the required basket-composition learning block.');
  }
  if (!lessonHtml.includes(`href="${fxQuizHref}"`)) {
    failures.push(`DXY lesson does not link back to Quiz 3 at ${fxQuizHref}.`);
  }
  if (!lessonHtml.includes(`href="${quizRoadmapHref}"`)) {
    failures.push(`DXY lesson does not link to the quiz roadmap at ${quizRoadmapHref}.`);
  }
}

if (fs.existsSync(dxyQuizPage)) {
  failures.push(`Unreleased Quiz 4 was generated at ${dxyQuizHref}.`);
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
  if (!sitemapXml.includes(`${dollarLessonHref}/`)) {
    failures.push('Dollar foundations lesson is missing from the sitemap.');
  }
  if (!sitemapXml.includes(`${fxLessonHref}/`)) {
    failures.push('FX depreciation versus inflation lesson is missing from the sitemap.');
  }
  if (!sitemapXml.includes(`${fxQuizHref}/`)) {
    failures.push('Released Quiz 3 is missing from the sitemap.');
  }
  if (!sitemapXml.includes(`${dxyLessonHref}/`)) {
    failures.push('DXY foundations lesson is missing from the sitemap.');
  }
  if (sitemapXml.includes(`${dxyQuizHref}/`)) {
    failures.push('Unreleased Quiz 4 appears in the sitemap.');
  }
}

if (failures.length > 0) {
  console.error(`Production build verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('production build verification pass');