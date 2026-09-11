import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createDormantPublicationGuardFunction } from '../api/publication-guard.js';
import { createPublicationBuildRenderer } from '../src/lib/publication-build-renderer.js';
import { createRecordedPublicationHandler } from '../src/lib/publication-response-boundary.js';
import { SERVING_SCOPE } from '../src/lib/publication-serving-policy.js';
import {
  PUBLICATION_ROUTE_CANDIDATE,
  classifyPublicationHost,
  classifyPublicationPath,
  isPublicProductionAlias,
  publicationRouteCandidatePlan,
  resolvePublicationSurface,
  signDormantPreviewRouteEnvelope,
  verifyDormantPreviewRouteEnvelope,
} from '../src/lib/publication-route-candidate.js';
import { generatePublicationServingInputs } from './generate-publication-serving-inputs.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const releaseAt = '2026-09-11T12:30:00.000Z';
const releaseTime = Date.parse(releaseAt);
const previewPath = '/news/catalysts/cpi-august-preview';
const dailyPath = '/news/2026-09-11';
const environment = {
  PUBLICATION_GUARD_ROUTE_CANDIDATE: 'preview-dormant',
  PUBLICATION_GUARD_ROUTE_SECRET: 'fixture-route-secret-32-bytes-minimum-558',
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact', VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'publishing/558-calendar-validation', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'usd-impact-site-preview-fixture-usd-impact.vercel.app',
};
const calendar = { publisher: 'BLS', series: 'CPI', referencePeriod: '2026-08', releaseStage: 'initial',
  eventDate: '2026-09-11', releaseTime: '08:30', timeZone: 'America/New_York', releaseAt };
const frontmatter = (fields, body) => `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${body}`;
const dailySource = frontmatter({ status: 'published', slug: dailyPath, category: 'Daily USD Impact',
  title: 'Daily USD Impact — September 11, 2026', date: '2026-09-11', generatedAt: '2026-09-11T16:22:52Z',
  lastReviewed: '2026-09-11', marketRegime: 'fixture regime', summary: 'CURRENT_DAILY_SUMMARY', assets: ['DXY'],
  highlights: [{ headline: 'CURRENT_DAILY_HEADLINE', development: 'CURRENT_DAILY_DEVELOPMENT',
    whyItMatters: 'CURRENT_DAILY_WHY', assets: ['DXY'], importance: 'high', verification: 'verified-primary', sourceIds: ['source-one'] }],
  catalysts: [], sources: [{ id: 'source-one', title: 'Source one', publisher: 'BLS', url: 'https://www.bls.gov/',
    publishedAt: '2026-09-11', sourceType: 'primary' }] }, 'CURRENT_DAILY_BODY');
const previewSource = frontmatter({ status: 'published', slug: previewPath, category: 'USD Impact Catalyst Brief',
  title: 'August CPI — What to Watch', summary: 'PREVIEW_PENDING_SUMMARY', event: 'BLS Consumer Price Index (CPI) for August 2026',
  eventDate: '2026-09-11', phase: 'preview', generatedAt: '2026-09-09T11:53:51.682Z', lastReviewed: '2026-09-09',
  statusLabel: 'scheduled-confirmed', calendar }, 'PREVIEW_BODY_SAYS_PENDING');
const sources = [dailySource, previewSource];
const entries = sources.map((source) => ({ path: JSON.parse(source.match(/^slug: (.*)$/m)[1]), sourceSha256: digest(source) }))
  .sort((a, b) => a.path.localeCompare(b.path));
const dailyRecord = { ...SERVING_SCOPE, schema: 'publication-admission/v1', path: dailyPath, sourceSha256: digest(dailySource),
  state: 'admitted', basis: 'no-calendar-entries', calendarVerified: false, deploymentId: 'dpl_dailyfixture1', commitSha: 'b'.repeat(40),
  artifactSha256: 'c'.repeat(64), evidenceSha256: 'd'.repeat(64), calendarCheckedAt: new Date(releaseTime - 120_000).toISOString(),
  admittedAt: new Date(releaseTime - 90_000).toISOString(), calendarValidUntil: new Date(releaseTime + 300_000).toISOString(), previewDeadline: null };
