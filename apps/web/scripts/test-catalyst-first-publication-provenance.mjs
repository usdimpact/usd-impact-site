// Offline compatibility and fail-closed future publication contract.
// No Vercel, GitHub, provider, paid model or network calls; one temp fixture is cleaned.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  LEGACY_CATALYST_PUBLICATION_PINS,
  isPinnedLegacyCatalyst,
  catalystFirstPublicationIssue,
  catalystArticleDatePublished,
  catalystArticleDateModified,
} from '../src/lib/catalyst-first-publication-policy.js';

const root = fileURLToPath(new URL('../src/content/catalyst-briefs/', import.meta.url));
const schema = readFileSync(fileURLToPath(new URL('../src/content.config.ts', import.meta.url)), 'utf8');
const renderer = readFileSync(fileURLToPath(new URL('../src/pages/news/catalysts/[slug].astro', import.meta.url)), 'utf8');
const newsLanding = readFileSync(fileURLToPath(new URL('../src/pages/news/index.astro', import.meta.url)), 'utf8');
const rss = readFileSync(fileURLToPath(new URL('../src/pages/news/feed.xml.js', import.meta.url)), 'utf8');
const latestJson = readFileSync(fileURLToPath(new URL('../src/pages/news/latest.json.js', import.meta.url)), 'utf8');
const files = readdirSync(root).filter(x => x.endsWith('.md')).sort();
const today = { todayUtc: '2026-11-13' };
const readFrontmatter = filename => {
  const raw = readFileSync(fileURLToPath(new URL('../src/content/catalyst-briefs/'+filename, import.meta.url)), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, 'Missing content frontmatter '+filename);
  return yaml.load(match[1]);
};

// Existing published content must retain all its old URL and JSON-LD semantics.
// The pins are a bounded, fixed legacy exception, never a dynamically refreshed list.
assert.equal(LEGACY_CATALYST_PUBLICATION_PINS.length, 15);
assert.equal(new Set(LEGACY_CATALYST_PUBLICATION_PINS.map(x => x.slug)).size, 15);
const records = files.map(name => ({ name, data: readFrontmatter(name) }));
const legacyRecords = records.filter(({ data }) => data.status === 'published' && isPinnedLegacyCatalyst(data));
const allLegacy = legacyRecords.map(({ data }) => data);
assert.equal(legacyRecords.length, 15, 'All fifteen pinned historical public records must remain intact');
for (const { name, data: entry } of legacyRecords) {
  assert.equal(entry.firstPublishedDate, undefined, 'Do not auto-backfill legacy first-publication claims: '+name);
  assert.equal(catalystFirstPublicationIssue(entry, today), null);
  assert.equal(catalystArticleDatePublished(entry, today), entry.generatedAt,
    'Keep prior public JSON-LD behavior unchanged for unverified legacy records');
  assert.equal(catalystArticleDateModified(entry, today), entry.lastReviewed, 'Legacy modification date must remain unchanged');
}
// Later new Catalyst review files and separately approved public documents must
// not break the *legacy census* test solely by adding a new Markdown file.
for (const { name, data } of records.filter(({ data }) => !isPinnedLegacyCatalyst(data))) {
  const issue = catalystFirstPublicationIssue(data);
  assert.equal(issue, null, 'New Catalyst must satisfy first-publication guard: '+name+' — '+issue);
}

const prepared = {
  ...allLegacy[0],
  slug: '/news/catalysts/2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication-outcome',
  eventKey: '2026-11-12-eia-weekly-petroleum-status-report-veterans-day-adjusted-publication',
  phase: 'outcome',
  eventDate: '2026-11-12',
  sourceEditionDate: '2026-11-12',
  generatedAt: '2026-11-13T17:08:00Z',
  status: 'review',
  firstPublishedDate: undefined,
};
assert.equal(isPinnedLegacyCatalyst(prepared), false);
assert.equal(catalystFirstPublicationIssue(prepared, today), null, 'Review pages remain allowed but never routed');
assert.throws(() => catalystArticleDatePublished(prepared, today), /non-published/);
const proposed = { ...prepared, status: 'published' };
assert.match(catalystFirstPublicationIssue(proposed, today), /requires/);
assert.throws(() => catalystArticleDatePublished(proposed, today), /requires/);
const approvedDate = { ...proposed, firstPublishedDate: '2026-11-13' };
assert.equal(catalystFirstPublicationIssue(approvedDate, today), null);
assert.equal(catalystArticleDatePublished(approvedDate, today), '2026-11-13');
assert.equal(catalystArticleDateModified(approvedDate, today), undefined,
  'Never describe pre-publication editorial review as a post-publication modification');
assert.equal(catalystArticleDateModified({ ...approvedDate, lastReviewed: '2026-11-13' }, today), '2026-11-13');
assert.equal(catalystArticleDateModified({ ...approvedDate, lastReviewed: '2026-11-14' }, { todayUtc: '2026-11-14' }), '2026-11-14');
assert.equal(catalystFirstPublicationIssue(approvedDate, { todayUtc:'2026-11-14' }), null, 'Historical public date persists on later builds');

