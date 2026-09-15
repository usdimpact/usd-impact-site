import { createHash } from 'node:crypto';

const HEX = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const ARTICLE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const BUNDLE_SCHEMA = 'publication-render-inputs/v1';
const HOME_SECTION = /<section class="home-news">[\s\S]*?<\/section>/;
const NEWS_LATEST_SECTION = /<section class="latest-edition">[\s\S]*?<\/section>/;
const NEWS_ARCHIVE_SECTION = /<section class="edition-archive">[\s\S]*?<\/section>/g;
const ARCHIVE_SENTINEL = 'data-publication-guard-archive="true"';

export class PublicationBuildRendererError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationBuildRendererError';
    this.code = code;
  }
}
const fail = (code) => { throw new PublicationBuildRendererError(code); };
const need = (condition, code) => { if (!condition) fail(code); };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const attr = esc;
const xml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function verifyText(value, expected, code, max = 4_000_000) {
  need(typeof value === 'string' && Buffer.byteLength(value) <= max, code);
  need(HEX.test(expected ?? '') && hash(value) === expected, code);
  return value;
}

function publicationIndex(bundle) {
  need(bundle && bundle.schema === BUNDLE_SCHEMA && typeof bundle.siteOrigin === 'string'
    && /^https:\/\/[a-z0-9.-]+$/i.test(bundle.siteOrigin)
    && (bundle.buildCommitSha === null || SHA.test(bundle.buildCommitSha ?? '')), 'HOLD_RENDER_BUNDLE');
  need(Array.isArray(bundle.publications) && bundle.publications.length <= 500, 'HOLD_RENDER_BUNDLE');
  need(bundle.static && typeof bundle.static === 'object', 'HOLD_RENDER_BUNDLE');
  const byPath = new Map();
  for (const item of bundle.publications) {
    need(item && ARTICLE.test(item.path) && !byPath.has(item.path), 'HOLD_RENDER_BUNDLE');
    const source = verifyText(item.source, item.sourceSha256, 'HOLD_RENDER_SOURCE', 256_000);
    const html = verifyText(item.html, item.htmlSha256, 'HOLD_RENDER_ARTICLE');
    byPath.set(item.path, Object.freeze({ ...item, source, html }));
  }
  const homepageHtml = verifyText(bundle.static.homepageHtml, bundle.static.homepageSha256, 'HOLD_RENDER_HOME');
  const newsHtml = verifyText(bundle.static.newsHtml, bundle.static.newsSha256, 'HOLD_RENDER_NEWS');
  need(Array.isArray(bundle.static.sitemapBaseEntries)
    && bundle.static.sitemapBaseEntries.length <= 1000
    && bundle.static.sitemapBaseEntries.every((entry) => typeof entry === 'string' && Buffer.byteLength(entry) <= 32_000),
  'HOLD_RENDER_SITEMAP');
  return Object.freeze({ byPath, homepageHtml, newsHtml,
    sitemapBaseEntries: Object.freeze(bundle.static.sitemapBaseEntries.slice()) });
}

