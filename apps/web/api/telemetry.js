import { timingSafeEqual } from 'node:crypto';
import {
  readTelemetryAggregates,
  recordTelemetryEvent,
  telemetryStorageConstants,
} from '../src/lib/telemetry-store.js';

const MAX_BODY_BYTES = 4_096;
const FALLBACK_DUPLICATE_TTL_MS = 10_000;
const MAX_RECENT_EVENT_IDS = 1_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_DAYS = 31;

const ALLOWED_EVENTS = new Set([
  'checklist_download',
  'checkout_view',
  'checkout_button_click',
  'checkout_sign_in_redirect',
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
let telemetryAggregateReader = readTelemetryAggregates;

function send(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(payload));
}

function requestHeader(request, name) {
  const headers = request.headers ?? {};
  if (typeof headers.get === 'function') return headers.get(name) ?? '';
  const value = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function queryValue(request, key) {
  const direct = request.query?.[key];
  if (Array.isArray(direct)) return String(direct[0] ?? '').trim();
  if (direct !== undefined && direct !== null) return String(direct).trim();
  try {
    return new URL(request.url ?? '/', 'https://usd-impact.com').searchParams.get(key)?.trim() ?? '';
  } catch {
    return '';
  }
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

  if (eventName.startsWith('checkout_') && route !== '/checkout/') {
    throw new Error('Checkout telemetry is restricted to the checkout route.');
  }

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

function safeTokenEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual ?? ''));
  const expectedBuffer = Buffer.from(String(expected ?? ''));
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function bearerToken(request) {
  const authorization = requestHeader(request, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && utcDateString(date) === value;
}

function dateRange(endDate, days) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - index - 1));
    return utcDateString(date);
  });
}

