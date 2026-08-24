import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dailyCardBookBatch01 } from '../src/data/daily-card-book-batch-01.js';
import { dailyCardBookBatch02 } from '../src/data/daily-card-book-batch-02.js';
import { dailyCardBookBatch03 } from '../src/data/daily-card-book-batch-03.js';
import { dailyCardBookBatch04 } from '../src/data/daily-card-book-batch-04.js';
import { dailyCardBookBatch05 } from '../src/data/daily-card-book-batch-05.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedCollectionById = Object.freeze({
  'card-dxy-broad-purpose': 'core-framework',
  'card-dxy-euro-weight': 'core-framework',
  'card-dollar-move-not-proof': 'core-framework',
  'card-equity-fx-hedging-timing': 'asset-transmission',
  'card-oil-inventories-matter': 'asset-transmission',
  'card-dollar-direction-not-regime': 'market-application',
  'card-dxy-broad-agreement': 'core-framework',
  'card-lng-contract-transmission': 'asset-transmission',
  'card-gold-not-guaranteed-protection': 'asset-transmission',
  'card-dollar-centrality-1971': 'history-institutions',
  'card-dxy-broad-divergence': 'core-framework',
  'card-nominal-real-dollar-index': 'core-framework',
  'card-wti-futures-curve': 'asset-transmission',
  'card-opec-effective-supply': 'asset-transmission',
  'card-gas-storage-seasonality': 'asset-transmission',
  'card-lng-liquefaction-bottleneck': 'asset-transmission',
  'card-bitcoin-leverage-liquidations': 'asset-transmission',
  'card-bitcoin-access-fund-flows': 'asset-transmission',
  'card-regime-evidence-ladder': 'market-application',
  'card-regime-time-horizon-invalidation': 'market-application',
  'card-gold-dollar-safe-haven-overlap': 'asset-transmission',
  'card-gold-specific-demand-channels': 'asset-transmission',
  'card-oil-supply-beyond-headline-production': 'asset-transmission',
  'card-oil-logistics-local-global-signals': 'asset-transmission',
  'card-gas-pipeline-regional-divergence': 'asset-transmission',
  'card-lng-regasification-downstream-delivery': 'asset-transmission',
  'card-bitcoin-protocol-supply-vs-demand': 'asset-transmission',
  'card-bitcoin-liquidity-fragmentation': 'asset-transmission',
  'card-equity-index-composition-exposure': 'asset-transmission',
  'card-equity-revenue-cost-currency-map': 'asset-transmission',
  'card-dollar-story-diagnostic-errors': 'core-framework',
  'card-dollar-index-points-scope': 'core-framework',
  'card-dollar-five-step-reading-sequence': 'core-framework',
  'card-dollar-infrastructure-transmission': 'core-framework',
});

function parseFrontmatter(text, sourcePath) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  assert.ok(match, `${sourcePath}: missing frontmatter`);
  const data = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    data[key] = value;
  }
  return { data, body: match[2] };
}

assert.equal(dailyCardBookBatch01.length, 10, 'Book Batch 01 must remain exactly ten reviewed promotions.');
assert.equal(dailyCardBookBatch02.length, 10, 'Book Batch 02 must remain exactly ten reviewed promotions.');
assert.equal(dailyCardBookBatch03.length, 10, 'Book Batch 03 must remain exactly ten reviewed promotions.');
assert.equal(dailyCardBookBatch04.length, 3, 'Book Batch 04 must remain exactly three reviewed Core promotions.');
assert.equal(dailyCardBookBatch05.length, 1, 'Book Batch 05 must remain exactly one reviewed Core promotion.');
assert.equal(dailyCardBookBatch03.every((card) => card.collectionId === 'asset-transmission'), true, 'Book Batch 03 must remain Asset Transmission only.');
assert.equal(dailyCardBookBatch03.every((card) => card.lastReviewed === '2026-08-24'), true, 'Book Batch 03 review date changed.');
assert.equal(dailyCardBookBatch04.every((card) => card.collectionId === 'core-framework'), true, 'Book Batch 04 must remain Core Dollar Framework only.');
assert.equal(dailyCardBookBatch04.every((card) => card.lastReviewed === '2026-08-24'), true, 'Book Batch 04 review date changed.');
assert.equal(dailyCardBookBatch05.every((card) => card.collectionId === 'core-framework'), true, 'Book Batch 05 must remain Core Dollar Framework only.');
assert.equal(dailyCardBookBatch05.every((card) => card.lastReviewed === '2026-08-24'), true, 'Book Batch 05 review date changed.');
assert.equal(dailyCardBookBatch05[0].sourcePath, 'src/content/pages/what-is-the-us-dollar.md', 'Book Batch 05 source page changed.');
assert.equal(dailyCardBookBatch05[0].sourceHeading, 'The dollar as infrastructure', 'Book Batch 05 source heading changed.');

