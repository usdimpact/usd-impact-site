import { dailyCards, dailyCardCollections } from '../src/data/daily-cards.js';
import {
  dailyCardInventoryTargets,
  dailyCardInventoryTargetTotal,
  dailyCardPromotionRules,
  dailyCardSourceHierarchy,
} from '../src/data/daily-card-inventory-plan.js';
import { getDailyCard, validateDailyCards } from '../src/lib/daily-card-schedule.js';
import { buildChannelPack } from '../src/lib/daily-card-adapters.js';
import { normalizeTelegramMessage } from '../src/lib/daily-card-telegram.js';

const errors = validateDailyCards();

const collectionIds = dailyCardCollections.map((collection) => collection.id).sort();
const targetIds = Object.keys(dailyCardInventoryTargets).sort();
if (JSON.stringify(collectionIds) !== JSON.stringify(targetIds)) {
  errors.push('every Daily Card collection must have exactly one inventory target');
}
if (dailyCardInventoryTargetTotal !== 150) {
  errors.push(`initial Daily Card inventory target must total 150, found ${dailyCardInventoryTargetTotal}`);
}
if (dailyCardPromotionRules.machineCandidateStatus !== 'review') {
  errors.push('machine-derived Daily Card candidates must remain in review status');
}
if (dailyCardPromotionRules.publishableStatuses.includes('review')) {
  errors.push('review status must never be publishable');
}
if (new Set(dailyCardSourceHierarchy.map((source) => source.id)).size !== dailyCardSourceHierarchy.length) {
  errors.push('Daily Card source hierarchy contains duplicate source IDs');
}

for (const card of dailyCards) {
  if (!Object.hasOwn(dailyCardInventoryTargets, card.collectionId)) {
    errors.push(`${card.id}: collection ${card.collectionId} has no inventory target`);
  }
  if (dailyCardPromotionRules.publishableStatuses.includes(card.status)) {
    for (const field of dailyCardPromotionRules.requiredEditorialFields) {
      if (field === 'sourceNames') {
        if (!Array.isArray(card.sourceNames) || card.sourceNames.length === 0) {
          errors.push(`${card.id}: publishable card lacks sourceNames`);
        }
      } else if (!card[field]) {
        errors.push(`${card.id}: publishable card lacks ${field}`);
      }
    }
  }
}

const openCards = dailyCards.filter((card) => card.access === 'open' && card.status === 'ready-for-build');
if (openCards.length < 5) errors.push(`expected at least 5 publishable open cards, found ${openCards.length}`);

for (const card of openCards) {
  const pack = buildChannelPack(card, { baseUrl: 'https://www.usd-impact.com' });
  if (!pack.email?.text || !pack.telegram || !pack.whatsapp || !pack.social) {
    errors.push(`${card.id}: incomplete channel pack`);
    continue;
  }
  try {
    normalizeTelegramMessage(pack.telegram);
  } catch (error) {
    errors.push(`${card.id}: ${error instanceof Error ? error.message : 'invalid Telegram payload'}`);
  }
}

for (let offset = 0; offset < 35; offset += 1) {
  const date = new Date(Date.UTC(2026, 7, 22 + offset));
  const card = getDailyCard(date, { access: 'open' });
  if (!card) {
    errors.push(`no open daily card selected for ${date.toISOString().slice(0, 10)}`);
    continue;
  }
  if (card.access !== 'open') errors.push(`${date.toISOString().slice(0, 10)} selected non-open card ${card.id}`);
  const pack = buildChannelPack(card, { baseUrl: 'https://www.usd-impact.com' });
  if (!pack.email?.text || !pack.telegram || !pack.whatsapp || !pack.social) {
    errors.push(`${card.id}: incomplete channel pack`);
  }
}

if (errors.length) {
  console.error('Daily Cards validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Daily Cards validation passed: ${dailyCards.length}/${dailyCardInventoryTargetTotal} canonical cards, ${openCards.length} publishable open cards.`);
