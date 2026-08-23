import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dailyCardFrameworkQuizBatch01 } from '../src/data/daily-card-framework-quiz-batch-01.js';
import { dailyCards } from '../src/data/daily-card-catalog.js';

const expectedCollectionById = Object.freeze({
  'card-weak-dollar-tighter-conditions': 'rates-liquidity-policy',
  'card-real-rates-equity-valuation': 'rates-liquidity-policy',
  'card-confirm-liquidity-stress': 'rates-liquidity-policy',
  'card-fx-not-purchasing-power': 'market-application',
  'card-inflation-not-bitcoin-guarantee': 'asset-transmission',
});

assert.equal(dailyCardFrameworkQuizBatch01.length, 5, 'Framework/Quiz Batch 01 must remain exactly five reviewed promotions.');
assert.deepEqual(new Set(dailyCardFrameworkQuizBatch01.map((card) => card.id)), new Set(Object.keys(expectedCollectionById)), 'Framework/Quiz Batch 01 IDs changed unexpectedly.');

const allCardIds = new Set(dailyCards.map((card) => card.id));
const ids = new Set();
const slugs = new Set();
const sourceKeys = new Set();

for (const card of dailyCardFrameworkQuizBatch01) {
  assert.equal(ids.has(card.id), false, `${card.id}: duplicate ID.`);
  assert.equal(slugs.has(card.slug), false, `${card.slug}: duplicate slug.`);
  ids.add(card.id);
  slugs.add(card.slug);

  assert.equal(card.collectionId, expectedCollectionById[card.id], `${card.id}: collection changed from reviewed taxonomy.`);
  assert.equal(card.access, 'open', `${card.id}: Batch 01 must remain open.`);
  assert.equal(card.status, 'ready-for-build', `${card.id}: must remain ready-for-build.`);
  assert.equal(card.lastReviewed, '2026-08-23', `${card.id}: explicit review date changed.`);
  assert.equal(card.sourceNames.includes('USD Impact Quiz'), true, `${card.id}: must retain Quiz provenance label.`);
  assert.equal(card.sourceNames.length >= 2, true, `${card.id}: must retain authoritative source labels.`);
  assert.equal(typeof card.sourcePath === 'string' && card.sourcePath.startsWith('src/content/quizzes/en/'), true, `${card.id}: invalid Quiz source path.`);
  assert.match(card.sourceLocator, /^question:\d+$/, `${card.id}: Batch 01 requires an exact question locator.`);
  assert.equal(typeof card.sourceQuizCanonicalId === 'string' && card.sourceQuizCanonicalId.startsWith('quiz-'), true, `${card.id}: missing source quiz canonical ID.`);
  assert.equal(typeof card.sourceReference === 'string' && card.sourceReference.length > 8, true, `${card.id}: missing source reference.`);
  assert.equal(Boolean(card.definition), true, `${card.id}: definition required.`);
  assert.equal(Boolean(card.whyItMatters), true, `${card.id}: whyItMatters required.`);
  assert.equal(Boolean(card.keyTakeaway), true, `${card.id}: keyTakeaway required.`);
  assert.equal(Array.isArray(card.whatToWatch) && card.whatToWatch.length >= 3, true, `${card.id}: whatToWatch required.`);

  for (const relatedId of card.relatedCardIds) {
    assert.equal(allCardIds.has(relatedId), true, `${card.id}: related card ${relatedId} does not exist.`);
  }

  const sourceKey = `${card.sourcePath}::${card.sourceLocator}`;
  assert.equal(sourceKeys.has(sourceKey), false, `${card.id}: duplicate promoted source identity ${sourceKey}.`);
  sourceKeys.add(sourceKey);

  const absolutePath = path.resolve(card.sourcePath);
  assert.equal(fs.existsSync(absolutePath), true, `${card.id}: source quiz does not exist.`);
  const quiz = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  assert.equal(quiz.canonicalId, card.sourceQuizCanonicalId, `${card.id}: source quiz canonical ID mismatch.`);
  assert.equal(quiz.language, 'en', `${card.id}: source quiz must remain English.`);
  assert.equal(typeof quiz.status === 'string' && quiz.status.length > 0, true, `${card.id}: source quiz status missing.`);
  assert.equal(typeof quiz.version === 'string' && quiz.version.length > 0, true, `${card.id}: source quiz version missing.`);

  const number = Number(card.sourceLocator.split(':')[1]);
  const question = quiz.questions.find((item) => item.number === number);
  assert.ok(question, `${card.id}: source question ${number} no longer exists.`);
  assert.equal(question.sourceReference, card.sourceReference, `${card.id}: source reference drifted.`);
  assert.equal(typeof question.explanation === 'string' && question.explanation.length > 20, true, `${card.id}: source explanation missing.`);
}

console.log('Daily Card Framework/Quiz provenance: PASS (5 promoted cards in Batch 01).');
