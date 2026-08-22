const DAY_MS = 86_400_000;
const CARD_CONTENT_ID = /^card:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

const REVIEW_INTERVAL_DAYS = Object.freeze([
  { minimumMastery: 90, days: 30 },
  { minimumMastery: 75, days: 14 },
  { minimumMastery: 55, days: 7 },
  { minimumMastery: 35, days: 3 },
  { minimumMastery: 0, days: 1 },
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid review date is required.');
  return date;
}

function normalizeMastery(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? clamp(Math.round(numeric), 0, 100) : 0;
}

function normalizeAttempts(value) {
  const numeric = Number(value ?? 0);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

export function cardContentId(cardId) {
  const normalized = String(cardId || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new TypeError('A valid Daily Card ID is required.');
  }
  return `card:${normalized}`;
}

export function cardIdFromContentId(contentId) {
  const match = String(contentId || '').match(CARD_CONTENT_ID);
  return match ? match[1] : null;
}

export function reviewIntervalDays(masteryScore, { correct = true } = {}) {
  if (!correct) return 1;
  const mastery = normalizeMastery(masteryScore);
  return REVIEW_INTERVAL_DAYS.find((entry) => mastery >= entry.minimumMastery)?.days ?? 1;
}

export function applyReviewResult({
  existing = null,
  cardId,
  correct,
  confidence = 1,
  reviewedAt = new Date(),
}) {
  if (typeof correct !== 'boolean') throw new TypeError('Review correctness is required.');
  if (![0, 1, 2].includes(confidence)) throw new TypeError('Confidence must be 0, 1, or 2.');

  const date = asDate(reviewedAt);
  const previousMastery = normalizeMastery(existing?.mastery_score);
  const previousAttempts = normalizeAttempts(existing?.attempt_count);
  const gain = [5, 8, 12][confidence];
  const masteryScore = clamp(previousMastery + (correct ? gain : -15), 0, 100);
  const intervalDays = reviewIntervalDays(masteryScore, { correct });
  const nextReviewAt = new Date(date.getTime() + intervalDays * DAY_MS);
  const previousData = existing?.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
    ? existing.data
    : {};

  const correctCount = normalizeAttempts(previousData.correctCount) + (correct ? 1 : 0);
  const incorrectCount = normalizeAttempts(previousData.incorrectCount) + (correct ? 0 : 1);

  return Object.freeze({
    content_id: cardContentId(cardId),
    status: masteryScore >= 90 ? 'completed' : 'in_progress',
    progress_percent: masteryScore,
    mastery_score: masteryScore,
    attempt_count: previousAttempts + 1,
    completed_at: masteryScore >= 90 ? (existing?.completed_at || date.toISOString()) : null,
    data: Object.freeze({
      ...previousData,
      contentType: 'daily-card',
      correctCount,
      incorrectCount,
      lastCorrect: correct,
      lastConfidence: confidence,
      lastReviewedAt: date.toISOString(),
      nextReviewAt: nextReviewAt.toISOString(),
      reviewIntervalDays: intervalDays,
    }),
  });
}

function progressByCardId(progressRows = []) {
  return new Map(
    progressRows
      .map((row) => [cardIdFromContentId(row?.content_id), row])
      .filter(([id]) => Boolean(id)),
  );
}

function dueTimestamp(row) {
  const value = row?.data?.nextReviewAt;
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function rankAdaptiveCards({ cards = [], progressRows = [], now = new Date() } = {}) {
  const nowMs = asDate(now).getTime();
  const progress = progressByCardId(progressRows);

  return cards
    .filter((card) => card && card.id)
    .map((card, sourceIndex) => {
      const row = progress.get(card.id) || null;
      const mastery = normalizeMastery(row?.mastery_score);
      const nextReview = dueTimestamp(row);
      const isNew = !row;
      const due = isNew || nextReview <= nowMs;
      return { card, row, mastery, nextReview, isNew, due, sourceIndex };
    })
    .sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1;
      if (a.isNew !== b.isNew) return a.isNew ? 1 : -1;
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      if (a.nextReview !== b.nextReview) return a.nextReview - b.nextReview;
      return a.sourceIndex - b.sourceIndex;
    })
    .map(({ card, row, mastery, isNew, due }) => Object.freeze({
      card,
      progress: row,
      mastery,
      isNew,
      due,
    }));
}

export function getAdaptiveReviewQueue({
  cards = [],
  progressRows = [],
  now = new Date(),
  limit = 3,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new TypeError('Adaptive review queue limit must be between 1 and 20.');
  }
  const ranked = rankAdaptiveCards({ cards, progressRows, now });
  const due = ranked.filter((entry) => entry.due);
  const pool = due.length >= limit ? due : [...due, ...ranked.filter((entry) => !entry.due)];
  return Object.freeze(pool.slice(0, limit));
}
