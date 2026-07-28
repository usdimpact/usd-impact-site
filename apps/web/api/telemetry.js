import { recordTelemetryEvent } from './_telemetry-store.js';

const MAX_BODY_BYTES = 4_096;
const FALLBACK_DUPLICATE_TTL_MS = 10_000;
const MAX_RECENT_EVENT_IDS = 1_000;

const ALLOWED_EVENTS = new Set([
  'checklist_download',
  'quiz_start',
  'quiz_complete',
  'quiz_retry',
]);

const QUIZ_ID_PATTERN = /^quiz-[a-z0-9-]{1,80}$/;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;
const CAMPAIGN_PATTERN = /^[a-zA-Z0-9._~-]{1,64}$/;
const ROUTE_PATTERN = /^\/[a-zA-Z0-9/_-]{0,199}$/;

const recentEventIds = new Map();
let telemetryRecorder = recordTelemetryEvent;

function send(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object') {
    const encoded = JSON.stringify(request.body);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    return request.body;
  }

  if (typeof request.body === 'string') {
    if (Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    return JSON.parse(request.body);
  }

  throw new Error('A JSON request body is required.');
}

function optionalCampaignValue(payload, key) {
  const value = payload[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !CAMPAIGN_PATTERN.test(value)) {
    throw new Error(`${key} is invalid.`);
  }
  return value;
}

function pruneRecentEventIds(now) {
  for (const [eventId, expiresAt] of recentEventIds) {
    if (expiresAt <= now) recentEventIds.delete(eventId);
  }

  while (recentEventIds.size > MAX_RECENT_EVENT_IDS) {
    const oldest = recentEventIds.keys().next().value;
    if (!oldest) break;
    recentEventIds.delete(oldest);
  }
}

function normalizeEvent(payload, now) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Telemetry payload must be an object.');
  }

  const eventName = payload.eventName;
  if (typeof eventName !== 'string' || !ALLOWED_EVENTS.has(eventName)) {
    throw new Error('eventName is unavailable.');
  }

  const eventId = payload.eventId;
  if (typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)) {
    throw new Error('eventId is invalid.');
  }

  const route = payload.route;
  if (typeof route !== 'string' || !ROUTE_PATTERN.test(route) || route.includes('//')) {
    throw new Error('route is invalid.');
  }

  const record = {
    kind: 'usd-impact-learning-telemetry',
    schemaVersion: 2,
    eventName,
    occurredAt: new Date(now).toISOString(),
    route,
  };

  const utmSource = optionalCampaignValue(payload, 'utmSource');
  const utmMedium = optionalCampaignValue(payload, 'utmMedium');
  const utmCampaign = optionalCampaignValue(payload, 'utmCampaign');
  if (utmSource) record.utmSource = utmSource;
  if (utmMedium) record.utmMedium = utmMedium;
  if (utmCampaign) record.utmCampaign = utmCampaign;

  if (eventName.startsWith('quiz_')) {
    const quizId = payload.quizId;
    if (typeof quizId !== 'string' || !QUIZ_ID_PATTERN.test(quizId)) {
      throw new Error('quizId is invalid.');
    }
    record.quizId = quizId;
  }

  if (eventName === 'quiz_complete') {
    if (!['pass', 'fail'].includes(payload.outcome)) {
      throw new Error('outcome must be pass or fail.');
    }
    if (!Number.isInteger(payload.score) || payload.score < 0 || payload.score > 10) {
      throw new Error('score must be an integer from 0 to 10.');
    }
    if (payload.questionCount !== 10) {
      throw new Error('questionCount must be 10.');
    }
    record.outcome = payload.outcome;
    record.score = payload.score;
    record.questionCount = payload.questionCount;
  }

  return { eventId, record };
}

export function resetTelemetryStateForTests() {
  recentEventIds.clear();
  telemetryRecorder = recordTelemetryEvent;
}

export function setTelemetryRecorderForTests(recorder) {
  telemetryRecorder = recorder;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return send(response, 405, { error: 'Method not allowed.' });
  }

  let payload;
  try {
    payload = parseBody(request);
  } catch (error) {
    return send(response, 400, {
      error: error instanceof Error ? error.message : 'Invalid JSON.',
    });
  }

  const now = Date.now();
  pruneRecentEventIds(now);

  let normalized;
  try {
    normalized = normalizeEvent(payload, now);
  } catch (error) {
    return send(response, 400, {
      error: error instanceof Error ? error.message : 'Invalid telemetry event.',
    });
  }

  if (recentEventIds.has(normalized.eventId)) {
    return send(response, 202, { accepted: true, duplicate: true, durable: false });
  }

  recentEventIds.set(normalized.eventId, now + FALLBACK_DUPLICATE_TTL_MS);

  try {
    const result = await telemetryRecorder(normalized);
    if (result.rateLimited) {
      console.warn('Telemetry event rate limited.');
      return send(response, 202, {
        accepted: true,
        duplicate: false,
        durable: true,
        rateLimited: true,
      });
    }
    if (!result.duplicate) {
      console.log(JSON.stringify({ ...normalized.record, durable: true }));
    }
    return send(response, 202, {
      accepted: true,
      duplicate: result.duplicate,
      durable: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown storage error';
    console.error(`Telemetry durable storage failed: ${message}`);
    console.log(JSON.stringify({ ...normalized.record, durable: false }));
    return send(response, 202, {
      accepted: true,
      duplicate: false,
      durable: false,
    });
  }
}
