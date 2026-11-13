import { CalendarHold, verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { explicitBlsMonthlyLabel, mentionsSupportedBlsSeries } from '../src/lib/publication-calendar-series.js';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { SOURCE_DATE_BASIS, sourceDateBasisForUrl, sourceDateAttributionIssue } from '../src/lib/source-date-basis.js';
import path from 'node:path';

const inputPath = process.argv[2];
const publish = process.argv.includes('--publish');
const reviewOnly = process.argv.includes('--review-only');
const skipPublished = process.argv.includes('--skip-published');
if (publish && reviewOnly) throw new Error('Choose --review-only or --publish, never both.');
if (!inputPath) {
  console.error('Usage: node scripts/import-catalyst-brief.mjs <bundle.json> [--review-only | --publish] [--skip-published]');
  process.exit(1);
}

const payload = JSON.parse(await readFile(inputPath, 'utf8'));
if (payload.publishable !== true) {
  console.log(`Catalyst Brief held: ${String(payload.holdReason ?? 'verification incomplete')}`);
  process.exit(0);
}

const requiredString = (object, key) => {
  const value = String(object?.[key] ?? '').trim();
  if (!value) throw new Error(`Missing required field: ${key}`);
  return value;
};
const quoted = (value) => JSON.stringify(String(value));
const isDate = (value) => {
  const raw = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(raw + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
};
// Source-ledger dates describe original documents, never a rolling page, an
// event's scheduled date or the day a crawler accessed an undated document.
function canonicalPublicationUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error('Catalyst Brief source URL is invalid'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('Catalyst Brief source URL must be a direct HTTPS URL without credentials');
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|gclid$|fbclid$|mc_)/i.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}
async function markdownFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file);
  }
  return files;
}
async function validateHistoricalSourceDates(candidateSources, outputPath) {
  const historical = new Map();
  for (const root of [path.resolve('src/content/news'), path.resolve('src/content/catalyst-briefs')]) {
    for (const file of await markdownFiles(root)) {
      if (path.resolve(file) === path.resolve(outputPath)) continue;
      const text = await readFile(file, 'utf8');
      for (const match of text.matchAll(/^\s+url:\s*["']([^"']+)["']\s*\r?\n\s+publishedAt:\s*["']([^"']+)["']\s*$/gm)) {
        if (!isDate(match[2])) continue;
        let url;
        try { url = canonicalPublicationUrl(match[1]); } catch { continue; }
        const dates = historical.get(url) ?? new Set();
        dates.add(match[2]);
        historical.set(url, dates);
      }
    }
  }
  for (const source of candidateSources) {
    const id = requiredString(source, 'id');
    const url = canonicalPublicationUrl(requiredString(source, 'url'));
    const dates = historical.get(url);
    if (!dates || dates.size === 0) continue;
    if (dates.size > 1) {
      throw new Error(`Source ${id} has conflicting historical publication dates for ${url}: ${[...dates].sort().join(', ')}`);
    }
    if (!dates.has(source.publishedAt)) {
      throw new Error(`Source ${id} publishedAt ${source.publishedAt} conflicts with previously verified ${[...dates][0]} for ${url}`);
    }
  }
}
const allowedAssets = new Set([
  'DXY', 'USD', 'EURUSD', 'Fed', 'U.S. rates', 'Liquidity', 'WTI', 'Brent',
  'Henry Hub', 'TTF', 'LNG', 'XAUUSD', 'BTCUSD', 'S&P 500', 'Nasdaq',
  'Dow', 'Russell 2000', 'NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'TSLA',
]);
const allowedStatusLabels = new Set(['scheduled-confirmed', 'rescheduled', 'cancelled', 'released']);
const list = (items, indent = 0) => items.map((item) => `${' '.repeat(indent)}- ${quoted(item)}`).join('\n');

