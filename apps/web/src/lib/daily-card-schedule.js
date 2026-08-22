import { dailyCards, weeklyCardRotation } from '../data/daily-cards.js';

const DAY_MS = 86_400_000;
const EPOCH_UTC = Date.UTC(2026, 0, 1);

function utcDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eligibleCards({ access = 'open' } = {}) {
  return dailyCards.filter((card) =>
    card.status === 'ready-for-build' &&
    (access === 'all' || card.access === access)
  );
}

function matchesRotation(card, rotation) {
  if (!rotation) return true;
  const formatMatch = !rotation.preferredFormats || rotation.preferredFormats.includes(card.format);
  const collectionMatch = !rotation.preferredCollections || rotation.preferredCollections.includes(card.collectionId);
  return formatMatch && collectionMatch;
}

export function getDailyCard(date = new Date(), { access = 'open' } = {}) {
  const cards = eligibleCards({ access });
  if (!cards.length) return null;

  const rotation = weeklyCardRotation.find((item) => item.day === date.getUTCDay());
  const preferred = cards.filter((card) => matchesRotation(card, rotation));
  const pool = preferred.length ? preferred : cards;
  const dayIndex = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EPOCH_UTC) / DAY_MS);
  const safeIndex = ((dayIndex % pool.length) + pool.length) % pool.length;
  return pool[safeIndex];
}

export function getDailyCardSnapshot(date = new Date()) {
  const card = getDailyCard(date, { access: 'open' });
  return card ? {
    date: utcDateKey(date),
    id: card.id,
    slug: card.slug,
    title: card.title,
    format: card.format,
    collectionId: card.collectionId,
  } : null;
}

export function getPublishedOpenCards() {
  return eligibleCards({ access: 'open' });
}

export function validateDailyCards() {
  const errors = [];
  const ids = new Set();
  const slugs = new Set();
  const validStatuses = new Set(['draft', 'review', 'ready-for-build', 'published']);
  const validAccess = new Set(['open', 'library', 'research']);

  for (const card of dailyCards) {
    if (!card.id || ids.has(card.id)) errors.push(`duplicate or missing id: ${card.id || '(missing)'}`);
    if (!card.slug || slugs.has(card.slug)) errors.push(`duplicate or missing slug: ${card.slug || '(missing)'}`);
    ids.add(card.id);
    slugs.add(card.slug);

    if (!validStatuses.has(card.status)) errors.push(`${card.id}: invalid status ${card.status}`);
    if (!validAccess.has(card.access)) errors.push(`${card.id}: invalid access ${card.access}`);
    if (!card.keyTakeaway) errors.push(`${card.id}: missing keyTakeaway`);
    if (!card.definition) errors.push(`${card.id}: missing definition`);
    if (!Array.isArray(card.sourceNames) || card.sourceNames.length === 0) errors.push(`${card.id}: missing sources`);
    if (!card.lastReviewed) errors.push(`${card.id}: missing lastReviewed`);

    for (const relatedId of card.relatedCardIds || []) {
      if (!dailyCards.some((candidate) => candidate.id === relatedId)) errors.push(`${card.id}: unknown related card ${relatedId}`);
    }
  }

  return errors;
}
