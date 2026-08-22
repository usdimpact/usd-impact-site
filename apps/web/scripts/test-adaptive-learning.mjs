import assert from 'node:assert/strict';
import {
  applyReviewResult,
  cardContentId,
  cardIdFromContentId,
  getAdaptiveReviewQueue,
  reviewIntervalDays,
} from '../src/lib/adaptive-learning.js';

assert.equal(cardContentId('real-yield'), 'card:real-yield');
assert.equal(cardIdFromContentId('card:real-yield'), 'real-yield');
assert.equal(cardIdFromContentId('video:real-yield'), null);
assert.equal(reviewIntervalDays(20), 1);
assert.equal(reviewIntervalDays(60), 7);
assert.equal(reviewIntervalDays(95), 30);
assert.equal(reviewIntervalDays(95, { correct: false }), 1);

const reviewedAt = new Date('2026-08-22T08:00:00.000Z');
const firstCorrect = applyReviewResult({
  cardId: 'real-yield',
  correct: true,
  confidence: 2,
  reviewedAt,
});
assert.equal(firstCorrect.mastery_score, 12);
assert.equal(firstCorrect.attempt_count, 1);
assert.equal(firstCorrect.data.correctCount, 1);
assert.equal(firstCorrect.data.incorrectCount, 0);
assert.equal(firstCorrect.data.nextReviewAt, '2026-08-23T08:00:00.000Z');

const mature = applyReviewResult({
  existing: {
    mastery_score: 84,
    attempt_count: 5,
    data: { correctCount: 4, incorrectCount: 1 },
  },
  cardId: 'real-yield',
  correct: true,
  confidence: 2,
  reviewedAt,
});
assert.equal(mature.mastery_score, 96);
assert.equal(mature.status, 'completed');
assert.equal(mature.data.reviewIntervalDays, 30);
assert.equal(mature.data.nextReviewAt, '2026-09-21T08:00:00.000Z');

const failed = applyReviewResult({
  existing: mature,
  cardId: 'real-yield',
  correct: false,
  confidence: 1,
  reviewedAt,
});
assert.equal(failed.mastery_score, 81);
assert.equal(failed.status, 'in_progress');
assert.equal(failed.data.reviewIntervalDays, 1);
assert.equal(failed.data.correctCount, 1);
assert.equal(failed.data.incorrectCount, 1);

const cards = [
  { id: 'dxy', title: 'DXY' },
  { id: 'real-yield', title: 'Real yield' },
  { id: 'tga', title: 'TGA' },
];
const progressRows = [
  {
    content_id: 'card:dxy',
    mastery_score: 70,
    data: { nextReviewAt: '2026-08-20T00:00:00.000Z' },
  },
  {
    content_id: 'card:real-yield',
    mastery_score: 25,
    data: { nextReviewAt: '2026-09-01T00:00:00.000Z' },
  },
];
const queue = getAdaptiveReviewQueue({
  cards,
  progressRows,
  now: new Date('2026-08-22T00:00:00.000Z'),
  limit: 3,
});
assert.deepEqual(queue.map((entry) => entry.card.id), ['dxy', 'tga', 'real-yield']);
assert.equal(queue[0].due, true);
assert.equal(queue[1].isNew, true);
assert.equal(queue[2].due, false);

assert.throws(() => cardContentId('../bad'), /valid Daily Card ID/);
assert.throws(() => getAdaptiveReviewQueue({ limit: 0 }), /between 1 and 20/);

console.log('Adaptive learning contract verified.');
