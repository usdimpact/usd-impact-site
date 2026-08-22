import { dailyCards, getDailyCardById } from '../data/daily-cards.js';
import {
  applyReviewResult,
  cardContentId,
  getAdaptiveReviewQueue,
} from './adaptive-learning.js';
import {
  getVerifiedSupabaseUser,
  readSupabaseServerConfig,
  SupabaseRequestError,
} from './supabase-server.js';

const RATINGS = Object.freeze({
  again: Object.freeze({ correct: false, confidence: 0 }),
  hard: Object.freeze({ correct: true, confidence: 0 }),
  good: Object.freeze({ correct: true, confidence: 1 }),
  easy: Object.freeze({ correct: true, confidence: 2 }),
});

const OPEN_READY_CARDS = Object.freeze(
  dailyCards.filter((card) => card.access === 'open' && card.status === 'ready-for-build'),
);

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function userRestFetch({ config, accessToken, path, method = 'GET', body, headers = {}, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new SupabaseRequestError(
      payload?.message || payload?.error || 'Daily Card progress request failed.',
      {
        status: response.status,
        code: payload?.code || 'DAILY_CARD_PROGRESS_FAILED',
        details: payload,
      },
    );
  }
  return payload;
}

function normalizeLimit(value) {
  const numeric = Number(value ?? 3);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10) {
    throw new TypeError('Daily Card review queue limit must be between 1 and 10.');
  }
  return numeric;
}

function requireOpenCard(cardId) {
  const card = getDailyCardById(String(cardId || '').trim());
  if (!card || card.access !== 'open' || card.status !== 'ready-for-build') {
    throw new TypeError('Daily Card is not available for adaptive review.');
  }
  return card;
}

function requireRating(value) {
  const rating = String(value || '').trim().toLowerCase();
  const state = RATINGS[rating];
  if (!state) throw new TypeError('Daily Card review rating must be again, hard, good, or easy.');
  return { rating, ...state };
}

function progressSelectPath(accountId, contentId = null) {
  const filters = [
    `account_id=eq.${encodeURIComponent(accountId)}`,
    'select=account_id,content_id,status,progress_percent,mastery_score,attempt_count,completed_at,data,created_at,updated_at',
  ];
  if (contentId) filters.splice(1, 0, `content_id=eq.${encodeURIComponent(contentId)}`);
  return `/rest/v1/learning_progress?${filters.join('&')}`;
}

export async function readDailyCardReviewQueue({
  accessToken,
  limit = 3,
  environment,
  config,
  fetchImpl,
  now = new Date(),
} = {}) {
  const count = normalizeLimit(limit);
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const rows = await userRestFetch({
    config: resolvedConfig,
    accessToken,
    path: progressSelectPath(user.id),
    fetchImpl,
  });
  const queue = getAdaptiveReviewQueue({
    cards: OPEN_READY_CARDS,
    progressRows: Array.isArray(rows) ? rows : [],
    now,
    limit: count,
  });
  return Object.freeze(queue.map((entry) => Object.freeze({
    id: entry.card.id,
    slug: entry.card.slug,
    title: entry.card.title,
    shortTitle: entry.card.shortTitle,
    collectionId: entry.card.collectionId,
    format: entry.card.format,
    mastery: entry.mastery,
    isNew: entry.isNew,
    due: entry.due,
    nextReviewAt: entry.progress?.data?.nextReviewAt ?? null,
  })));
}

export async function submitDailyCardReview({
  accessToken,
  cardId,
  rating,
  environment,
  config,
  fetchImpl,
  now = new Date(),
} = {}) {
  const card = requireOpenCard(cardId);
  const review = requireRating(rating);
  const resolvedConfig = config || readSupabaseServerConfig(environment);
  const user = await getVerifiedSupabaseUser(accessToken, { config: resolvedConfig, fetchImpl });
  const contentId = cardContentId(card.id);

  const existingRows = await userRestFetch({
    config: resolvedConfig,
    accessToken,
    path: `${progressSelectPath(user.id, contentId)}&limit=1`,
    fetchImpl,
  });
  const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
  const next = applyReviewResult({
    existing,
    cardId: card.id,
    correct: review.correct,
    confidence: review.confidence,
    reviewedAt: now,
  });

  const storedRows = await userRestFetch({
    config: resolvedConfig,
    accessToken,
    path: '/rest/v1/learning_progress?on_conflict=account_id,content_id',
    method: 'POST',
    body: {
      account_id: user.id,
      ...next,
      updated_at: now.toISOString(),
    },
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    fetchImpl,
  });
  const stored = Array.isArray(storedRows) && storedRows.length ? storedRows[0] : next;

  return Object.freeze({
    ok: true,
    card: Object.freeze({ id: card.id, slug: card.slug, title: card.title }),
    rating: review.rating,
    mastery: Number(stored.mastery_score ?? next.mastery_score),
    attemptCount: Number(stored.attempt_count ?? next.attempt_count),
    status: stored.status ?? next.status,
    nextReviewAt: stored.data?.nextReviewAt ?? next.data.nextReviewAt,
  });
}
