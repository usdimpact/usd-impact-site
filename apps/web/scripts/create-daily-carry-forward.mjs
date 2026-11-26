import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { SOURCE_DATE_BASIS, sourceDateBasisForUrl, sourceDateAttributionIssue } from '../src/lib/source-date-basis.js';
import { validateEditorialBundle } from '../src/lib/daily-news-editorial-validation.js';

// Deterministic carry-forward only. Never generate new market facts or request a provider.
// Both the archival article and each cited original document must be dated.
const MAX_SOURCE_AGE_DAYS = 14;
const MAX_ARCHIVE_EDITION_AGE_DAYS = 7;
const PRIMARY_HOSTS = new Set([
  'bls.gov', 'bea.gov', 'federalreserve.gov', 'treasury.gov', 'eia.gov',
  'newyorkfed.org', 'census.gov', 'stlouisfed.org', 'sec.gov',
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const dayMs = 86_400_000;

function day(value) {
  if (typeof value !== 'string' || !DATE.test(value)) throw new Error('invalid-utc-date');
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('invalid-utc-date');
  }
  return parsed.getTime();
}

function quote(value) {
  return JSON.stringify(String(value).replace(/[\r\n]+/g, ' ').trim());
}

function frontmatter(content) {
  const matched = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!matched) throw new Error('missing-archived-frontmatter');
  const obj = yaml.load(matched[1], { schema: yaml.JSON_SCHEMA });
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('invalid-archived-frontmatter');
  return obj;
}

function originalSourceDate(url, seenDates) {
  // A disagreement in the already published ledger is not immutable evidence.
  const dates = seenDates?.get(url);
  return !dates || dates.size === 1;
}

function eligibleSource(source, edition, seenDates) {
  if (!source || source.sourceType !== 'primary' || !ID.test(source.id || '') ||
      typeof source.title !== 'string' || !source.title.trim() ||
      source.title.length > 300 || typeof source.publisher !== 'string' ||
      typeof source.url !== 'string' || !DATE.test(String(source.publishedAt ?? ''))) return false;
  let url;
  try { url = new URL(source.url); } catch { return false; }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password ||
      ![...PRIMARY_HOSTS].some((host) => hostname === host || hostname.endsWith('.' + host)) ||
      sourceDateBasisForUrl(source.url) !== SOURCE_DATE_BASIS.PUBLISHED ||
      sourceDateAttributionIssue(source.url) || !originalSourceDate(source.url, seenDates)) return false;
  try {
    const age = (day(edition) - day(source.publishedAt)) / dayMs;
    return age >= 0 && age <= MAX_SOURCE_AGE_DAYS;
  } catch { return false; }
}

