// Offline compatibility and fail-closed future publication contract.
// No Vercel, GitHub, provider, paid model, filesystem mutation or network calls.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  LEGACY_CATALYST_PUBLICATION_PINS,
  isPinnedLegacyCatalyst,
  catalystFirstPublicationIssue,
  catalystArticleDatePublished,
} from '../src/lib/catalyst-first-publication-policy.js';

const root = fileURLToPath(new URL('../src/content/catalyst-briefs/', import.meta.url));
const schema = readFileSync(fileURLToPath(new URL('../src/content.config.ts', import.meta.url)), 'utf8');
const renderer = readFileSync(fileURLToPath(new URL('../src/pages/news/catalysts/[slug].astro', import.meta.url)), 'utf8');
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
assert.equal(files.length, 15, 'Published legacy census drift; audit changes before editing the pins');
assert.equal(LEGACY_CATALYST_PUBLICATION_PINS.length, 15);
assert.equal(new Set(LEGACY_CATALYST_PUBLICATION_PINS.map(x => x.slug)).size, 15);
const allLegacy = files.map(readFrontmatter);
for (const [i, entry] of allLegacy.entries()) {
  assert.equal(entry.status, 'published', 'Legacy sample must remain published: '+files[i]);
  assert.equal(entry.firstPublishedDate, undefined, 'Do not auto-backfill legacy first-publication claims');
  assert.equal(isPinnedLegacyCatalyst(entry), true, 'Historical reference signature changed: '+files[i]);
  assert.equal(catalystFirstPublicationIssue(entry, today), null);
  assert.equal(catalystArticleDatePublished(entry, today), entry.generatedAt,
    'Keep prior public JSON-LD behavior unchanged for unverified legacy records');
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
assert.equal(catalystFirstPublicationIssue(approvedDate, { todayUtc:'2026-11-14' }), null, 'Historical public date persists on later builds');

const rejected = [
  ['source week backdated', { ...proposed, firstPublishedDate:'2026-11-06' }, today],
  ['issuer release backdated', { ...proposed, firstPublishedDate:'2026-11-12' }, today],
  ['content prepared after alleged publication', { ...proposed, firstPublishedDate:'2026-11-14', generatedAt:'2026-11-15T00:00:00Z' }, { todayUtc:'2026-11-15' }],
  ['future public date', { ...proposed, firstPublishedDate:'2026-11-14' }, today],
  ['invalid November calendar day', { ...proposed, firstPublishedDate:'2026-11-31' }, { todayUtc:'2026-12-01' }],
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

// Defend the integration boundary as well as the pure policy function.
assert.ok(schema.includes("import { catalystFirstPublicationIssue } from './lib/catalyst-first-publication-policy.js'"));
assert.ok(schema.includes("firstPublishedDate: z.string().optional()"));
assert.ok(schema.includes('superRefine((brief, ctx) => {'));
assert.ok(schema.includes("const issue = catalystFirstPublicationIssue(brief);"));
assert.ok(renderer.includes("import { catalystArticleDatePublished } from '../../../lib/catalyst-first-publication-policy.js'"));
assert.ok(renderer.includes('datePublished: catalystArticleDatePublished(entry.data),'));
assert.ok(!renderer.includes('datePublished: entry.data.generatedAt,'), 'Never use drafting time for a new public Catalyst');
assert.ok(renderer.includes("entry.data.status === 'published'"), 'Unapproved review pages must not be routed');
console.log('Catalyst publication-date provenance PASS: 15 unchanged historical pages, 1 valid future date, '+rejected.length+' fail-closed cases');
