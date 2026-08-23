import {
  dailyCardMeta,
  dailyCardCollections,
  dailyCardFormats,
  dailyCards as foundationDailyCards,
  weeklyCardRotation,
} from './daily-cards.js';
import { dailyCardVideoBatch01 } from './daily-card-video-batch-01.js';
import { dailyCardVideoBatch02 } from './daily-card-video-batch-02.js';
import { dailyCardVideoBatch03 } from './daily-card-video-batch-03.js';
import { dailyCardVideoBatch04 } from './daily-card-video-batch-04.js';
import { dailyCardGlossaryBatch01 } from './daily-card-glossary-batch-01.js';
import { dailyCardBookBatch01 } from './daily-card-book-batch-01.js';
import { dailyCardBookBatch02 } from './daily-card-book-batch-02.js';
import { dailyCardFrameworkQuizBatch01 } from './daily-card-framework-quiz-batch-01.js';
import { dailyCardFundingPrimaryBatch01 } from './daily-card-funding-primary-batch-01.js';
import { dailyCardHistoryPrimaryBatch01 } from './daily-card-history-primary-batch-01.js';
import { dailyCardWeeklyScoreBatch01 } from './daily-card-weekly-score-batch-01.js';

export { dailyCardMeta, dailyCardCollections, dailyCardFormats, weeklyCardRotation };

export const dailyCards = Object.freeze([
  ...foundationDailyCards,
  ...dailyCardVideoBatch01,
  ...dailyCardVideoBatch02,
  ...dailyCardVideoBatch03,
  ...dailyCardVideoBatch04,
  ...dailyCardGlossaryBatch01,
  ...dailyCardBookBatch01,
  ...dailyCardBookBatch02,
  ...dailyCardFrameworkQuizBatch01,
  ...dailyCardFundingPrimaryBatch01,
  ...dailyCardHistoryPrimaryBatch01,
  ...dailyCardWeeklyScoreBatch01,
]);

export function getDailyCardBySlug(slug) {
  return dailyCards.find((card) => card.slug === slug);
}

export function getDailyCardById(id) {
  return dailyCards.find((card) => card.id === id);
}

export function getCardsByCollection(collectionId) {
  return dailyCards.filter((card) => card.collectionId === collectionId);
}
