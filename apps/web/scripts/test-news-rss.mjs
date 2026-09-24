import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Import the actual endpoint, replacing only its two build-time dependencies.
// Fixtures stay in this process; no Astro build, filesystem content mutation,
// provider request, publication, or runtime clock is needed by this suite.
const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const fixtureUrl = dataModule(`
  export let hasCatalystBriefFiles = false;
  let collections = {};
  export const calls = [];
  export function configure(next, present) {
    collections = next;
    hasCatalystBriefFiles = present;
    calls.length = 0;
  }
  export async function getCollection(name) {
    calls.push(name);
    if (!Object.hasOwn(collections, name)) throw new Error('Unexpected collection');
    return collections[name];
  }
`);
const fixtures = await import(fixtureUrl);
const routeSource = await readFile(new URL('../src/pages/news/feed.xml.js', import.meta.url), 'utf8');
const dependencies = [
  "import { getCollection } from 'astro:content';",
  "import { hasCatalystBriefFiles } from '../../lib/catalyst-brief-content.js';",
];
let isolatedSource = routeSource;
for (const dependency of dependencies) {
  assert.equal(isolatedSource.split(dependency).length, 2, 'Dependency seam must occur exactly once');
  isolatedSource = isolatedSource.replace(dependency, dependency.replace(/from '[^']+';/, `from '${fixtureUrl}';`));
}
const { GET } = await import(dataModule(isolatedSource));
const origin = 'https://www.usd-impact.com';
const entry = (slug, extra = {}) => ({ data: {
  status: 'published', title: `Fixture ${slug}`, slug,
  date: '2026-09-24', generatedAt: '2026-09-24T15:00:45Z',
  summary: 'Synthetic educational summary.', ...extra,
} });
const freeze = (value) => {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freeze(child);
  }
  return Object.freeze(value);
};
const items = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
const links = (xml) => items(xml).map((item) => item.match(/<link>([^<]+)<\/link>/)?.[1]);
const noClaimedTimes = (xml) => {
  assert.doesNotMatch(xml, /<(?:[\w.-]+:)?(?:pubDate|lastBuildDate|published|updated|date)(?:\s|>)/i);
  assert.doesNotMatch(xml, /Invalid Date|\bGMT\b|T\d{2}:\d{2}:\d{2}/);
};
async function render(news = [], catalysts = [], present = true, site = new URL(origin)) {
  fixtures.configure({ news, catalystBriefs: catalysts }, present);
  const response = await GET({ site });
  return { response, xml: await response.text() };
}

await test('Daily omits synthetic noon and does not substitute preparation time', async () => {
  const { xml } = await render([entry('/news/2026-09-24')]);
  noClaimedTimes(xml);
  assert.equal(items(xml).length, 1);
  assert.deepEqual(links(xml), [`${origin}/news/2026-09-24/`]);
});

await test('Catalyst preparation time is not serialized as publication time', async () => {
  const { xml } = await render([], [entry('/news/catalysts/fixture')]);
  noClaimedTimes(xml);
  assert.equal(items(xml).length, 1);
});

await test('Pre-session preparation on the prior day does not change the Daily identity', async () => {
  const { xml } = await render([entry('/news/2026-09-24', { generatedAt: '2026-09-23T22:00:00Z' })]);
  noClaimedTimes(xml);
  assert.deepEqual(links(xml), [`${origin}/news/2026-09-24/`]);
});

await test('Empty or malformed preparation strings are never converted to public dates', async () => {
  for (const generatedAt of ['', 'not-a-timestamp', '2026-02-30T12:00:00Z']) {
    const { xml } = await render([entry('/news/day', { generatedAt })], [entry('/news/catalysts/check', { generatedAt })]);
    noClaimedTimes(xml);
    assert.equal(items(xml).length, 2);
  }
});

await test('Unverified publication-looking metadata cannot enable date emission', async () => {
  const metadata = { publishedAt: '2026-09-24T15:17:01Z', lastReviewed: '2026-09-25', buildTime: '2026-09-25T09:00:00Z' };
  const { xml } = await render([entry('/news/day', metadata)], [entry('/news/catalysts/check', metadata)]);
  noClaimedTimes(xml);
});

await test('Existing mixed Daily/Catalyst ordering and equal-key stability are preserved', async () => {
  const { xml } = await render([
    entry('/news/older', { date: '2026-09-23', generatedAt: '2026-09-25T20:00:00Z' }),
    entry('/news/today'),
  ], [
    entry('/news/catalysts/morning', { generatedAt: '2026-09-24T08:00:00Z' }),
    entry('/news/catalysts/afternoon', { generatedAt: '2026-09-24T15:00:00Z' }),
    entry('/news/catalysts/tie', { generatedAt: '2026-09-24T12:00:00Z' }),
  ]);
  assert.deepEqual(links(xml), ['catalysts/afternoon', 'today', 'catalysts/tie', 'catalysts/morning', 'older'].map((slug) => `${origin}/news/${slug}/`));
  noClaimedTimes(xml);
});