async function handleReport(request, response) {
  if (request.method !== 'GET') {
    return send(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  }

  const endpointToken = process.env.TELEMETRY_REPORT_TOKEN || process.env.NEWSFEED_BEARER_TOKEN;
  if (!endpointToken) {
    console.error('Telemetry report token is not configured.');
    return send(response, 503, { error: 'Telemetry reporting is not configured.' });
  }
  if (!safeTokenEqual(bearerToken(request), endpointToken)) {
    return send(response, 401, { error: 'Unauthorized.' }, { 'WWW-Authenticate': 'Bearer' });
  }

  const endDate = queryValue(request, 'end') || utcDateString();
  if (!isRealDate(endDate)) return send(response, 400, { error: 'end must use YYYY-MM-DD.' });

  const daysValue = queryValue(request, 'days') || '7';
  const days = Number.parseInt(daysValue, 10);
  if (!Number.isInteger(days) || days < 1 || days > MAX_REPORT_DAYS || String(days) !== daysValue) {
    return send(response, 400, { error: `days must be an integer from 1 to ${MAX_REPORT_DAYS}.` });
  }

  try {
    const dates = dateRange(endDate, days);
    const aggregates = await telemetryAggregateReader(dates);
    return send(response, 200, {
      generatedAt: new Date().toISOString(),
      range: { start: dates[0], end: dates.at(-1), days },
      retentionDays: telemetryStorageConstants.dailyRetentionDays,
      ...aggregates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown reporting error';
    console.error(`Telemetry report failed: ${message}`);
    return send(response, 503, { error: 'Telemetry reporting is temporarily unavailable.' });
  }
}

function rankedCounters(counters, prefix, limit = 8) {
  return Object.entries(counters)
    .filter(([field, value]) => field.startsWith(prefix) && Number.isFinite(value) && value > 0)
    .map(([field, value]) => ({ label: field.slice(prefix.length), value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function checklistDownloads(day) {
  return Number(day?.counters?.['checklist:downloads']) || 0;
}

export function buildChecklistAnalytics(aggregates, selectedDays) {
  if (!Number.isInteger(selectedDays) || selectedDays < 1 || selectedDays > MAX_REPORT_DAYS) {
    throw new Error('selectedDays is invalid.');
  }

  const days = Array.isArray(aggregates?.days) ? aggregates.days : [];
  if (days.length !== selectedDays * 2) throw new Error('Checklist analytics requires two complete periods.');

  const previous = days.slice(0, selectedDays);
  const current = days.slice(selectedDays);
  const rangeDownloads = current.reduce((total, day) => total + checklistDownloads(day), 0);
  const previousRangeDownloads = previous.reduce((total, day) => total + checklistDownloads(day), 0);
  const activeDays = current.filter((day) => checklistDownloads(day) > 0).length;
  const mostRecentDownloadDate = [...current].reverse().find((day) => checklistDownloads(day) > 0)?.date ?? null;
  const totals = aggregates?.totals ?? {};

  return {
    lifetimeDownloads: Number(totals['checklist:downloads']) || 0,
    rangeDownloads,
    previousRangeDownloads,
    changePercent: previousRangeDownloads > 0
      ? Math.round(((rangeDownloads - previousRangeDownloads) / previousRangeDownloads) * 1_000) / 10
      : null,
    activeDays,
    averagePerDay: Math.round((rangeDownloads / selectedDays) * 100) / 100,
    mostRecentDownloadDate,
    daily: current.map((day) => ({ date: day.date, downloads: checklistDownloads(day) })),
    attribution: {
      routes: rankedCounters(totals, 'checklist:route:'),
      sources: rankedCounters(totals, 'checklist:utm_source:'),
      mediums: rankedCounters(totals, 'checklist:utm_medium:'),
      campaigns: rankedCounters(totals, 'checklist:utm_campaign:'),
    },
  };
}

function counterValue(counters, field) {
  return Number(counters?.[field]) || 0;
}

function percentage(numerator, denominator) {
  if (denominator < 1) return null;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

export function buildCheckoutFunnelAnalytics(aggregates, selectedDays) {
  if (!Number.isInteger(selectedDays) || selectedDays < 1 || selectedDays > MAX_REPORT_DAYS) {
    throw new Error('selectedDays is invalid.');
  }

  const days = Array.isArray(aggregates?.days) ? aggregates.days : [];
  if (days.length !== selectedDays) throw new Error('Checkout funnel analytics requires a complete period.');

  const summarize = (field) => days.reduce(
    (total, day) => total + counterValue(day?.counters, field),
    0,
  );
  const views = summarize('checkout:views');
  const buttonClicks = summarize('checkout:button_clicks');
  const signInRedirects = summarize('checkout:sign_in_redirects');
  const totals = aggregates?.totals ?? {};

  return {
    eventSemantics: 'Aggregate event counts; not unique visitors and not buyer evidence.',
    lifetime: {
      views: counterValue(totals, 'checkout:views'),
      buttonClicks: counterValue(totals, 'checkout:button_clicks'),
      signInRedirects: counterValue(totals, 'checkout:sign_in_redirects'),
    },
    range: {
      views,
      buttonClicks,
      signInRedirects,
      buttonClickRatePercent: percentage(buttonClicks, views),
      signInRedirectRatePercent: percentage(signInRedirects, buttonClicks),
    },
    daily: days.map((day) => ({
      date: day.date,
      views: counterValue(day.counters, 'checkout:views'),
      buttonClicks: counterValue(day.counters, 'checkout:button_clicks'),
      signInRedirects: counterValue(day.counters, 'checkout:sign_in_redirects'),
    })),
    attribution: {
      sources: rankedCounters(totals, 'checkout:utm_source:'),
      mediums: rankedCounters(totals, 'checkout:utm_medium:'),
      campaigns: rankedCounters(totals, 'checkout:utm_campaign:'),
    },
  };
}

async function handleCheckoutFunnelReport(request, response) {
  if (request.method !== 'GET') {
    return send(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  }

  const endpointToken = process.env.TELEMETRY_REPORT_TOKEN || process.env.NEWSFEED_BEARER_TOKEN;
  if (!endpointToken) {
    console.error('Telemetry report token is not configured.');
    return send(response, 503, { error: 'Telemetry reporting is not configured.' });
  }
  if (!safeTokenEqual(bearerToken(request), endpointToken)) {
    return send(response, 401, { error: 'Unauthorized.' }, { 'WWW-Authenticate': 'Bearer' });
  }

  const endDate = queryValue(request, 'end') || utcDateString();
  if (!isRealDate(endDate)) return send(response, 400, { error: 'end must use YYYY-MM-DD.' });

  const daysValue = queryValue(request, 'days') || '7';
  const days = Number.parseInt(daysValue, 10);
  if (!Number.isInteger(days) || days < 1 || days > MAX_REPORT_DAYS || String(days) !== daysValue) {
    return send(response, 400, { error: `days must be an integer from 1 to ${MAX_REPORT_DAYS}.` });
  }

  try {
    const dates = dateRange(endDate, days);
    const aggregates = await telemetryAggregateReader(dates);
    return send(response, 200, {
      generatedAt: new Date().toISOString(),
      range: { start: dates[0], end: dates.at(-1), days },
      retentionDays: telemetryStorageConstants.dailyRetentionDays,
      checkout: buildCheckoutFunnelAnalytics(aggregates, days),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown checkout reporting error';
    console.error(`Checkout funnel analytics failed: ${message}`);
    return send(response, 503, { error: 'Checkout funnel analytics are temporarily unavailable.' });
  }
}

async function handleChecklistReport(request, response) {
  if (request.method !== 'GET') {
    return send(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
  }

  const endpointToken = process.env.TELEMETRY_REPORT_TOKEN || process.env.NEWSFEED_BEARER_TOKEN;
  if (!endpointToken) {
    console.error('Telemetry report token is not configured.');
    return send(response, 503, { error: 'Telemetry reporting is not configured.' });
  }
  if (!safeTokenEqual(bearerToken(request), endpointToken)) {
    return send(response, 401, { error: 'Unauthorized.' }, { 'WWW-Authenticate': 'Bearer' });
  }

  const endDate = queryValue(request, 'end') || utcDateString();
  if (!isRealDate(endDate)) return send(response, 400, { error: 'end must use YYYY-MM-DD.' });

  const daysValue = queryValue(request, 'days') || '30';
  const days = Number.parseInt(daysValue, 10);
  if (!Number.isInteger(days) || days < 1 || days > MAX_REPORT_DAYS || String(days) !== daysValue) {
    return send(response, 400, { error: `days must be an integer from 1 to ${MAX_REPORT_DAYS}.` });
  }

  try {
    const dates = dateRange(endDate, days * 2);
    const aggregates = await telemetryAggregateReader(dates);
    const checklist = buildChecklistAnalytics(aggregates, days);
    return send(response, 200, {
      generatedAt: new Date().toISOString(),
      range: { start: dates[days], end: dates.at(-1), days },
      comparisonRange: { start: dates[0], end: dates[days - 1], days },
      retentionDays: telemetryStorageConstants.dailyRetentionDays,
      checklist,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown checklist reporting error';
    console.error(`Checklist analytics failed: ${message}`);
    return send(response, 503, { error: 'Checklist analytics are temporarily unavailable.' });
  }
}

async function handleEvent(request, response) {
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

  const vercelEnvironment = String(process.env.VERCEL_ENV ?? '').trim();
  if (
    normalized.record.eventName.startsWith('checkout_')
    && vercelEnvironment
    && vercelEnvironment !== 'production'
  ) {
    return send(response, 202, {
      accepted: true,
      duplicate: false,
      durable: false,
      environmentIsolated: true,
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

export function resetTelemetryStateForTests() {
  recentEventIds.clear();
  telemetryRecorder = recordTelemetryEvent;
  telemetryAggregateReader = readTelemetryAggregates;
}

export function setTelemetryRecorderForTests(recorder) {
  telemetryRecorder = recorder;
}

export function setTelemetryAggregateReaderForTests(reader) {
  telemetryAggregateReader = reader;
}

export default async function handler(request, response) {
  const requestedAction = queryValue(request, 'action');
  if (requestedAction === 'report') return handleReport(request, response);
  if (requestedAction === 'checklist-report') return handleChecklistReport(request, response);
  if (requestedAction === 'checkout-funnel-report') return handleCheckoutFunnelReport(request, response);
  return handleEvent(request, response);
}
