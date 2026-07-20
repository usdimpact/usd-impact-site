import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const checklistRoute = path.join(
  distRoot,
  'lead-magnets',
  'weekly-dollar-regime-checklist',
  'index.html',
);
const checklistDownload = '/downloads/USD_Impact_Weekly_Dollar_Regime_Checklist_Lead_Magnet.pdf';
const checklistPdf = path.join(distRoot, checklistDownload.replace(/^\//, ''));
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
];

const failures = [];

for (const route of requiredRoutes) {
  if (!fs.existsSync(path.join(distRoot, route))) {
    failures.push(`Missing published route in production build: /${route.replace(/index\.html$/, '')}`);
  }
}

if (!fs.existsSync(checklistRoute)) {
  failures.push('Checklist landing page was not generated.');
} else {
  const checklistHtml = fs.readFileSync(checklistRoute, 'utf8');
  if (!checklistHtml.includes(`href="${checklistDownload}"`)) {
    failures.push(`Checklist landing page does not link directly to ${checklistDownload}.`);
  }
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
}

if (failures.length > 0) {
  console.error(`Production build verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('production build verification pass');