const rejected = [
  ['source week backdated', { ...proposed, firstPublishedDate:'2026-11-06' }, today],
  ['issuer release backdated', { ...proposed, firstPublishedDate:'2026-11-12' }, today],
  ['content prepared after alleged publication', { ...proposed, firstPublishedDate:'2026-11-14', generatedAt:'2026-11-15T00:00:00Z' }, { todayUtc:'2026-11-15' }],
  ['future public date', { ...proposed, firstPublishedDate:'2026-11-14' }, today],
  ['invalid November calendar day', { ...proposed, firstPublishedDate:'2026-11-31' }, { todayUtc:'2026-12-01' }],
  ['new invalid editorial review date', { ...approvedDate, lastReviewed:'2026-11-31' }, { todayUtc:'2026-12-01' }],
  ['future editorial review date', { ...approvedDate, lastReviewed:'2026-11-14' }, today],
  ['legacy first publication backfill', { ...allLegacy[0], firstPublishedDate:'2026-11-13' }, today],
  ['legacy empty first publication', { ...allLegacy[0], firstPublishedDate:'' }, today],
  ['bad format', { ...proposed, firstPublishedDate:'2026-11-6' }, today],
  ['bad creation timestamp', { ...proposed, firstPublishedDate:'2026-11-13', generatedAt:'invalid' }, today],
  ['legacy slug reused with new event', { ...allLegacy[0], eventKey:'new-event', firstPublishedDate:undefined }, today],
  ['legacy slug reused with new draft time', { ...allLegacy[0], generatedAt:'2026-11-13T00:00:00Z', firstPublishedDate:undefined }, today],
  ['legacy slug reused with new phase', { ...allLegacy[0], phase:'outcome', firstPublishedDate:undefined }, today],
  ['legacy slug reused with new event date', { ...allLegacy[0], eventDate:'2026-11-13', firstPublishedDate:undefined }, today],
  ['review with fabricated first publication', { ...prepared, firstPublishedDate:'2026-11-13' }, today],
  ['new published content without firstPublishedDate', proposed, today],
];
for (const [label, fixture, clock] of rejected) {
  assert.ok(catalystFirstPublicationIssue(fixture, clock), 'Fail closed: '+label);
  if (fixture.status === 'published') assert.throws(() => catalystArticleDatePublished(fixture,clock), Error);
}

// Astro loads **/*.md. The flat-path validator must refuse unexpected nested
// candidates instead of quietly omitting them from source and quality checks.
const temporary = mkdtempSync(path.join(os.tmpdir(), 'usdimpact-catalyst-nested-'));
try {
  const nested = path.join(temporary, 'src/content/catalyst-briefs/nested');
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(nested, 'unvalidated.md'), '---\nstatus: "published"\n---\n');
  const validatorPath = fileURLToPath(new URL('./validate-catalyst-briefs.mjs', import.meta.url));
  const attempted = spawnSync(process.execPath, [validatorPath], { cwd: temporary, encoding: 'utf8' });
  assert.notEqual(attempted.status, 0, 'Nested Catalyst files must never escape validation');
  assert.match(attempted.stderr, /nested Catalyst Brief files are unsupported/);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

// Defend the integration boundary as well as the pure policy function.
assert.ok(schema.includes("import { catalystFirstPublicationIssue } from './lib/catalyst-first-publication-policy.js'"));
assert.ok(schema.includes("firstPublishedDate: z.string().optional()"));
assert.ok(schema.includes('superRefine((brief, ctx) => {'));
assert.ok(schema.includes("const issue = catalystFirstPublicationIssue(brief);"));
assert.ok(renderer.includes("import { catalystArticleDatePublished, catalystArticleDateModified } from '../../../lib/catalyst-first-publication-policy.js'"));
assert.ok(renderer.includes('datePublished: catalystArticleDatePublished(entry.data),'));
assert.ok(renderer.includes('dateModified: catalystArticleDateModified(entry.data),'));
assert.ok(!renderer.includes('dateModified: entry.data.lastReviewed,'), 'Future publication cannot backdate Article modification date');
assert.ok(!renderer.includes('datePublished: entry.data.generatedAt,'), 'Never use drafting time for a new public Catalyst');
assert.ok(renderer.includes("entry.data.status === 'published'"), 'Unapproved review pages must not be routed');
assert.ok(renderer.includes('publishedBySlug.size !== briefs.length'), 'Reject duplicate slugs masquerading as legacy-publication exemptions');
assert.ok(newsLanding.includes('b.data.firstPublishedDate ?? b.data.generatedAt'), 'Landing should order new public briefs by their real first-publication day');
assert.ok(rss.includes('sortKey: entry.data.firstPublishedDate ?? entry.data.generatedAt'), 'RSS sorting must not misuse a new brief drafting timestamp');
assert.ok(latestJson.includes('(b.data.firstPublishedDate ?? b.data.generatedAt).localeCompare(a.data.firstPublishedDate ?? a.data.generatedAt)'), 'Latest JSON must use the same Catalyst publication-date ordering');
assert.ok(latestJson.includes('firstPublishedDate: entry.data.firstPublishedDate,'), 'Latest JSON must expose actual first-publication date for newly public Catalyst briefs');
assert.equal(JSON.stringify({ slug: 'legacy', firstPublishedDate: undefined }), JSON.stringify({ slug: 'legacy' }), 'Legacy JSON payloads must not acquire an invented publication-date field');
assert.equal(JSON.parse(JSON.stringify({ slug: 'new', firstPublishedDate: '2026-11-13' })).firstPublishedDate, '2026-11-13', 'New public Catalyst JSON must include its reviewed date');
const ordered = [
  { sortKey: '2026-11-12T20:00:00Z', id: 'old' },
  { sortKey: '2026-11-13', id: 'new' },
].sort((a,b)=>b.sortKey.localeCompare(a.sortKey));
assert.equal(ordered[0].id,'new', 'Later first-publication date must precede older prepared articles');

console.log('Catalyst publication-date provenance PASS: 15 unchanged historical pages, 1 valid future date, '+rejected.length+' fail-closed cases');
