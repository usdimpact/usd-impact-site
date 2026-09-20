import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');

const routeFile = (route) => path.join(
  distRoot,
  route.replace(/^\/+|\/+$/g, ''),
  'index.html',
);

const readRoute = (route) => {
  const file = routeFile(route);
  assert.ok(fs.existsSync(file), `Expected generated route: ${route}`);
  return fs.readFileSync(file, 'utf8');
};

const jsonLdGraphs = (html) => (
  [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]))
);

const assertIdentity = (graph) => {
  assert.equal(graph['@context'], 'https://schema.org');
  const nodes = graph['@graph'];
  assert.ok(Array.isArray(nodes));
  assert.ok(nodes.some((node) => node['@type'] === 'Organization' && node.name === 'KELA LEADS S.R.L.'));
  assert.ok(nodes.some((node) => node['@type'] === 'WebSite' && node.name === 'USD Impact'));
  return nodes;
};

const dailyHtml = readRoute('/news/2026-09-16');
const dailyGraphs = jsonLdGraphs(dailyHtml);
assert.equal(dailyGraphs.length, 1, 'Daily page must emit exactly one JSON-LD graph.');
const dailyNodes = assertIdentity(dailyGraphs[0]);
const dailyArticle = dailyNodes.find((node) => node['@type'] === 'NewsArticle');
assert.ok(dailyArticle, 'Daily page must emit NewsArticle.');
assert.equal(dailyArticle.url, 'https://www.usd-impact.com/news/2026-09-16');
assert.equal(dailyArticle.datePublished, '2026-09-16');

const catalystRoute = '/news/catalysts/2026-09-15-fomc-meeting-and-press-conference-september-15-16-2026-preview';
const catalystHtml = readRoute(catalystRoute);
const catalystGraphs = jsonLdGraphs(catalystHtml);
assert.equal(catalystGraphs.length, 1, 'Catalyst page must emit exactly one JSON-LD graph.');
const catalystNodes = assertIdentity(catalystGraphs[0]);
const catalystArticle = catalystNodes.find((node) => node['@type'] === 'Article');
assert.ok(catalystArticle, 'Catalyst page must emit Article.');
assert.equal(catalystArticle.url, `https://www.usd-impact.com${catalystRoute}`);
assert.equal(catalystArticle.datePublished, undefined, 'Catalyst event date must not be emitted as publication date.');

const noindexHtml = readRoute('/book/read-the-dollar-first/companion');
assert.equal(
  jsonLdGraphs(noindexHtml).length,
  0,
  'Generated noindex Preview-only routes must not emit SEO structured data.',
);

console.log('Rendered structured data contract checks passed.');
