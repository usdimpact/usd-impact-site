import assert from 'node:assert/strict';
import { dailyCards, dailyCardCollections } from '../src/data/daily-cards.js';
import {
  dailyCardInventoryTargets,
  dailyCardInventoryTargetTotal,
  dailyCardPromotionRules,
  dailyCardSourceHierarchy,
} from '../src/data/daily-card-inventory-plan.js';

const collectionIds = dailyCardCollections.map((collection) => collection.id).sort();
const targetIds = Object.keys(dailyCardInventoryTargets).sort();
assert.deepEqual(targetIds, collectionIds, 'Every Daily Card collection must have exactly one inventory target.');
assert.equal(dailyCardInventoryTargetTotal, 150, 'Initial canonical inventory target must remain 150 concepts.');
for (const [collectionId, target] of Object.entries(dailyCardInventoryTargets)) {
  assert.equal(Number.isInteger(target) && target > 0, true, `${collectionId} target must be a positive integer.`);
}

assert.deepEqual(
  dailyCardSourceHierarchy.map((source) => source.order),
  [1, 2, 3, 4, 5, 6, 7, 8],
  'Source hierarchy order must remain explicit and contiguous.',
);
assert.equal(new Set(dailyCardSourceHierarchy.map((source) => source.id)).size, dailyCardSourceHierarchy.length);
assert.equal(dailyCardPromotionRules.machineCandidateStatus, 'review');
assert.equal(dailyCardPromotionRules.publishableStatuses.includes('review'), false);
assert.equal(dailyCardPromotionRules.publishableStatuses.includes('ready-for-build'), true);

for (const card of dailyCards) {
  assert.equal(Object.hasOwn(dailyCardInventoryTargets, card.collectionId), true, `${card.id} has no target collection.`);
  if (dailyCardPromotionRules.publishableStatuses.includes(card.status)) {
    for (const field of dailyCardPromotionRules.requiredEditorialFields) {
      if (field === 'sourceNames') {
        assert.equal(Array.isArray(card[field]) && card[field].length > 0, true, `${card.id} lacks sourceNames.`);
      } else {
        assert.equal(Boolean(card[field]), true, `${card.id} lacks ${field}.`);
      }
    }
  }
}

console.log(`Daily Cards inventory plan contract: PASS (${dailyCards.length}/${dailyCardInventoryTargetTotal} canonical concepts).`);