const previewRecord = { ...SERVING_SCOPE, schema: 'publication-admission/v1', path: previewPath, sourceSha256: digest(previewSource),
  state: 'admitted', basis: 'calendar-verified', calendarVerified: true, deploymentId: 'dpl_previewfixture1', commitSha: 'b'.repeat(40),
  artifactSha256: 'c'.repeat(64), evidenceSha256: 'e'.repeat(64), calendarCheckedAt: new Date(releaseTime - 120_000).toISOString(),
  admittedAt: new Date(releaseTime - 90_000).toISOString(), calendarValidUntil: releaseAt, previewDeadline: releaseAt };
const records = new Map([[dailyPath, dailyRecord], [previewPath, previewRecord]]);
let clock = releaseTime + 1;
const authority = () => ({ ...SERVING_SCOPE, schema: 'publication-serving-authority/v1', target: 'production', exposure: 'public-approved',
  deploymentId: 'dpl_authorityfixture1', commitSha: 'f'.repeat(40), artifactSha256: '1'.repeat(64), historyRevision: 'fixture-revision-1',
  entries, manifestSha256: digest(JSON.stringify(entries)), legacyBaseline: null, observedAt: new Date(clock - 1_000).toISOString(),
  validUntil: new Date(clock + 9_000).toISOString() });
const readHistory = async ({ revision, entries: requested }) => ({ revision,
  records: requested.map((entry) => ({ ...entry, record: records.get(entry.path) ?? null })) });
const bundle = (() => {
  const homepageHtml = '<html><body><main><section class="home-news">HIDDEN_BUILD_HOME</section></main></body></html>';
  const newsHtml = '<html><body><main><section class="latest-edition">HIDDEN_BUILD_LATEST</section>'
    + '<section class="reports-promo card">WEEKLY_PRESERVED</section>'
    + '<section class="edition-archive"><h2>Important Catalyst Briefs</h2>HIDDEN_BUILD_CATALYSTS</section>'
    + '<section class="edition-archive"><h2>Previous editions</h2>HIDDEN_BUILD_DAILIES</section></main></body></html>';
  const dailyHtml = '<html><body><main class="container"><p>CURRENT_DAILY_BODY</p></main></body></html>';
  const previewHtml = '<html><body><main class="container"><p>PREVIEW_BODY_SAYS_PENDING</p></main></body></html>';
  return { schema: 'publication-render-inputs/v1', siteOrigin: 'https://www.usd-impact.com', buildCommitSha: environment.VERCEL_GIT_COMMIT_SHA,
    publications: [{ path: dailyPath, source: dailySource, sourceSha256: digest(dailySource), html: dailyHtml, htmlSha256: digest(dailyHtml) },
      { path: previewPath, source: previewSource, sourceSha256: digest(previewSource), html: previewHtml, htmlSha256: digest(previewHtml) }],
    static: { homepageHtml, homepageSha256: digest(homepageHtml), newsHtml, newsSha256: digest(newsHtml),
      sitemapBaseEntries: ['<url><loc>https://www.usd-impact.com/</loc></url>', '<url><loc>https://www.usd-impact.com/news/</loc></url>'] } };
})();

let groups = 0;
async function check(name, operation) { try { await operation(); groups += 1; } catch (error) {
  throw new Error(`Publication route candidate regression: ${name}`, { cause: error }); } }
const expectCode = (operation, code) => assert.throws(operation, (error) => error?.code === code);

