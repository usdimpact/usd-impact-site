import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dailyCardBookBatch01 } from '../src/data/daily-card-book-batch-01.js';
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
assert.deepEqual(new Set(dailyCardBookBatch01.map((card) => card.id)), new Set(Object.keys(expectedCollectionById)), 'Book Batch 01 IDs changed unexpectedly.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const ids = new Set();
const slugs = new Set();
const sourceSectionKeys = new Set();
for (const card of dailyCardBookBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, expectedCollectionById[card.id], `${card.id}: collection changed from reviewed taxonomy.`);
  assert.equal(card.access, 'open', `${card.id}: Book Batch 01 must remain open.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-23', `${card.id}: explicit review date changed.`);
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
console.log('Daily Card Book provenance: PASS (10 promoted cards in Batch 01).');
