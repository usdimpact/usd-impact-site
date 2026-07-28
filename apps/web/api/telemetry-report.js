import { timingSafeEqual } from 'node:crypto';
import { readTelemetryAggregates, telemetryStorageConstants } from './_telemetry-store.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

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

export default async function handler(request, response) {
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
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS || String(days) !== daysValue) {
    return send(response, 400, { error: `days must be an integer from 1 to ${MAX_DAYS}.` });
  }

  try {
    const dates = dateRange(endDate, days);
    const aggregates = await readTelemetryAggregates(dates);
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