await test('Only published entries enter the feed in either collection', async () => {
  const statuses = ['draft', 'review', 'ready-for-build', 'published'];
  const { xml } = await render(
    statuses.map((status) => entry(`/news/${status}`, { status })),
    statuses.map((status) => entry(`/news/catalysts/${status}`, { status })),
  );
  assert.deepEqual(new Set(links(xml)), new Set([`${origin}/news/published/`, `${origin}/news/catalysts/published/`]));
});

await test('Thirty-item cap is applied after filtering and ordering both collections', async () => {
  const news = Array.from({ length: 30 }, (_, index) => {
    const date = `2026-09-${String(index + 1).padStart(2, '0')}`;
    return entry(`/news/${date}`, { date });
  });
  const { xml } = await render(news, [entry('/news/catalysts/final', { generatedAt: '2026-09-30T16:00:00Z' })]);
  assert.equal(items(xml).length, 30);
  assert.equal(links(xml)[0], `${origin}/news/catalysts/final/`);
  assert.equal(links(xml).at(-1), `${origin}/news/2026-09-02/`);
  assert.equal(new Set(links(xml)).size, 30);
});

await test('GUIDs remain permalink identifiers equal to the unchanged item links', async () => {
  const { xml } = await render([entry('/news/2026-09-24')], [entry('/news/catalysts/fixture')]);
  for (const item of items(xml)) {
    assert.equal(item.match(/<guid isPermaLink="true">([^<]+)<\/guid>/)?.[1], item.match(/<link>([^<]+)<\/link>/)?.[1]);
  }
});

await test('Titles, descriptions and XML escaping are preserved', async () => {
  const { xml } = await render([entry('/news/fixture', { title: 'A & B < C > D "Q" \'S\'', summary: '<script> & "quote" \'apostrophe\'' })]);
  assert.ok(xml.includes('<title>A &amp; B &lt; C &gt; D &quot;Q&quot; &apos;S&apos;</title>'));
  assert.ok(xml.includes('<description>&lt;script&gt; &amp; &quot;quote&quot; &apos;apostrophe&apos;</description>'));
  assert.doesNotMatch(xml, /<script>/i);
});

await test('RSS envelope, response status and cache/content headers are unchanged', async () => {
  const { response, xml } = await render();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/rss+xml; charset=utf-8');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=900');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">'));
  assert.ok(xml.includes(`<link>${origin}/news/</link>`));
  assert.ok(xml.endsWith('</channel>\n</rss>'));
  noClaimedTimes(xml);
});

await test('Missing Catalyst collection is not requested', async () => {
  const { xml } = await render([entry('/news/day')], [], false);
  assert.deepEqual(fixtures.calls, ['news']);
  assert.equal(items(xml).length, 1);
});

await test('Empty enabled collections produce a valid empty channel without dates', async () => {
  const { xml } = await render([], [], true);
  assert.deepEqual(fixtures.calls, ['news', 'catalystBriefs']);
  assert.equal(items(xml).length, 0);
  noClaimedTimes(xml);
});

await test('Fallback origin is unchanged', async () => {
  const { xml } = await render([entry('/news/day')], [], false, null);
  assert.deepEqual(links(xml), ['https://usd-impact.com/news/day/']);
});

await test('Frozen content is not mutated and repeated builds produce identical output', async () => {
  const news = freeze([entry('/news/day')]);
  const catalysts = freeze([entry('/news/catalysts/check')]);
  const before = JSON.stringify({ news, catalysts });
  const first = (await render(news, catalysts)).xml;
  const second = (await render(news, catalysts)).xml;
  assert.equal(first, second);
  assert.equal(JSON.stringify({ news, catalysts }), before);
  noClaimedTimes(first);
});

await test('The route does not manufacture dates from a clock or metadata', () => {
  assert.doesNotMatch(routeSource, /\bnew Date\s*\(|\bDate\.(?:now|parse)\s*\(/);
});

await test('Collection errors fail instead of being disguised as an empty successful feed', async () => {
  fixtures.configure({}, true);
  await assert.rejects(GET({ site: new URL(origin) }), /Unexpected collection/);
});

await test('Normal publishing validation includes this bounded child-process suite', async () => {
  const validator = await readFile(new URL('./validate-publishing.mjs', import.meta.url), 'utf8');
  assert.ok(validator.includes("new URL('./test-news-rss.mjs', import.meta.url)"));
  assert.match(validator, /spawnSync\(process\.execPath, \[rssTestPath\], \{\s*stdio: 'inherit',\s*shell: false,\s*timeout: 30_000,/);
  assert.ok(validator.includes('rssTest.error || rssTest.signal || rssTest.status !== 0'));
});

console.log('RSS publication-time contract: actual route tested with offline synthetic fixtures only.');
