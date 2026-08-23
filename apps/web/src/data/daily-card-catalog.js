import {
  dailyCardMeta,
  dailyCardCollections,
  dailyCardFormats,
  dailyCards as foundationDailyCards,
  weeklyCardRotation,
} from './daily-cards.js';
import { dailyCardVideoBatch01 } from './daily-card-video-batch-01.js';

export { dailyCardMeta, dailyCardCollections, dailyCardFormats, weeklyCardRotation };

export const dailyCards = Object.freeze([
  ...foundationDailyCards,
  ...dailyCardVideoBatch01,
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
