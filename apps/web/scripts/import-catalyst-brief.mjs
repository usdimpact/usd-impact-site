import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputPath = process.argv[2];
const publish = process.argv.includes('--publish');
const skipPublished = process.argv.includes('--skip-published');
if (!inputPath) {
  console.error('Usage: node scripts/import-catalyst-brief.mjs <bundle.json> [--publish] [--skip-published]');
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
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
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
for (const source of sources) {
  const id = requiredString(source, 'id');
  if (sourceIds.has(id)) throw new Error(`Duplicate source id: ${id}`);
  sourceIds.add(id);
  if (!/^https:\/\//.test(requiredString(source, 'url'))) throw new Error(`Source ${id} must use HTTPS`);
  if (!['primary', 'reporting'].includes(requiredString(source, 'sourceType'))) throw new Error(`Source ${id} has invalid sourceType`);
  if (!isDate(requiredString(source, 'publishedAt'))) throw new Error(`Source ${id} publishedAt must use YYYY-MM-DD`);
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

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Imported Catalyst Brief to ${outputPath} with status ${publish ? 'published' : 'review'}.`);
