/** Bounded user-scoped library reads. No privileged-key fallback or retries. */
import { readSupabaseServerConfig } from './supabase-server.js';
export const GUIDED_BATCH_TIMEOUT_MS = 5000;
export const LIMITS = Object.freeze({ chapters: 64, idCharacters: 128, pathBytes: 6144, bodyBytes: 131072 });
export const SELECT = 'account_id,content_id,status,progress_percent,resume_position,mastery_score,attempt_count,completed_at,data,updated_at';
const fields = SELECT.split(',');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const contentId = /^guided-edition:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const unavailable = code => Object.freeze({ status: 'unavailable', code });

/** Scope must come from the existing, already verified member and validated catalogue. */
export function buildBatchReadPlan(accountId, contentIds) {
  if (typeof accountId !== 'string' || !uuid.test(accountId)) throw new TypeError('INVALID_ACCOUNT');
  if (!Array.isArray(contentIds) || contentIds.length > LIMITS.chapters) throw new TypeError('CATALOGUE_BOUND');
  if (contentIds.some(id => typeof id !== 'string' || id.length > LIMITS.idCharacters || !contentId.test(id))) {
    throw new TypeError('INVALID_CONTENT_ID');
  }
  if (new Set(contentIds).size !== contentIds.length) throw new TypeError('DUPLICATE_CONTENT_ID');
  const ids = Object.freeze([...contentIds]);
  if (ids.length === 0) return Object.freeze({ accountId: accountId.toLowerCase(), contentIds: ids, requestCount: 0, request: null });
  const query = new URLSearchParams({
    account_id: 'eq.' + accountId.toLowerCase(),
    content_id: 'in.(' + ids.join(',') + ')',
    select: SELECT,
    order: 'content_id.asc',
    offset: '0',
    limit: String(ids.length + 1),
  });
  const path = '/rest/v1/learning_progress?' + query.toString();
  if (Buffer.byteLength(path) > LIMITS.pathBytes) throw new TypeError('QUERY_BOUND');
  return Object.freeze({ accountId: accountId.toLowerCase(), contentIds: ids, requestCount: 1,
    request: Object.freeze({ method: 'GET', path, credentialMode: 'existing_publishable_key_and_verified_user_token',
      headers: Object.freeze({ Accept: 'application/json', Prefer: 'count=exact' }) }) });
}

/**
 * Reconcile a bounded response obtained by the transport below.
 * A complete response proves only the visible filtered result, not absence of RLS-hidden rows.
 * Completion describes only rows visible to this authenticated request, not hidden rows.
 */
export function reconcileBatch(plan, receipt) {
  if (!plan || !Array.isArray(plan.contentIds) || plan.requestCount !== 1) return unavailable('INVALID_PLAN');
  if (!isObject(receipt) || receipt.redirected === true || ![200, 206].includes(receipt.status)) return unavailable('HTTP_NOT_COMPLETE');
  if (!/^application\/json(?:\s*;|$)/i.test(receipt.contentType || '')) return unavailable('NOT_JSON');
  const preferences = String(receipt.preferenceApplied || '').split(',').map(x => x.trim().toLowerCase());
  if (!preferences.includes('count=exact') || preferences.some(x => x.startsWith('count=') && x !== 'count=exact')) {
    return unavailable('EXACT_COUNT_UNCONFIRMED');
  }
  let bytes;
  if (typeof receipt.body === 'string') bytes = Buffer.from(receipt.body, 'utf8');
  else if (receipt.body instanceof Uint8Array) bytes = receipt.body;
  else return unavailable('INVALID_BODY');
  if (bytes.byteLength > LIMITS.bodyBytes) return unavailable('BODY_BOUND');
  let rows;
  try { rows = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { return unavailable('INVALID_JSON'); }
  if (!Array.isArray(rows) || rows.length > plan.contentIds.length) return unavailable('INVALID_ROW_COUNT');
  const range = String(receipt.contentRange || '');
  let total;
  if (rows.length === 0) {
    if (range !== '*/0') return unavailable('EMPTY_NOT_CONFIRMED');
    total = 0;
  } else {
    const match = /^0-(0|[1-9][0-9]*)\/(0|[1-9][0-9]*)$/.exec(range);
    if (!match) return unavailable('INVALID_RANGE');
    const end = Number(match[1]);
    total = Number(match[2]);
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(end) || end !== rows.length - 1 || total !== rows.length) {
      return unavailable('INCOMPLETE_RESULT');
    }
  }
  const allowed = new Set(plan.contentIds);
  const byId = new Map();
  for (const row of rows) {
    if (!isObject(row) || fields.some(field => !Object.hasOwn(row, field))) return unavailable('INVALID_ROW');
    if (row.account_id !== plan.accountId) return unavailable('WRONG_ACCOUNT');
    if (!allowed.has(row.content_id)) return unavailable('UNREQUESTED_CONTENT');
    if (byId.has(row.content_id)) return unavailable('DUPLICATE_ROW');
    if (!isObject(row.data)) return unavailable('INVALID_PROGRESS_DATA');
    if (!['started', 'in_progress', 'completed'].includes(row.status)
      || !Number.isInteger(row.progress_percent) || row.progress_percent < 0 || row.progress_percent > 100
      || !(row.mastery_score === null || (Number.isInteger(row.mastery_score) && row.mastery_score >= 0 && row.mastery_score <= 100))
      || !Number.isSafeInteger(row.attempt_count) || row.attempt_count < 0
      || !(row.resume_position === null || (typeof row.resume_position === 'string' && row.resume_position.length <= 80))
      || ![row.completed_at, row.updated_at].every(value => value === null || (typeof value === 'string'
        && value.length <= 64 && Number.isFinite(Date.parse(value))))) return unavailable('INVALID_PROGRESS_FIELDS');
    // Retain the selected fields only; no unexpected provider fields are projected.
    byId.set(row.content_id, Object.fromEntries(fields.map(field => [field, row[field]])));
  }
  return { status: 'complete', visibleCount: total, missingVisibleCount: plan.contentIds.length - total,
    rowsByChapter: plan.contentIds.map(id => ({ contentId: id, row: byId.get(id) ?? null })) };
}


