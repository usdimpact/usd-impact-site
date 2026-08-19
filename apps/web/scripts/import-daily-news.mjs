import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2];
const replace = process.argv.includes('--replace');
const skipPublished = process.argv.includes('--skip-published');
const publish = process.argv.includes('--publish');
if (!inputPath) {
  console.error('Usage: node scripts/import-daily-news.mjs <bundle.json> [--replace] [--skip-published] [--publish]');
  process.exit(1);
}

const payload = JSON.parse(await readFile(inputPath, 'utf8'));
const allowedAssets = new Set([
  'DXY', 'USD', 'EURUSD', 'Fed', 'U.S. rates', 'Liquidity', 'WTI', 'Brent',
  'Henry Hub', 'TTF', 'LNG', 'XAUUSD', 'BTCUSD', 'S&P 500', 'Nasdaq',
  'Dow', 'Russell 2000', 'NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', 'TSLA',
]);
const allowedVerification = new Set(['verified-primary', 'verified-multiple']);
const allowedSourceType = new Set(['primary', 'reporting']);
const allowedCatalystEventType = new Set([
  'central-bank', 'inflation', 'labor', 'growth', 'liquidity', 'energy',
  'corporate', 'regulatory', 'geopolitical', 'other',
]);
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
const isHttps = (value) => /^https:\/\/[^\s]+$/.test(String(value));
const requiredString = (object, key) => {
  const value = String(object?.[key] ?? '').trim();
  if (!value) throw new Error(`Missing required field: ${key}`);
  return value;
};
const quoted = (value) => JSON.stringify(String(value));
const addDays = (value, days) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const date = requiredString(payload, 'date');
if (!isDate(date)) throw new Error('date must use YYYY-MM-DD');

const highlights = Array.isArray(payload.highlights) ? payload.highlights : [];
const catalysts = Array.isArray(payload.catalysts) ? payload.catalysts : [];
const sources = Array.isArray(payload.sources) ? payload.sources : [];
if (highlights.length < 3 || highlights.length > 7) throw new Error('highlights must contain 3-7 items');
if (sources.length < 2) throw new Error('sources must contain at least two items');

const sourceIds = new Set();
const sourceTypeById = new Map();
for (const source of sources) {
  const id = requiredString(source, 'id');
  if (sourceIds.has(id)) throw new Error(`Duplicate source id: ${id}`);
  sourceIds.add(id);
  if (!isHttps(requiredString(source, 'url'))) throw new Error(`Source ${id} must use HTTPS`);
  const sourceType = requiredString(source, 'sourceType');
  if (!allowedSourceType.has(sourceType)) throw new Error(`Invalid sourceType for ${id}`);
  sourceTypeById.set(id, sourceType);
}

for (const highlight of highlights) {
  requiredString(highlight, 'headline');
  requiredString(highlight, 'development');
  requiredString(highlight, 'whyItMatters');
  if (!['high', 'medium', 'low'].includes(requiredString(highlight, 'importance'))) throw new Error('Invalid highlight importance');
  if (!allowedVerification.has(requiredString(highlight, 'verification'))) throw new Error('Automated imports require verified-primary or verified-multiple');
  if (!Array.isArray(highlight.assets) || highlight.assets.length === 0) throw new Error('Each highlight requires affected assets');
  if (!Array.isArray(highlight.sourceIds) || highlight.sourceIds.length === 0) throw new Error('Each highlight requires sourceIds');
  for (const asset of highlight.assets) {
    if (!allowedAssets.has(asset)) throw new Error(`Unsupported asset label: ${asset}`);
  }
  for (const id of highlight.sourceIds) {
    if (!sourceIds.has(id)) throw new Error(`Unknown highlight source id: ${id}`);
  }
}

for (const catalyst of catalysts) {
  const catalystDate = requiredString(catalyst, 'date');
  if (!isDate(catalystDate)) throw new Error('Catalyst dates must use YYYY-MM-DD');
  if (catalystDate < date || catalystDate > addDays(date, 7)) throw new Error('Catalysts must be inside the next seven calendar days');
  requiredString(catalyst, 'event');
  if (!allowedCatalystEventType.has(requiredString(catalyst, 'eventType'))) throw new Error('Invalid catalyst eventType');
  const importance = requiredString(catalyst, 'importance');
  if (!['high', 'medium', 'low'].includes(importance)) throw new Error('Invalid catalyst importance');
  const impactScore = Number(catalyst.impactScore);
  if (!Number.isInteger(impactScore) || impactScore < 1 || impactScore > 5) throw new Error('Catalyst impactScore must be 1-5');
  requiredString(catalyst, 'whyItMatters');
  if (typeof catalyst.extraBrief !== 'boolean') throw new Error('Each catalyst requires an extraBrief boolean');
  if (catalyst.extraBrief !== (importance === 'high' && impactScore >= 4 && (catalyst.assets?.length ?? 0) >= 2)) {
    throw new Error('Catalyst extraBrief does not match the high-impact publication rule');
  }
  if (!Array.isArray(catalyst.assets)) throw new Error('Each catalyst requires an assets array');
  for (const asset of catalyst.assets) {
    if (!allowedAssets.has(asset)) throw new Error(`Unsupported catalyst asset label: ${asset}`);
  }
  if (!Array.isArray(catalyst.sourceIds) || catalyst.sourceIds.length === 0) throw new Error('Each catalyst requires sourceIds');
  for (const id of catalyst.sourceIds) {
    if (!sourceIds.has(id)) throw new Error(`Unknown catalyst source id: ${id}`);
  }
  if (!catalyst.sourceIds.some((id) => sourceTypeById.get(id) === 'primary')) {
    throw new Error('Each catalyst requires an authoritative primary schedule source');
  }
}