const promotedBookCards = [...dailyCardBookBatch01, ...dailyCardBookBatch02, ...dailyCardBookBatch03, ...dailyCardBookBatch04, ...dailyCardBookBatch05];
assert.equal(promotedBookCards.length, 34, 'Book promotion total must be exactly thirty-four after Batch 05.');
assert.deepEqual(new Set(promotedBookCards.map((card) => card.id)), new Set(Object.keys(expectedCollectionById)), 'Book promotion IDs changed unexpectedly.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const ids = new Set();
const slugs = new Set();
const sourceSectionKeys = new Set();
for (const card of promotedBookCards) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, expectedCollectionById[card.id], `${card.id}: collection changed from reviewed taxonomy.`);
  assert.equal(card.access, 'open', `${card.id}: promoted Book cards must remain open.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(['2026-08-23', '2026-08-24'].includes(card.lastReviewed), true, `${card.id}: unexpected explicit review date.`);
  assert.equal(card.sourceNames.includes('USD Impact Book lesson'), true, `${card.id}: must retain Book lesson provenance label.`);
  assert.equal(card.sourceNames.length >= 2, true, `${card.id}: must retain at least one authoritative source label.`);
  assert.equal(typeof card.sourcePath === 'string' && card.sourcePath.startsWith('src/content/pages/'), true, `${card.id}: invalid Book source path.`);
  assert.equal(typeof card.sourcePageSlug === 'string' && card.sourcePageSlug.startsWith('/'), true, `${card.id}: invalid source page slug.`);
  assert.equal(typeof card.sourceHeading === 'string' && card.sourceHeading.length > 3, true, `${card.id}: missing source heading.`);
  assert.equal(Array.isArray(card.relatedCardIds), true, `${card.id}: relatedCardIds must be an array.`);
  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }

  const sourceSectionKey = `${card.sourcePath}::${card.sourceHeading}`;
  assert.equal(sourceSectionKeys.has(sourceSectionKey), false, `${card.id}: duplicate promoted Book section ${sourceSectionKey}.`);
  sourceSectionKeys.add(sourceSectionKey);

  const absolutePath = path.resolve(card.sourcePath);
  assert.equal(fs.existsSync(absolutePath), true, `${card.id}: source page does not exist.`);
  const sourceText = fs.readFileSync(absolutePath, 'utf8');
  const { data: frontmatter, body } = parseFrontmatter(sourceText, card.sourcePath);
  assert.equal(frontmatter.status, 'published', `${card.id}: source page must remain published.`);
  assert.equal(String(frontmatter.category || '').startsWith('Book lesson'), true, `${card.id}: source must remain a Book lesson.`);
  assert.equal(frontmatter.slug, card.sourcePageSlug, `${card.id}: sourcePageSlug must match source frontmatter.`);
  assert.equal(body.split(/\r?\n/).some((line) => line.trim() === `## ${card.sourceHeading}`), true, `${card.id}: exact reviewed H2 no longer exists in source page.`);

  assert.equal(Boolean(card.definition), true, `${card.id}: definition required.`);
  assert.equal(Boolean(card.whyItMatters), true, `${card.id}: whyItMatters required.`);
  assert.equal(Boolean(card.keyTakeaway), true, `${card.id}: keyTakeaway required.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length > 0, true, `${card.id}: whatToWatch required.`);
}

assert.equal(dailyCardBookBatch01.find((card) => card.id === 'card-dollar-centrality-1971').collectionId, 'history-institutions', 'The 1971 centrality card must remain in History & Institutions.');
assert.equal(dailyCardBookBatch02.filter((card) => card.collectionId === 'core-framework').length, 2, 'Book Batch 02 must add exactly two Core Framework cards.');
assert.equal(dailyCardBookBatch02.filter((card) => card.collectionId === 'asset-transmission').length, 6, 'Book Batch 02 must add exactly six Asset Transmission cards.');
assert.equal(dailyCardBookBatch02.filter((card) => card.collectionId === 'market-application').length, 2, 'Book Batch 02 must add exactly two Market Application cards.');
assert.equal(new Set(dailyCardBookBatch03.map((card) => card.sourcePath)).size, 5, 'Book Batch 03 must preserve five-source diversity.');
for (const sourcePath of new Set(dailyCardBookBatch03.map((card) => card.sourcePath))) {
  assert.equal(dailyCardBookBatch03.filter((card) => card.sourcePath === sourcePath).length, 2, `Book Batch 03 must select exactly two sections from ${sourcePath}.`);
}
assert.equal(new Set(dailyCardBookBatch04.map((card) => card.sourcePath)).size, 2, 'Book Batch 04 must preserve two-source Core diversity.');
console.log('Daily Card Book provenance: PASS (34 promoted cards across Batches 01-05).');
