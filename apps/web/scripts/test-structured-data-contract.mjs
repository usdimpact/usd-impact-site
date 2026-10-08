import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  articleStructuredData,
  newsArticleStructuredData,
  serializeStructuredData,
  structuredDataGraph,
  webPageStructuredData,
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
assert.equal(news.image, 'https://www.usd-impact.com/assets/logo/USDImpact_Horizontal_Color_NoTagline_2048.png');

const catalyst = articleStructuredData({
  headline: 'FOMC catalyst brief',
  description: 'Evidence-bound catalyst analysis.',
  pathname: '/news/catalysts/example',
  datePublished: '2026-09-18T12:00:00Z',
  dateModified: '2026-09-18',
});

assert.equal(catalyst['@type'], 'Article');
assert.equal(catalyst.datePublished, '2026-09-18T12:00:00Z');
assert.equal(catalyst.image, 'https://www.usd-impact.com/assets/logo/USDImpact_Horizontal_Color_NoTagline_2048.png');
assert.equal(catalyst.publisher['@id'], ORGANIZATION_ID);

const graph = structuredDataGraph([news, catalyst]);
assert.equal(graph['@context'], 'https://schema.org');
assert.equal(graph['@graph'][0]['@id'], ORGANIZATION_ID);
assert.equal(graph['@graph'][0].name, 'KELA LEADS S.R.L.');
assert.equal(graph['@graph'][0].alternateName, 'USD Impact');
assert.equal(graph['@graph'][1]['@id'], WEBSITE_ID);
assert.equal(graph['@graph'][1].publisher['@id'], ORGANIZATION_ID);
assert.deepEqual(graph['@graph'][1].inLanguage, ['en', 'es']);

const spanishPage = webPageStructuredData({
  url: 'https://www.usd-impact.com/es/start-here',
  title: 'Empieza aquí',
  description: 'Introducción educativa de USD Impact en español.',
  inLanguage: 'es',
});
assert.equal(spanishPage['@type'], 'WebPage');
assert.equal(spanishPage['@id'], spanishPage.url);
assert.equal(spanishPage.inLanguage, 'es');
assert.equal(spanishPage.isPartOf['@id'], WEBSITE_ID);

const spanishGraph = structuredDataGraph([news], {
  locale: 'es',
  url: spanishPage.url,
  title: spanishPage.name,
  description: spanishPage.description,
});
assert.equal(spanishGraph['@graph'][2]['@type'], 'WebPage');
assert.equal(spanishGraph['@graph'][2].inLanguage, 'es');
assert.equal(spanishGraph['@graph'][3]['@type'], 'NewsArticle');
assert.equal(spanishGraph['@graph'][3].inLanguage, 'es');

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
assert.match(layout, /structuredDataGraph\(structuredData, \{/);
assert.match(layout, /locale,/);
assert.match(layout, /url: canonicalUrl/);
assert.match(layout, /data-content-language=\{locale\}/);
assert.match(layout, /type="application\/ld\+json"/);
assert.match(layout, /set:html=\{structuredDataJson\}/);

const dailyPage = fs.readFileSync(new URL('../src/pages/news/[date].astro', import.meta.url), 'utf8');
assert.match(dailyPage, /newsArticleStructuredData/);
assert.match(dailyPage, /datePublished: entry\.data\.date/);
assert.match(dailyPage, /structuredData=\{structuredData\}/);

const catalystPage = fs.readFileSync(new URL('../src/pages/news/catalysts/[slug].astro', import.meta.url), 'utf8');
assert.match(catalystPage, /articleStructuredData/);
assert.match(catalystPage, /datePublished: entry\.data\.generatedAt/);
assert.doesNotMatch(catalystPage, /datePublished: entry\.data\.eventDate/);
assert.match(catalystPage, /structuredData=\{structuredData\}/);

console.log('Structured data contract checks passed.');
