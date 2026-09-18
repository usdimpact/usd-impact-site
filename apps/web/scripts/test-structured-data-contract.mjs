import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  articleStructuredData,
  newsArticleStructuredData,
  serializeStructuredData,
  structuredDataGraph,
} from '../src/lib/structured-data.js';
import { isSearchUtilityPath } from '../src/lib/search-utility-policy.js';

const news = newsArticleStructuredData({
  headline: 'Daily USD Impact',
  description: 'Daily macro and cross-asset evidence.',
  pathname: '/news/2026-09-18',
  datePublished: '2026-09-18',
  dateModified: '2026-09-18',
});

assert.equal(news['@type'], 'NewsArticle');
assert.equal(news.url, 'https://www.usd-impact.com/news/2026-09-18');
assert.equal(news.mainEntityOfPage['@id'], news.url);
assert.equal(news.publisher['@id'], ORGANIZATION_ID);
assert.equal(news.datePublished, '2026-09-18');

const catalyst = articleStructuredData({
  headline: 'FOMC catalyst brief',
  description: 'Evidence-bound catalyst analysis.',
  pathname: '/news/catalysts/example',
  dateModified: '2026-09-18',
});

assert.equal(catalyst['@type'], 'Article');
assert.equal(catalyst.datePublished, undefined);
assert.equal(catalyst.publisher['@id'], ORGANIZATION_ID);

const graph = structuredDataGraph([news, catalyst]);
assert.equal(graph['@context'], 'https://schema.org');
assert.equal(graph['@graph'][0]['@id'], ORGANIZATION_ID);
assert.equal(graph['@graph'][0].name, 'KELA LEADS S.R.L.');
assert.equal(graph['@graph'][0].alternateName, 'USD Impact');
assert.equal(graph['@graph'][1]['@id'], WEBSITE_ID);
assert.equal(graph['@graph'][1].publisher['@id'], ORGANIZATION_ID);

const unsafe = structuredDataGraph([
  articleStructuredData({
    headline: '</script><script>alert(1)</script>',
    description: 'Escaping regression fixture.',
    pathname: '/news/catalysts/escaping-fixture',
  }),
]);
const serialized = serializeStructuredData(unsafe);
assert.ok(!serialized.includes('</script>'));
assert.match(serialized, /\\u003c\/script>/);
assert.doesNotThrow(() => JSON.parse(serialized));

for (const utilityPath of ['/account/sign-in', '/checkout', '/email/confirm']) {
  assert.equal(isSearchUtilityPath(utilityPath), true, `${utilityPath} must remain a search utility route`);
}

const layout = fs.readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
assert.match(layout, /structuredDataJson = noindex \? null/);
assert.match(layout, /type="application\/ld\+json"/);
assert.match(layout, /set:html=\{structuredDataJson\}/);

const dailyPage = fs.readFileSync(new URL('../src/pages/news/[date].astro', import.meta.url), 'utf8');
assert.match(dailyPage, /newsArticleStructuredData/);
assert.match(dailyPage, /datePublished: entry\.data\.date/);
assert.match(dailyPage, /structuredData=\{structuredData\}/);

const catalystPage = fs.readFileSync(new URL('../src/pages/news/catalysts/[slug].astro', import.meta.url), 'utf8');
assert.match(catalystPage, /articleStructuredData/);
assert.doesNotMatch(catalystPage, /datePublished: entry\.data\.eventDate/);
assert.match(catalystPage, /structuredData=\{structuredData\}/);

console.log('Structured data contract checks passed.');
