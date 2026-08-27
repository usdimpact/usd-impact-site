const KEY_PREFIX = 'usd-impact:telemetry:v1';
const DEFAULT_DEDUP_TTL_SECONDS = 86_400;
const DEFAULT_DAILY_RETENTION_SECONDS = 730 * 24 * 60 * 60;
const DEFAULT_RATE_WINDOW_SECONDS = 120;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 600;
const DEFAULT_TIMEOUT_MS = 1_500;

const RECORD_EVENT_SCRIPT = `
local rate = redis.call('INCR', KEYS[1])
if rate == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
if rate > tonumber(ARGV[3]) then
  return {'rate_limited', rate}
end

local inserted = redis.call('SET', KEYS[2], '1', 'NX', 'EX', tonumber(ARGV[1]))
if not inserted then
  return {'duplicate', rate}
end

local pairCount = tonumber(ARGV[5])
local index = 6
for i = 1, pairCount do
  local field = ARGV[index]
  local increment = tonumber(ARGV[index + 1])
  redis.call('HINCRBY', KEYS[3], field, increment)
  redis.call('HINCRBY', KEYS[4], field, increment)
  index = index + 2
end
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[4]))
return {'accepted', rate}
`;

function integerFromEnv(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function storageConfig(env = process.env, readOnly = false) {
  const url = String(env.KV_REST_API_URL ?? '').trim().replace(/\/+$/, '');
  const tokenName = readOnly ? 'KV_REST_API_READ_ONLY_TOKEN' : 'KV_REST_API_TOKEN';
  const token = String(env[tokenName] ?? '').trim();
  if (!url || !token) throw new Error('Telemetry storage is not configured.');
  return {
    url,
    token,
    timeoutMs: integerFromEnv(env.TELEMETRY_STORAGE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 250, 10_000),
    rateLimit: integerFromEnv(
      env.TELEMETRY_RATE_LIMIT_PER_MINUTE,
      DEFAULT_RATE_LIMIT_PER_MINUTE,
      50,
      5_000,
    ),
  };
}

async function upstashRequest({ url, token, timeoutMs }, path, body, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${url}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.error) {
      throw new Error(payload?.error || `Telemetry storage request failed with status ${response.status}.`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function addPair(pairs, field, increment = 1) {
  const existing = pairs.get(field) ?? 0;
  pairs.set(field, existing + increment);
}

export function buildTelemetryCounterPairs(record) {
  const pairs = new Map();
  addPair(pairs, 'events:total');
  addPair(pairs, `events:${record.eventName}`);

  if (record.eventName === 'checklist_download') {
    addPair(pairs, 'checklist:downloads');
    addPair(pairs, `checklist:route:${record.route}`);

    for (const [property, label] of [
      ['utmSource', 'utm_source'],
      ['utmMedium', 'utm_medium'],
      ['utmCampaign', 'utm_campaign'],
    ]) {
      if (record[property]) addPair(pairs, `checklist:${label}:${record[property]}`);
    }
  }

  if (record.quizId) {
    const prefix = `quiz:${record.quizId}`;
    if (record.eventName === 'quiz_start') addPair(pairs, `${prefix}:starts`);
    if (record.eventName === 'quiz_retry') addPair(pairs, `${prefix}:retries`);
    if (record.eventName === 'quiz_complete') {
      addPair(pairs, `${prefix}:completions`);
      addPair(pairs, `${prefix}:${record.outcome}`);
      addPair(pairs, `${prefix}:score_sum`, record.score);
      addPair(pairs, `${prefix}:question_count_sum`, record.questionCount);
    }
  }

  for (const [property, label] of [
    ['utmSource', 'utm_source'],
    ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'],
  ]) {
    if (record[property]) addPair(pairs, `${label}:${record[property]}`);
  }

  return [...pairs.entries()];
}

function utcDateAndMinute(occurredAt) {
  const parsed = new Date(occurredAt);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Telemetry event timestamp is invalid.');
  const iso = parsed.toISOString();
  return { date: iso.slice(0, 10), minute: iso.slice(0, 16) };
}

export async function recordTelemetryEvent({ eventId, record }, options = {}) {
  const env = options.env ?? process.env;
  const config = storageConfig(env, false);
  const fetchImpl = options.fetchImpl ?? fetch;
  const { date, minute } = utcDateAndMinute(record.occurredAt);
  const pairs = buildTelemetryCounterPairs(record);
  const flattenedPairs = pairs.flatMap(([field, increment]) => [field, String(increment)]);

  const keys = [
    `${KEY_PREFIX}:rate:${minute}`,
    `${KEY_PREFIX}:dedup:${eventId}`,
    `${KEY_PREFIX}:daily:${date}`,
    `${KEY_PREFIX}:totals`,
  ];

  const command = [
    'EVAL',
    RECORD_EVENT_SCRIPT,
    4,
    ...keys,
    DEFAULT_DEDUP_TTL_SECONDS,
    DEFAULT_RATE_WINDOW_SECONDS,
    config.rateLimit,
    DEFAULT_DAILY_RETENTION_SECONDS,
    pairs.length,
    ...flattenedPairs,
  ];

  const payload = await upstashRequest(config, '', command, fetchImpl);
  const result = payload.result;
  if (!Array.isArray(result) || typeof result[0] !== 'string') {
    throw new Error('Telemetry storage returned an invalid result.');
  }

  const status = result[0];
  if (!['accepted', 'duplicate', 'rate_limited'].includes(status)) {
    throw new Error('Telemetry storage returned an unknown result.');
  }

  return {
    status,
    durable: true,
    duplicate: status === 'duplicate',
    rateLimited: status === 'rate_limited',
  };
}

function parseHashResult(value) {
  if (value === null || value === undefined) return {};
  if (!Array.isArray(value)) {
    if (typeof value !== 'object') throw new Error('Telemetry aggregate result is invalid.');
    return Object.fromEntries(
      Object.entries(value).map(([field, raw]) => [field, Number.parseInt(String(raw), 10) || 0]),
    );
  }
  if (value.length % 2 !== 0) throw new Error('Telemetry aggregate result is malformed.');
  const output = {};
  for (let index = 0; index < value.length; index += 2) {
    output[String(value[index])] = Number.parseInt(String(value[index + 1]), 10) || 0;
  }
  return output;
}

export async function readTelemetryAggregates(dates, options = {}) {
  const env = options.env ?? process.env;
  const config = storageConfig(env, true);
  const fetchImpl = options.fetchImpl ?? fetch;
  const commands = [
    ['HGETALL', `${KEY_PREFIX}:totals`],
    ...dates.map((date) => ['HGETALL', `${KEY_PREFIX}:daily:${date}`]),
  ];
  const payload = await upstashRequest(config, '/pipeline', commands, fetchImpl);
  if (!Array.isArray(payload)) throw new Error('Telemetry aggregate response is invalid.');
  const results = payload.map((item) => {
    if (!item || item.error) throw new Error(item?.error || 'Telemetry aggregate command failed.');
    return parseHashResult(item.result);
  });
  return {
    totals: results[0] ?? {},
    days: dates.map((date, index) => ({ date, counters: results[index + 1] ?? {} })),
  };
}

export const telemetryStorageConstants = {
  keyPrefix: KEY_PREFIX,
  dailyRetentionDays: 730,
  duplicateTtlSeconds: DEFAULT_DEDUP_TTL_SECONDS,
  defaultRateLimitPerMinute: DEFAULT_RATE_LIMIT_PER_MINUTE,
};