function sourceMap(item) {
  return new Map((item.sources ?? []).map((source) => [source.id, source]));
}
function verificationLabel(value) {
  return value === 'verified-primary' ? 'Primary-source verified' : 'Multi-source verified';
}
function highlightCard(highlight, sources) {
  const links = (highlight.sourceIds ?? []).map((id) => sources.get(id)).filter(Boolean)
    .map((source) => `<a href="${attr(source.url)}" target="_blank" rel="noreferrer">${esc(source.publisher)}</a>`)
    .join(' · ');
  const tags = (highlight.assets ?? []).map((asset) => `<span>${esc(asset)}</span>`).join('');
  return `<article class="news-highlight card"><div class="news-highlight-topline">`
    + `<span class="importance importance-${attr(highlight.importance)}">${esc(highlight.importance)} importance</span>`
    + `<span class="verification">${esc(verificationLabel(highlight.verification))}</span></div>`
    + `<h3>${esc(highlight.headline)}</h3><p>${esc(highlight.development)}</p>`
    + `<p class="why-it-matters"><strong>Why it matters:</strong> ${esc(highlight.whyItMatters)}</p>`
    + `<div class="asset-tags" aria-label="Affected assets">${tags}</div>`
    + `<p class="card-sources">Sources:${links}</p></article>`;
}
function formatDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  need(Number.isFinite(date.getTime()), 'HOLD_RENDER_ITEM');
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
function currentDaily(items) {
  return items.filter((item) => item.category === 'Daily USD Impact')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null;
}
function homepageNews(item) {
  if (!item) return '';
  const sources = sourceMap(item);
  const cards = (item.highlights ?? []).slice(0, 3).map((highlight) => highlightCard(highlight, sources)).join('');
  return `<section class="home-news"><div class="section-heading"><div><div class="eyebrow">Daily USD Impact</div>`
    + `<h2>Today’s market drivers</h2></div><a href="/news/">View all editions</a></div>`
    + `<div class="regime-panel"><span>Market regime</span><strong>${esc(item.marketRegime)}</strong><p>${esc(item.summary)}</p></div>`
    + `<div class="news-grid">${cards}</div><div class="button-row"><a class="button primary" href="${attr(item.slug)}">Read today’s edition</a></div></section>`;
}
function replaceHomeSection(html, section) {
  if (HOME_SECTION.test(html)) return html.replace(HOME_SECTION, section);
  need(html.includes('</main>'), 'HOLD_RENDER_HOME');
  return html.replace('</main>', `${section}</main>`);
}
function latestNewsSection(item) {
  if (!item) {
    return `<section class="empty-state card"><div class="eyebrow">Daily USD Impact</div>`
      + `<h2>Publication pipeline active</h2><p>No currently admitted Daily edition is available.</p></section>`;
  }
  const sources = sourceMap(item);
  const cards = (item.highlights ?? []).map((highlight) => highlightCard(highlight, sources)).join('');
  return `<section class="latest-edition"><div class="section-heading"><div><div class="eyebrow">Latest edition</div>`
    + `<h2>${esc(item.title)}</h2></div><p>${esc(formatDate(item.date))}</p></div>`
    + `<div class="regime-panel"><span>Market regime</span><strong>${esc(item.marketRegime)}</strong><p>${esc(item.summary)}</p></div>`
    + `<div class="news-grid">${cards}</div><div class="button-row"><a class="button primary" href="${attr(item.slug)}">Read the complete edition</a></div></section>`;
}
function archiveLabel(item) {
  if (item.phase === 'outcome') return 'Verified outcome';
  if (item.phase === 'preview') return item.publicationPresentation === 'archive'
    ? 'Historical pre-event analysis' : 'Pre-event analysis';
  return esc(item.marketRegime ?? 'Daily edition');
}
function catalystArchiveSection(items) {
  const briefs = items.filter((item) => item.category === 'USD Impact Catalyst Brief')
    .sort((a, b) => String(b.generatedAt ?? '').localeCompare(String(a.generatedAt ?? ''))).slice(0, 8);
  if (!briefs.length) return '';
  const links = briefs.map((item) => `<a href="${attr(item.slug)}"><span>${esc(formatDate(item.eventDate))}</span>`
    + `<strong>${esc(archiveLabel(item))}</strong><small>${esc(item.title)}</small></a>`).join('');
  return `<section class="edition-archive"><div class="section-heading"><div><div class="eyebrow">Event-driven research</div>`
    + `<h2>Important Catalyst Briefs</h2></div></div><div class="archive-list">${links}</div></section>`;
}
function dailyArchiveSection(items) {
  const editions = items.filter((item) => item.category === 'Daily USD Impact')
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  if (!editions.length) return '';
  const links = editions.map((item) => `<a href="${attr(item.slug)}"><span>${esc(formatDate(item.date))}</span>`
    + `<strong>${esc(item.marketRegime)}</strong><small>${esc(item.summary)}</small></a>`).join('');
  return `<section class="edition-archive"><div class="section-heading"><div><div class="eyebrow">Archive</div>`
    + `<h2>Previous editions</h2></div></div><div class="archive-list">${links}</div></section>`;
}
function replaceNewsArchiveSections(html, catalystSection, dailySection) {
  const matches = [...html.matchAll(NEWS_ARCHIVE_SECTION)];
  let output = html;
  let catalystReplaced = false;
  let dailyReplaced = false;
  for (const match of matches.reverse()) {
    const block = match[0];
    let replacement = block;
    if (block.includes('Important Catalyst Briefs')) { replacement = catalystSection; catalystReplaced = true; }
    else if (block.includes('Previous editions')) { replacement = dailySection; dailyReplaced = true; }
    if (replacement !== block) output = output.slice(0, match.index) + replacement + output.slice(match.index + block.length);
  }
  if (!catalystReplaced || !dailyReplaced) {
    need(output.includes('</main>'), 'HOLD_RENDER_NEWS');
    const additions = `${catalystReplaced ? '' : catalystSection}${dailyReplaced ? '' : dailySection}`;
    output = output.replace('</main>', `${additions}</main>`);
  }
  return output;
}
function renderNews(html, currentItems, archiveItems) {
  let output = NEWS_LATEST_SECTION.test(html)
    ? html.replace(NEWS_LATEST_SECTION, latestNewsSection(currentDaily(currentItems)))
    : html.replace('</main>', `${latestNewsSection(currentDaily(currentItems))}</main>`);
  output = replaceNewsArchiveSections(output, catalystArchiveSection(archiveItems), dailyArchiveSection(archiveItems));
  return output;
}
function injectHistoricalBanner(html, item) {
  if (!(item.phase === 'preview' && item.publicationPresentation === 'archive')) return html;
  if (html.includes(ARCHIVE_SENTINEL) || html.includes('class="catalyst-archive-note"')) return html;
  const banner = `<aside class="catalyst-archive-note" ${ARCHIVE_SENTINEL} aria-labelledby="publication-guard-archive-title">`
    + `<h2 id="publication-guard-archive-title">Historical pre-event briefing</h2>`
    + `<p>This page preserves analysis published before the scheduled release. The release deadline has passed; `
    + `treat the material below as historical context, not as a current pending-event description.</p></aside>`;
  const marker = '<main class="container"';
  const at = html.indexOf(marker);
  need(at >= 0, 'HOLD_RENDER_ARTICLE');
  const open = html.indexOf('>', at);
  need(open >= 0, 'HOLD_RENDER_ARTICLE');
  return `${html.slice(0, open + 1)}${banner}${html.slice(open + 1)}`;
}
function itemPublishedAt(item) {
  if (item.category === 'Daily USD Impact') return `${item.date}T12:00:00Z`;
  return item.generatedAt;
}
function feed(items, origin) {
  const publications = items.slice().sort((a, b) => String(itemPublishedAt(b)).localeCompare(String(itemPublishedAt(a)))).slice(0, 30);
  const rows = publications.map((item) => `\n    <item>\n      <title>${xml(item.title)}</title>\n      <link>${xml(origin + item.slug + '/')}</link>`
    + `\n      <guid isPermaLink="true">${xml(origin + item.slug + '/')}</guid>\n      <pubDate>${new Date(itemPublishedAt(item)).toUTCString()}</pubDate>`
    + `\n      <description>${xml(item.summary)}</description>\n    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n  <channel>\n    <title>Daily USD Impact</title>`
    + `\n    <link>${xml(origin)}/news/</link>\n    <description>Source-backed daily cross-asset market highlights from USD Impact.</description>`
    + `\n    <language>en</language>${rows}\n  </channel>\n</rss>`;
}
function latestJson(items) {
  const edition = currentDaily(items);
  const briefs = items.filter((item) => item.category === 'USD Impact Catalyst Brief')
    .sort((a, b) => String(b.generatedAt ?? '').localeCompare(String(a.generatedAt ?? ''))).slice(0, 10)
    .map((item) => ({ title: item.title, slug: item.slug, event: item.event, eventDate: item.eventDate,
      phase: item.phase, generatedAt: item.generatedAt, statusLabel: item.statusLabel, summary: item.summary }));
  const daily = edition ? {
    title: edition.title, slug: edition.slug, date: edition.date, generatedAt: edition.generatedAt,
    lastReviewed: edition.lastReviewed, marketRegime: edition.marketRegime, summary: edition.summary,
    assets: edition.assets, highlights: edition.highlights, catalysts: edition.catalysts, sources: edition.sources,
  } : null;
  return JSON.stringify({ edition: daily, catalystBriefs: briefs }, null, 2);
}
function sitemap(baseEntries, items, origin) {
  const rows = items.slice().sort((a, b) => String(a.slug).localeCompare(String(b.slug)))
    .map((item) => `<url><loc>${xml(origin + item.slug + '/')}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" `
    + `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" `
    + `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`
    + `${baseEntries.join('')}${rows.join('')}</urlset>`;
}

export function createPublicationBuildRenderer(bundle) {
  const index = publicationIndex(bundle);
  const sources = Object.freeze(bundle.publications.map((item) => item.source));
  async function loadSources() { return sources.slice(); }
  async function render(view, { surface, path } = {}) {
    need(view && typeof view === 'object', 'HOLD_RENDER_VIEW');
    if (surface === 'article') {
      need(Array.isArray(view.items) && view.items.length === 1 && view.items[0].slug === path, 'HOLD_RENDER_VIEW');
      const stored = index.byPath.get(path);
      need(stored, 'HOLD_RENDER_ARTICLE');
      return injectHistoricalBanner(stored.html, view.items[0]);
    }
    if (surface === 'homepage') {
      need(Array.isArray(view.items), 'HOLD_RENDER_VIEW');
      return replaceHomeSection(index.homepageHtml, homepageNews(currentDaily(view.items)));
    }
    if (surface === 'news-composite') {
      need(Array.isArray(view.currentItems) && Array.isArray(view.archiveItems), 'HOLD_RENDER_VIEW');
      return renderNews(index.newsHtml, view.currentItems, view.archiveItems);
    }
    if (surface === 'feed') {
      need(Array.isArray(view.items), 'HOLD_RENDER_VIEW');
      return feed(view.items, bundle.siteOrigin);
    }
    if (surface === 'latest-json') {
      need(Array.isArray(view.items), 'HOLD_RENDER_VIEW');
      return latestJson(view.items);
    }
    if (surface === 'sitemap') {
      need(Array.isArray(view.items), 'HOLD_RENDER_VIEW');
      return sitemap(index.sitemapBaseEntries, view.items, bundle.siteOrigin);
    }
    fail('HOLD_RENDER_SURFACE');
  }
  return Object.freeze({ schema: BUNDLE_SCHEMA, loadSources, render,
    publicationAuthorized: false, enforcementActive: false });
}

export const PUBLICATION_RENDER_INPUTS_SCHEMA = BUNDLE_SCHEMA;