const eventDate = requiredString(payload, 'eventDate');
const sourceEditionDate = requiredString(payload, 'sourceEditionDate');
if (!isDate(eventDate) || !isDate(sourceEditionDate)) throw new Error('Catalyst Brief dates must use YYYY-MM-DD');
const phase = requiredString(payload, 'phase');
if (!['preview', 'outcome'].includes(phase)) throw new Error('Catalyst Brief phase must be preview or outcome');
const statusLabel = requiredString(payload, 'statusLabel');
if (!allowedStatusLabels.has(statusLabel)) throw new Error('Catalyst Brief statusLabel is unsupported');
if (phase === 'preview' && statusLabel === 'released') throw new Error('A preview cannot have released status');
if (phase === 'outcome' && statusLabel === 'scheduled-confirmed') throw new Error('An outcome cannot have scheduled-confirmed status');

const slug = requiredString(payload, 'slug');
if (!/^\/news\/catalysts\/[a-z0-9-]+$/.test(slug)) throw new Error('Catalyst Brief slug is invalid');
const filename = `${slug.split('/').at(-1)}.md`;
const eventKey = requiredString(payload, 'eventKey');
if (!slug.endsWith(`${eventKey}-${phase}`)) throw new Error('Catalyst Brief slug must match eventKey and phase');

const assets = Array.isArray(payload.assets) ? [...new Set(payload.assets)] : [];
if (assets.length < 1 || assets.some((asset) => !allowedAssets.has(asset))) throw new Error('Catalyst Brief assets are invalid');
const sources = Array.isArray(payload.sources) ? payload.sources : [];
if (sources.length < 2) throw new Error('Catalyst Brief requires at least two sources');
const sourceIds = new Set();
const sourceUrls = new Set();
for (const source of sources) {
  const id = requiredString(source, 'id');
  if (sourceIds.has(id)) throw new Error(`Duplicate source id: ${id}`);
  sourceIds.add(id);
  const rawUrl = requiredString(source, 'url');
  const url = canonicalPublicationUrl(rawUrl);
  if (sourceUrls.has(url)) throw new Error(`Source ${id} reuses a duplicate source URL`);
  sourceUrls.add(url);
  if (!['primary', 'reporting'].includes(requiredString(source, 'sourceType'))) throw new Error(`Source ${id} has invalid sourceType`);
  if (!isDate(requiredString(source, 'publishedAt'))) throw new Error(`Source ${id} publishedAt must be a real YYYY-MM-DD date`);
  const attributionIssue = sourceDateAttributionIssue(rawUrl);
  if (attributionIssue) throw new Error(`Source ${id}: ${attributionIssue}`);
  const basis = sourceDateBasisForUrl(rawUrl);
  if (basis !== SOURCE_DATE_BASIS.PUBLISHED) {
    throw new Error(`Source ${id} uses mutable ${basis} material, not an independently dated original publication. Cite the exact verified dated document, never an event date, data-week ending date, prior citation date or access date; otherwise omit the source and claim.`);
  }
}
if (!sources.some((source) => source.sourceType === 'primary')) throw new Error('Catalyst Brief requires a primary source');

const verifiedFacts = Array.isArray(payload.verifiedFacts) ? payload.verifiedFacts : [];
if (verifiedFacts.length < 2 || verifiedFacts.length > 6) throw new Error('Catalyst Brief requires 2-6 verified facts');
for (const fact of verifiedFacts) {
  requiredString(fact, 'statement');
  if (!['verified-primary', 'verified-multiple'].includes(requiredString(fact, 'verification'))) throw new Error('Invalid fact verification');
  if (!Array.isArray(fact.sourceIds) || fact.sourceIds.length === 0 || fact.sourceIds.some((id) => !sourceIds.has(id))) {
    throw new Error('Verified fact has invalid sourceIds');
  }
}
const channels = Array.isArray(payload.transmissionChannels) ? payload.transmissionChannels : [];
if (channels.length < 2 || channels.length > 5) throw new Error('Catalyst Brief requires 2-5 transmission channels');
const whatToWatch = Array.isArray(payload.whatToWatch) ? payload.whatToWatch.map(String) : [];
if (whatToWatch.length < 3 || whatToWatch.length > 6) throw new Error('Catalyst Brief requires 3-6 watch items');