function batchFailure() {
  return new Error('GUIDED_BATCH_UNAVAILABLE');
}

async function readBoundedBody(response, signal) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared)
    || !Number.isSafeInteger(Number(declared)) || Number(declared) > LIMITS.bodyBytes)) throw batchFailure();
  if (!response.body || typeof response.body.getReader !== 'function') throw batchFailure();
  const reader = response.body.getReader();
  // Cancellation is best effort and must never extend the local deadline.
  const cancel = () => { try { void Promise.resolve(reader.cancel()).catch(() => {}); } catch {} };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let total = 0;
  let finished = false;
  try {
    while (true) {
      if (signal.aborted) throw batchFailure();
      const { done, value } = await reader.read();
      if (done) { finished = true; break; }
      if (!(value instanceof Uint8Array) || total + value.byteLength > LIMITS.bodyBytes) throw batchFailure();
      total += value.byteLength;
      chunks.push(value);
    }
    if (signal.aborted) throw batchFailure();
    return Buffer.concat(chunks, total);
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!finished) cancel();
    reader.releaseLock();
  }
}

/**
 * Caller supplies the already verified account and its user access token.
 * The batch uses the publishable key + user token, preserving the RLS path.
 * The helper never inspects config.secretKey. All failures have static codes;
 * provider payloads, tokens and account IDs are never placed in an error message.
 */
export async function readGuidedLearningProgressBatch({
  accessToken, accountId, contentIds, environment, config, fetchImpl = fetch,
} = {}) {
  let plan;
  let target;
  let publishableKey;
  try {
    plan = buildBatchReadPlan(accountId, contentIds);
    if (plan.requestCount === 0) return {
      status: 'complete', visibleCount: 0, missingVisibleCount: 0, rowsByChapter: [],
    };
    if (typeof accessToken !== 'string' || !/^[\x21-\x7E]{20,16384}$/.test(accessToken)) return unavailable('INVALID_USER_TOKEN');
    const resolved = config || readSupabaseServerConfig(environment);
    const origin = new URL(resolved.url);
    if (origin.protocol !== 'https:' || origin.username || origin.password
      || origin.search || origin.hash || origin.pathname !== '/') return unavailable('INVALID_ORIGIN');
    publishableKey = resolved.publishableKey;
    if (typeof publishableKey !== 'string' || !/^sb_publishable_[\x21-\x7E]{16,}$/.test(publishableKey)) {
      return unavailable('INVALID_PUBLISHABLE_KEY');
    }
    target = origin.origin + plan.request.path;
    if (typeof fetchImpl !== 'function') return unavailable('INVALID_TRANSPORT');
  } catch {
    return unavailable('INVALID_BATCH_CONFIGURATION');
  }
  const controller = new AbortController();
  let expired = false;
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      resolve(unavailable('TIMEOUT'));
    }, GUIDED_BATCH_TIMEOUT_MS);
  });
  try {
    const operation = (async () => {
      const response = await fetchImpl(target, {
        method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { ...plan.request.headers, apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
      });
      if (controller.signal.aborted) return unavailable('TIMEOUT');
      if (!response || response.redirected || response.url !== target
        || ![200, 206].includes(response.status)) return unavailable('HTTP_NOT_COMPLETE');
      const contentType = response.headers.get('content-type');
      if (!/^application\/json(?:\s*;|$)/i.test(contentType || '')) return unavailable('NOT_JSON');
      if (response.headers.get('range-unit')?.toLowerCase() !== 'items') return unavailable('RANGE_UNIT_UNCONFIRMED');
      const body = await readBoundedBody(response, controller.signal);
      return reconcileBatch(plan, {
        status: response.status, redirected: false, contentType,
        preferenceApplied: response.headers.get('preference-applied'),
        contentRange: response.headers.get('content-range'), body,
      });
    })().catch(() => unavailable(expired ? 'TIMEOUT' : 'READ_FAILED'));
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