export function buildCarryForward({ editionDate, archive, archiveDate, seenDates = new Map(),
  generatedAt = new Date().toISOString() }) {
  const edition = day(editionDate);
  if (day(archiveDate) >= edition ||
      (edition - day(archiveDate)) / dayMs > MAX_ARCHIVE_EDITION_AGE_DAYS ||
      archive?.status !== 'published' || archive?.date !== archiveDate ||
      !Array.isArray(archive?.sources) || !Array.isArray(archive?.highlights)) {
    throw new Error('missing-eligible-prior-edition');
  }
  const available = archive.sources.filter((source) => eligibleSource(source, editionDate, seenDates));
  const uniqueUrls = new Set();
  const selected = available.filter((source) => {
    if (uniqueUrls.has(source.url)) return false;
    uniqueUrls.add(source.url);
    return true;
  }).slice(0, 4);
  if (selected.length < 3) throw new Error('fewer-than-three-eligible-dated-primary-sources');

  const sources = selected.map((source) => ({
    id: source.id, title: source.title, publisher: source.publisher,
    url: source.url, publishedAt: source.publishedAt, sourceType: 'primary',
  }));
  if (new Set(sources.map((source) => source.id)).size !== sources.length) throw new Error('duplicate-source-id');

  const highlights = sources.map((source) => ({
    headline: 'Dated official context: ' + source.publisher.slice(0, 75) + ' (' + source.publishedAt + ')',
    development: 'The previously verified official document ' + quote(source.title) +
      ' was originally dated ' + source.publishedAt +
      '. It is presented here as historical context, not a new ' + editionDate + ' release.',
    whyItMatters: 'This separately dated document is a reference for assessing macroeconomic conditions and possible dollar or rate transmission. It does not establish a price reaction on ' + editionDate + '.',
    assets: ['USD', 'DXY', 'U.S. rates'],
    importance: 'medium',
    verification: 'verified-primary',
    sourceIds: [source.id],
  }));
  const summary = 'Carry-forward context for ' + editionDate +
    ': previously verified official documents originally dated ' +
    [...new Set(sources.map((source) => source.publishedAt))].sort().join(', ') +
    ' remain educational reference points. This review does not present the older documents as newly released or claim a live dollar or asset-price direction.';
  const body = '## Carry-forward editorial context\n\n' +
    'This ' + editionDate + ' edition draws solely on separately dated, previously published official documents from the ' +
    archiveDate + ' verified Daily. It is a contextual review, not a newly reported government release, a market-price update, or a trading recommendation.\n\n' +
    '## Original evidence dates\n\n' + sources.map((source) =>
      '- ' + source.publisher + ': ' + source.title + ' (original publication ' + source.publishedAt + ').'
    ).join('\n') + '\n\n## Interpretation boundaries\n\n' +
    'Official economic observations can inform USD, real-rate and funding expectations. ' +
    'They cannot establish a contemporaneous USD, commodity, equity or crypto direction without independently synchronized market data. ' +
    'No future event date or release outcome is inferred from an undated index or calendar.';

  validateEditorialBundle({ editionDate, sources, highlights, catalysts: [], summary, body });
  const arr = (values, indent) => values.map((value) => ' '.repeat(indent) + '- ' + quote(value)).join('\n');
  const lines = [
    '---',
    'title: ' + quote('Daily USD Impact — ' + editionDate + ': Verified carry-forward macro context'),
    'metaTitle: ' + quote('Daily USD Impact — ' + editionDate + ' | Verified Official Context'),
    'metaDescription: ' + quote('Dated official-source carry-forward for ' + editionDate + '; no new market-price reaction asserted.'),
    'slug: ' + quote('/news/' + editionDate),
    'date: ' + quote(editionDate),
    'generatedAt: ' + quote(generatedAt),
    'lastReviewed: ' + quote(editionDate),
    'status: "published"',
    'category: "Daily USD Impact"',
    'marketRegime: ' + quote('Carry-forward context from verified official documents; current market direction unverified.'),
    'summary: ' + quote(summary),
    'featured: true',
    'assets:',
    arr(['USD', 'DXY', 'U.S. rates'], 2),
    'highlights:',
  ];
  for (const h of highlights) {
    lines.push('  - headline: ' + quote(h.headline),
      '    development: ' + quote(h.development),
      '    whyItMatters: ' + quote(h.whyItMatters),
      '    assets:', arr(h.assets, 6),
      '    importance: "medium"',
      '    verification: "verified-primary"',
      '    sourceIds:', arr(h.sourceIds, 6));
  }
  lines.push('catalysts: []', 'sources:');
  for (const source of sources) {
    lines.push('  - id: ' + quote(source.id), '    title: ' + quote(source.title),
      '    publisher: ' + quote(source.publisher), '    url: ' + quote(source.url),
      '    publishedAt: ' + quote(source.publishedAt), '    sourceType: "primary"');
  }
  lines.push('complianceNote: "Educational and informational only. This content is not investment, financial, trading, legal, or tax advice and is not a recommendation to buy or sell any asset."',
    '---', '', body, '');
  return lines.join('\n');
}

async function loadArchivedNews(directory) {
  const filenames = (await readdir(directory))
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort().reverse();
  const archives = [];
  const seenDates = new Map();
  for (const name of filenames) {
    const doc = frontmatter(await readFile(path.join(directory, name), 'utf8'));
    const archiveDate = name.slice(0, 10);
    archives.push({ archiveDate, doc });
    for (const source of Array.isArray(doc.sources) ? doc.sources : []) {
      if (typeof source?.url !== 'string' || !DATE.test(String(source?.publishedAt ?? ''))) continue;
      const dates = seenDates.get(source.url) ?? new Set();
      dates.add(source.publishedAt);
      seenDates.set(source.url, dates);
    }
  }
  return { archives, seenDates };
}

async function main() {
  const editionDate = process.argv[2];
  if (day(editionDate) !== day(new Date().toISOString().slice(0, 10))) {
    throw new Error('automated-carry-forward-must-use-current-utc-day');
  }
  if ([0, 6].includes(new Date().getUTCDay())) throw new Error('not-a-weekday');
  const root = path.resolve('src/content/news');
  const dest = path.join(root, editionDate + '.md');
  const { archives, seenDates } = await loadArchivedNews(root);
  let candidate = '';
  for (const { archiveDate, doc } of archives) {
    if (archiveDate >= editionDate) continue;
    try {
      candidate = buildCarryForward({ editionDate, archive: doc, archiveDate, seenDates });
      break;
    } catch (error) {
      if (!/missing-eligible-prior-edition|fewer-than-three-eligible-dated-primary-sources/.test(String(error.message))) {
        throw error;
      }
    }
  }
  if (!candidate) throw new Error('no-eligible-carry-forward-evidence-hold');
  await writeFile(dest, candidate, { flag: 'wx', mode: 0o600 });
  console.log('Created one provenance-labeled, source-validated carry-forward Daily candidate: ' + editionDate);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