await check('route and alias model matches the real site without activation', () => {
  const plan = publicationRouteCandidatePlan();
  assert.equal(plan.active, false); assert.equal(plan.productionActivation, 'not-implemented'); assert.equal(plan.enforcementActive, false);
  assert.deepEqual(resolvePublicationSurface('/news'), { kind: 'governed', surface: 'news-composite', path: '/news' });
  for (const [route, surface] of [['/', 'homepage'], ['/news/feed.xml', 'feed'], ['/news/latest.json', 'latest-json'],
    ['/sitemap-0.xml', 'sitemap'], [dailyPath, 'article'], [previewPath, 'article']]) assert.equal(resolvePublicationSurface(route)?.surface, surface);
  for (const route of ['/news/', '/news/index.html', `${dailyPath}/`, `${dailyPath}.html`, `${dailyPath}/index.html`, `${previewPath}/index.html`])
    assert.equal(classifyPublicationPath(route).kind, 'deny-static-alias');
  assert.equal(classifyPublicationPath('/learn/real-yield').kind, 'unrelated');
});
await check('all observed public Production aliases share one class and deployment hosts stay separate', () => {
  for (const host of PUBLICATION_ROUTE_CANDIDATE.publicProductionHosts) {
    assert.equal(isPublicProductionAlias(host), true);
    assert.equal(classifyPublicationHost(host, { VERCEL_ENV: 'production' }).kind, 'production-public-alias');
  }
  expectCode(() => classifyPublicationHost('usd-impact-site-abc123-usd-impact.vercel.app', { VERCEL_ENV: 'production' }), 'HOLD_ROUTE_HOST');
});
await check('Preview route envelope is exact-head bound, tamper-resistant and expires', () => {
  const signed = signDormantPreviewRouteEnvelope({ method: 'GET', host: environment.VERCEL_URL, path: previewPath,
    issuedAt: releaseTime, environment, secret: environment.PUBLICATION_GUARD_ROUTE_SECRET });
  const request = { method: 'GET', headers: { host: environment.VERCEL_URL, ...signed } };
  assert.equal(verifyDormantPreviewRouteEnvelope({ request, environment, secret: environment.PUBLICATION_GUARD_ROUTE_SECRET,
    now: () => releaseTime + 1 }).path, previewPath);
  const forged = { ...request, headers: { ...request.headers, 'x-usd-impact-publication-path': dailyPath } };
  expectCode(() => verifyDormantPreviewRouteEnvelope({ request: forged, environment, secret: environment.PUBLICATION_GUARD_ROUTE_SECRET,
    now: () => releaseTime + 1 }), 'HOLD_ROUTE_ENVELOPE');
  expectCode(() => verifyDormantPreviewRouteEnvelope({ request, environment, secret: environment.PUBLICATION_GUARD_ROUTE_SECRET,
    now: () => releaseTime + 10_001 }), 'HOLD_ROUTE_ENVELOPE_EXPIRED');
  const prod = { ...environment, VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' };
  expectCode(() => signDormantPreviewRouteEnvelope({ host: 'www.usd-impact.com', path: dailyPath, issuedAt: releaseTime,
    environment: prod, secret: prod.PUBLICATION_GUARD_ROUTE_SECRET }), 'HOLD_ROUTE_ENVIRONMENT');
});

await check('build renderer covers homepage, composite news, articles, feeds and sitemap', async () => {
  const renderer = createPublicationBuildRenderer(bundle);
  const daily = { status: 'published', slug: dailyPath, category: 'Daily USD Impact', title: 'Daily title', date: '2026-09-11',
    generatedAt: '2026-09-11T16:22:52Z', lastReviewed: '2026-09-11', marketRegime: 'regime', summary: 'daily summary', assets: [],
    highlights: [{ headline: 'CURRENT_DAILY_HEADLINE', development: 'dev', whyItMatters: 'why', assets: [], importance: 'high',
      verification: 'verified-primary', sourceIds: [] }], catalysts: [], sources: [], publicationPresentation: 'current' };
  const preview = { status: 'published', slug: previewPath, category: 'USD Impact Catalyst Brief', title: 'Preview title',
    eventDate: '2026-09-11', generatedAt: '2026-09-09T11:53:51.682Z', phase: 'preview', publicationPresentation: 'archive' };
  const home = await renderer.render({ items: [daily] }, { surface: 'homepage' });
  assert.match(home, /CURRENT_DAILY_HEADLINE/); assert.doesNotMatch(home, /HIDDEN_BUILD_HOME/);
  const news = await renderer.render({ currentItems: [daily], archiveItems: [daily, preview] }, { surface: 'news-composite' });
  assert.match(news, /Historical pre-event analysis/); assert.match(news, /WEEKLY_PRESERVED/);
  assert.doesNotMatch(news, /HIDDEN_BUILD_LATEST|HIDDEN_BUILD_CATALYSTS|HIDDEN_BUILD_DAILIES/);
  const article = await renderer.render({ items: [preview] }, { surface: 'article', path: previewPath });
  assert.match(article, /Historical pre-event briefing/); assert.match(article, /PREVIEW_BODY_SAYS_PENDING/);
  const feed = await renderer.render({ items: [daily] }, { surface: 'feed' });
  const latest = await renderer.render({ items: [daily] }, { surface: 'latest-json' });
  assert.doesNotMatch(feed, /cpi-august-preview|PREVIEW_PENDING/); assert.equal(JSON.parse(latest).catalystBriefs.length, 0);
  const sitemap = await renderer.render({ items: [daily, preview] }, { surface: 'sitemap' });
  assert.match(sitemap, /cpi-august-preview/); assert.match(sitemap, /<loc>https:\/\/www\.usd-impact\.com\/news\/<\/loc>/);
  const bad = structuredClone(bundle); bad.static.homepageHtml += 'tamper';
  assert.throws(() => createPublicationBuildRenderer(bad), (error) => error?.code === 'HOLD_RENDER_HOME');
});

async function withServer(handler, operation) {
  const tasks = [];
  const server = createServer((request, response) => { const task = Promise.resolve(handler(request, response)); tasks.push(task); task.catch(() => response.destroy()); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const send = ({ path: requestPath = '/api/publication-guard', method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: requestPath, method,
      headers: { Host: environment.VERCEL_URL, ...headers }, agent: false }, (response) => {
      const chunks = []; response.on('data', (chunk) => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode,
        headers: response.headers, body: Buffer.concat(chunks).toString('utf8') })); response.on('error', reject); });
    request.on('error', reject); request.end();
  });
  try { await operation(send); await Promise.all(tasks); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
const signedHeaders = (pathname, issuedAt = clock) => signDormantPreviewRouteEnvelope({ method: 'GET', host: environment.VERCEL_URL,
  path: pathname, issuedAt, environment, secret: environment.PUBLICATION_GUARD_ROUTE_SECRET });
const functionFor = (input = bundle) => createDormantPublicationGuardFunction({ environment, loadBundle: async () => input,
  loadAuthority: async () => authority(), readHistory, now: () => clock });

await check('dormant Function is non-public, commit-bound, no-store and exact-surface safe', async () => {
  await withServer(functionFor(), async (send) => {
    const direct = await send(); assert.equal(direct.status, 404); assert.equal(direct.headers['cache-control'], 'private, no-store');
    assert.doesNotMatch(direct.body, /CURRENT_DAILY|PREVIEW_BODY/);
  });
  await withServer(functionFor({ ...bundle, buildCommitSha: 'b'.repeat(40) }), async (send) => {
    const result = await send({ headers: signedHeaders('/news') }); assert.equal(result.status, 503); assert.doesNotMatch(result.body, /CURRENT_DAILY/);
  });
  await withServer(functionFor(), async (send) => {
    const news = await send({ headers: signedHeaders('/news') }); assert.equal(news.status, 200);
    assert.match(news.body, /CURRENT_DAILY_HEADLINE|CURRENT_DAILY_SUMMARY/); assert.match(news.body, /Historical pre-event analysis/);
    for (const header of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) assert.match(news.headers[header], /no-store/);
    assert.equal(news.headers.etag, undefined); assert.equal(news.headers['last-modified'], undefined);
    for (const route of ['/news/latest.json', '/news/feed.xml']) {
      const result = await send({ headers: signedHeaders(route) }); assert.equal(result.status, 200);
      assert.doesNotMatch(result.body, /cpi-august-preview|PREVIEW_PENDING|PREVIEW_BODY/);
    }
    const article = await send({ headers: signedHeaders(previewPath) }); assert.match(article.body, /Historical pre-event briefing/);
    const sitemap = await send({ headers: signedHeaders('/sitemap-0.xml') }); assert.match(sitemap.body, /cpi-august-preview/);
  });
});

await check('warm render crossing preview deadline discards stale current bytes and keeps archive', async () => {
  let dynamicClock = releaseTime - 1; let renders = 0;
  const handler = createRecordedPublicationHandler({ surface: 'news-composite', path: '/news', loadSources: async () => [previewSource],
    loadAuthority: async () => ({ ...authority(), observedAt: new Date(dynamicClock - 1_000).toISOString(), validUntil: new Date(dynamicClock + 9_000).toISOString() }),
    readHistory: async ({ revision, entries: requested }) => ({ revision, records: requested.map((entry) => ({ ...entry, record: previewRecord })) }),
    render: async (view) => { renders += 1; const text = JSON.stringify(view); if (renders === 1) dynamicClock = releaseTime; return text; },
    now: () => dynamicClock });
  await withServer(handler, async (send) => {
    const result = await send({ path: '/news', headers: { Host: 'example.test' } }); assert.equal(result.status, 200);
    const value = JSON.parse(result.body); assert.equal(value.currentItems.length, 0); assert.equal(value.archiveItems.length, 1);
    assert.equal(value.archiveItems[0].publicationPresentation, 'archive'); assert.equal(renders, 2);
    assert.equal(result.headers['cache-control'], 'private, no-store');
  });
});

await check('post-build generator keeps inputs private, excludes drafts and strips publication sitemap URLs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publication-inputs-'));
  try {
    for (const dir of ['src/content/news', 'src/content/catalyst-briefs', 'dist/news/2026-09-11', 'dist/news/catalysts/cpi-august-preview'])
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/content/news/2026-09-11.md'), dailySource);
    fs.writeFileSync(path.join(root, 'src/content/catalyst-briefs/cpi.md'), previewSource);
    fs.writeFileSync(path.join(root, 'src/content/catalyst-briefs/draft.md'), frontmatter({ status: 'draft',
      slug: '/news/catalysts/not-public', category: 'USD Impact Catalyst Brief' }, 'DRAFT_SECRET'));
    fs.writeFileSync(path.join(root, 'dist/index.html'), '<html>home</html>');
    fs.writeFileSync(path.join(root, 'dist/news/index.html'), '<html>news</html>');
    fs.writeFileSync(path.join(root, 'dist/news/2026-09-11/index.html'), '<html>daily</html>');
    fs.writeFileSync(path.join(root, 'dist/news/catalysts/cpi-august-preview/index.html'), '<html>preview</html>');
    fs.writeFileSync(path.join(root, 'dist/sitemap-0.xml'), '<?xml version="1.0"?><urlset><url><loc>https://www.usd-impact.com/learn/</loc></url>'
      + '<url><loc>https://www.usd-impact.com/news/2026-09-11/</loc></url>'
      + '<url><loc>https://www.usd-impact.com/news/catalysts/cpi-august-preview/</loc></url></urlset>');
    const result = generatePublicationServingInputs({ root });
    assert.match(result.output, /src[\\/]generated[\\/]publication-render-inputs\.generated\.js$/); assert.equal(result.publicationCount, 2);
    assert.equal(result.output.startsWith(path.join(root, 'dist')), false);
    const generated = await import(`${pathToFileURL(result.output).href}?t=${Date.now()}`);
    assert.equal(generated.PUBLICATION_RENDER_INPUTS.publications.length, 2);
    assert.equal(generated.PUBLICATION_RENDER_INPUTS.static.sitemapBaseEntries.length, 1);
    assert.doesNotMatch(fs.readFileSync(result.output, 'utf8'), /DRAFT_SECRET/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

await check('repository config does not activate public publication routing', () => {
  const vercel = fs.readFileSync(path.resolve('vercel.json'), 'utf8');
  const middleware = fs.readFileSync(path.resolve('middleware.js'), 'utf8');
  assert.doesNotMatch(vercel, /"destination"\s*:\s*"\/api\/publication-guard/);
  assert.doesNotMatch(middleware, /publication-route-candidate|publication-guard/);
});

console.log(`publication route candidate tests pass (${groups} groups)`);