const lines = [
  '---',
  `title: ${quoted(requiredString(payload, 'title'))}`,
  `metaTitle: ${quoted(requiredString(payload, 'metaTitle'))}`,
  `metaDescription: ${quoted(requiredString(payload, 'metaDescription'))}`,
  `slug: ${quoted(slug)}`,
  `eventKey: ${quoted(eventKey)}`,
  `event: ${quoted(requiredString(payload, 'event'))}`,
  `eventDate: ${quoted(eventDate)}`,
  `calendar: ${JSON.stringify(payload.calendar ?? null)}`,
  `sourceEditionDate: ${quoted(sourceEditionDate)}`,
  `phase: ${quoted(phase)}`,
  `generatedAt: ${quoted(requiredString(payload, 'generatedAt'))}`,
  `lastReviewed: ${quoted(requiredString(payload, 'lastReviewed'))}`,
  `status: ${quoted(publish ? 'published' : 'review')}`,
  'category: "USD Impact Catalyst Brief"',
  `statusLabel: ${quoted(statusLabel)}`,
  `summary: ${quoted(requiredString(payload, 'summary'))}`,
  'assets:',
  list(assets, 2),
  'verifiedFacts:',
];
for (const fact of verifiedFacts) {
  lines.push(`  - statement: ${quoted(fact.statement)}`);
  lines.push(`    verification: ${quoted(fact.verification)}`);
  lines.push('    sourceIds:');
  lines.push(list(fact.sourceIds, 6));
}
lines.push('transmissionChannels:');
for (const channel of channels) {
  lines.push(`  - channel: ${quoted(requiredString(channel, 'channel'))}`);
  lines.push(`    conditionalImpact: ${quoted(requiredString(channel, 'conditionalImpact'))}`);
}
lines.push('whatToWatch:');
lines.push(list(whatToWatch, 2));
lines.push('sources:');
for (const source of sources) {
  lines.push(`  - id: ${quoted(source.id)}`);
  lines.push(`    title: ${quoted(source.title)}`);
  lines.push(`    publisher: ${quoted(source.publisher)}`);
  lines.push(`    url: ${quoted(source.url)}`);
  lines.push(`    publishedAt: ${quoted(source.publishedAt)}`);
  lines.push(`    sourceType: ${quoted(source.sourceType)}`);
}
lines.push(`complianceNote: ${quoted(requiredString(payload, 'complianceNote'))}`);
lines.push('---', '', requiredString(payload, 'body'), '');

const outputDirectory = path.resolve('src/content/catalyst-briefs');
const outputPath = path.join(outputDirectory, filename);
await mkdir(outputDirectory, { recursive: true });
let existing = '';
try {
  existing = await readFile(outputPath, 'utf8');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
if (existing && /^status:\s*"published"\s*$/m.test(existing)) {
  if (skipPublished) {
    console.log(`Published Catalyst Brief already exists at ${outputPath}; no changes made.`);
    process.exit(0);
  }
  throw new Error(`${outputPath} is already published and cannot be replaced by automation`);
}
if (existing) throw new Error(`${outputPath} already exists and requires editorial resolution`);

await validateHistoricalSourceDates(sources, outputPath);

if (publish || reviewOnly) {
  try {
    const supportedBls = explicitBlsMonthlyLabel(payload.event);
    if (!supportedBls && /\bBLS\b/i.test(String(payload.event ?? '')) && mentionsSupportedBlsSeries(payload.event)) {
      throw new CalendarHold('HOLD_IDENTITY_MISMATCH', 'A recognizable BLS series requires an explicit series and reference month/year label.');
    }
    if (supportedBls && !payload.calendar) {
      throw new CalendarHold('HOLD_MISSING_CALENDAR_RECORD', 'A supported BLS Catalyst Brief requires a canonical calendar record.');
    }
    if (payload.calendar) {
      const decision = await verifyPublicationCalendar({
        ...payload.calendar,
        event: payload.event,
        phase,
        statusLabel,
      });
      if (decision.decision !== 'PASS') throw new CalendarHold(decision.decision, decision.reason);
      console.log(JSON.stringify({ boundary: 'before-brief-import', ...decision }));
    }
  } catch (error) {
    console.error(JSON.stringify({ decision: error?.code ?? 'HOLD_INTERNAL_ERROR', reason: error?.message ?? 'Calendar verification failed.' }));
    process.exit(2);
  }
}

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Imported Catalyst Brief to ${outputPath} with status ${publish ? 'published' : 'review'}${reviewOnly ? ' (calendar-verified review-only)' : ''}.`);
