// R2 editorial preview contract. No paid generation, network or publish operation.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const routePath = fileURLToPath(new URL('../src/pages/macro-reviews/weekly/[review].astro', import.meta.url));
const siteConfigPath = fileURLToPath(new URL('../astro.config.mjs', import.meta.url));
const unauthorizedDateRoute = fileURLToPath(new URL('../src/pages/macro-reviews/weekly/2026-11-06/index.astro', import.meta.url));
const priorWeeklyRoute = fileURLToPath(new URL('../src/pages/macro-reviews/weekly/2026-10-30/index.astro', import.meta.url));
const src = readFileSync(routePath, 'utf8'), config = readFileSync(siteConfigPath, 'utf8');
const issuer = [
  'https://www.bls.gov/news.release/archives/jolts_11032026.htm',
  'https://home.treasury.gov/news/press-releases/sb0678',
  'https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026',
  'https://www.bls.gov/news.release/archives/prod2_11052026.htm',
  'https://www.bls.gov/news.release/archives/empsit_11062026.htm',
];
function validate(route, sitemap) {
  assert.ok(route.startsWith('---\n'), 'Use a gated Astro dynamic page');
  assert.ok(route.includes("if (process.env.VERCEL_ENV !== 'preview') return [];"), 'Production and unknown environments must render zero paths');
  assert.ok(route.includes("params: { review: 'review-2026-11-06-r2' }"), 'Only unique preview-only path is allowed');
  assert.ok(route.includes('<!doctype html>') && route.includes('<html lang="en">'));
  assert.ok(route.includes('data-preview-only="true"'));
  assert.ok(route.includes('data-publication-state="draft-source-not-served"'));
  assert.ok(route.includes('UNPUBLISHED REVIEW PREVIEW'));
  assert.ok(route.includes('data-review-prepared-date="2026-11-13"'), 'Show real draft review date without backdating publication');
  assert.ok(route.includes('Public first-publication date:</strong> Not assigned — unpublished Preview'), 'No invented first-publication timestamp');
  assert.ok(route.includes('Among the official developments selected for this educational review'), 'Selected examples must not claim exhaustiveness');
  assert.ok(!route.includes('This week brought two U.S. labor releases'), 'Remove misleading exhaustive weekly framing');
  assert.ok(!route.includes('Any public release requires an accountable editor to approve'), 'Public AI disclosure must not contain internal workflow text');
  assert.ok(route.includes('a:focus-visible { outline: 3px solid var(--navy);'), 'Links on light surfaces need dark focus ring');
  assert.ok(route.includes('.hero a:focus-visible, .site-header a:focus-visible { outline-color: #f4e2bc; }'), 'Links on dark surfaces need light focus ring');
  assert.ok(route.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"'));
  assert.ok(route.includes('name="googlebot" content="noindex,nofollow,noarchive,nosnippet"'));
  assert.ok(route.includes('name="referrer" content="no-referrer"'));
  assert.ok(route.includes('data-period-end="2026-11-06"'));
  assert.ok(route.includes('as reviewed on November 13, all three announced November 9, 10 and 12 auction dates have passed'));
  assert.ok(route.includes('After-period Treasury chronology'));
  assert.ok(!route.includes('05 / Next official milestones'));
  assert.ok(!route.includes('<script') && !route.includes('<iframe') && !route.includes('<form') && !route.includes('<img'), 'No active third-party content or embeds');
  const links = route.split('href="https://').slice(1).map(item => 'https://' + item.split('"')[0]);
  assert.equal(links.length, 10, 'Five originals must each be cited twice');
  assert.deepEqual([...new Set(links)].sort(), issuer.slice().sort());
  const sections = route.split('<section aria-labelledby="').slice(1).map(item => item.split('"')[0]);
  assert.deepEqual(sections, ['summary', 'timeline', 'transmission', 'mistakes', 'watch', 'sources', 'compliance']);
  const times = route.split('<time datetime="').slice(1).map(item => item.split('"')[0]);
  assert.deepEqual(times, ['2026-11-03','2026-11-04','2026-11-04','2026-11-05','2026-11-06']);
  assert.ok(route.includes('AI-assisted preparation.') && route.includes('KELA LEADS S.R.L.'));
  assert.ok(sitemap.includes("'/macro-reviews/weekly/review-2026-11-06-r2'"), 'Review preview must be excluded from sitemap in all environments');
  assert.equal(existsSync(unauthorizedDateRoute), false, 'No public Nov 6 dated Weekly route');
  assert.equal(existsSync(priorWeeklyRoute), true, 'Prior public Oct 30 independent Weekly is retained');
  return true;
}
function relativeLuminance(hex) {
  const values = hex.slice(1).match(/.{2}/g).map(x => parseInt(x,16)/255);
  const [r,g,b] = values.map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function focusContrast(a,b) {
  const v = [relativeLuminance(a),relativeLuminance(b)].sort((x,y)=>x-y);
  return (v[1]+0.05)/(v[0]+0.05);
}
assert.ok(src.includes('--navy: #071a33;') && src.includes('--gold: #c9a35b;'));
for (const [outline,bg] of [
  ['#071a33','#ffffff'],
  ['#071a33','#f7f8fa'],
  ['#f4e2bc','#071a33'],
  ['#f4e2bc','#020a14'],
]) assert.ok(focusContrast(outline,bg) >= 3, 'Focus indicator boundary must exceed 3:1');

assert.equal(validate(src,config),true);
const mutants = [
  ['weaken production gate',src.replace("VERCEL_ENV !== 'preview'","VERCEL_ENV !== 'production'"),config],
  ['remove noindex',src.replace('name="robots" content="noindex,nofollow,noarchive,nosnippet"','name="robots" content="index,follow"'),config],
  ['remove attribution',src.replace('AI-assisted preparation.','Undisclosed preparation.'),config],
  ['invent upcoming auction',src.replace('all three announced November 9, 10 and 12 auction dates have passed','November 12 auction is upcoming'),config],
  ['corrupt week-end date',src.replace('data-period-end="2026-11-06"','data-period-end="2026-11-13"'),config],
  ['change issuer source',src.replace(issuer[0],'https://example.invalid/non-government-source'),config],
  ['inject external script',src.replace('</head>','<script src="https://example.invalid/analytics.js"></script></head>'),config],
  ['remove sitemap exclusion',src,config.replace("'/macro-reviews/weekly/review-2026-11-06-r2'","'/macro-reviews/weekly/not-this-preview'")],
  ['remove prepared-on date',src.replace('data-review-prepared-date="2026-11-13"','data-review-prepared-date="unknown"'),config],
  ['hide unpublished first-published boundary',src.replace('Public first-publication date:</strong> Not assigned — unpublished Preview','Public first-publication date:</strong> 6 Nov 2026'),config],
  ['reintroduce exhaustive release claim',src.replace('Among the official developments selected for this educational review','This week brought two U.S. labor releases'),config],
  ['restore internal AI workflow wording',src.replace('USD Impact is operated by KELA LEADS S.R.L.','USD Impact is operated by KELA LEADS S.R.L. Any public release requires an accountable editor to approve'),config],
  ['restore low-contrast gold focus',src.replace('a:focus-visible { outline: 3px solid var(--navy);','a:focus-visible { outline: 3px solid var(--gold);'),config],
  ['remove dark-surface contrast override',src.replace('.hero a:focus-visible, .site-header a:focus-visible { outline-color: #f4e2bc; }',''),config],
];
let rejected=0;
for (const [name,badSrc,badConfig] of mutants) {
  assert.ok(badSrc!==src || badConfig!==config, 'Mutation did not change inputs: '+name);
  assert.throws(()=>validate(badSrc,badConfig),{name:'AssertionError'},'Must fail '+name);
  rejected++;
}
console.log('Weekly Nov 6 R2 gated-preview source contract PASS: 1 positive and '+rejected+' negative fixtures');