const list = (items, indent = 0) => items.map((item) => `${' '.repeat(indent)}- ${quoted(item)}`).join('\n');
const publicationStatus = publish ? 'published' : 'review';

const lines = [
  '---',
  `title: ${quoted(requiredString(payload, 'title'))}`,
  `metaTitle: ${quoted(payload.metaTitle ?? `${payload.title} | USD Impact`)}`,
  `metaDescription: ${quoted(requiredString(payload, 'metaDescription'))}`,
  `slug: ${quoted(`/news/${date}`)}`,
  `date: ${quoted(date)}`,
  `generatedAt: ${quoted(requiredString(payload, 'generatedAt'))}`,
  `lastReviewed: ${quoted(payload.lastReviewed ?? date)}`,
  `status: ${quoted(publicationStatus)}`,
  'category: "Daily USD Impact"',
  `marketRegime: ${quoted(requiredString(payload, 'marketRegime'))}`,
  `summary: ${quoted(requiredString(payload, 'summary'))}`,
  `featured: ${payload.featured === false ? 'false' : 'true'}`,
  'assets:',
  list(payload.assets ?? [...new Set(highlights.flatMap((highlight) => highlight.assets))], 2),
  'highlights:',
];

for (const highlight of highlights) {
  lines.push(`  - headline: ${quoted(highlight.headline)}`);
  lines.push(`    development: ${quoted(highlight.development)}`);
  lines.push(`    whyItMatters: ${quoted(highlight.whyItMatters)}`);
  lines.push('    assets:');
  lines.push(list(highlight.assets, 6));
  lines.push(`    importance: ${quoted(highlight.importance)}`);
  lines.push(`    verification: ${quoted(highlight.verification)}`);
  lines.push('    sourceIds:');
  lines.push(list(highlight.sourceIds, 6));
}

if (catalysts.length === 0) {
  lines.push('catalysts: []');
} else {
  lines.push('catalysts:');
  for (const catalyst of catalysts) {
    lines.push(`  - date: ${quoted(catalyst.date)}`);
    lines.push(`    event: ${quoted(catalyst.event)}`);
    lines.push(`    eventType: ${quoted(catalyst.eventType)}`);
    lines.push('    assets:');
    lines.push(list(catalyst.assets ?? [], 6));
    lines.push(`    importance: ${quoted(catalyst.importance)}`);
    lines.push(`    impactScore: ${catalyst.impactScore}`);
    lines.push(`    extraBrief: ${catalyst.extraBrief ? 'true' : 'false'}`);
    lines.push(`    whyItMatters: ${quoted(catalyst.whyItMatters)}`);
    lines.push('    sourceIds:');
    lines.push(list(catalyst.sourceIds, 6));
  }
}

lines.push('sources:');
for (const source of sources) {
  lines.push(`  - id: ${quoted(source.id)}`);
  lines.push(`    title: ${quoted(source.title)}`);
  lines.push(`    publisher: ${quoted(source.publisher)}`);
  lines.push(`    url: ${quoted(source.url)}`);
  lines.push(`    publishedAt: ${quoted(source.publishedAt)}`);
  lines.push(`    sourceType: ${quoted(source.sourceType)}`);
}

lines.push(`complianceNote: ${quoted(payload.complianceNote ?? 'Educational and informational only. This content is not investment, financial, trading, legal, or tax advice and is not a recommendation to buy or sell any asset.')}`);
lines.push('---', '', String(payload.body ?? 'This edition was generated from a structured, source-backed input bundle.').trim(), '');

const outputDir = path.resolve('src/content/news');
const outputPath = path.join(outputDir, `${date}.md`);
await mkdir(outputDir, { recursive: true });

let existingContent = '';
try {
  existingContent = await readFile(outputPath, 'utf8');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (existingContent && /^status:\s*"published"\s*$/m.test(existingContent)) {
  if (skipPublished) {
    console.log(`Published Daily USD Impact edition already exists at ${outputPath}; no changes made.`);
    process.exit(0);
  }
  throw new Error(`${outputPath} is already published and cannot be replaced by automation`);
}

if (existingContent && !replace) {
  throw new Error(`${outputPath} already exists; pass --replace to update a non-published review`);
}

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Imported Daily USD Impact bundle to ${outputPath} with status ${publicationStatus}.`);
