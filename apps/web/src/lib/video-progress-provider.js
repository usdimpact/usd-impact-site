// Only the video-progress persistence phase uses these bounds. Authentication,
// session refresh and entitlement checks are unchanged and outside this budget.
export const VIDEO_PROGRESS_STORAGE_TIMEOUT_MS = 5_000;
export const VIDEO_PROGRESS_ROW_BYTES = 16_384;
export const VIDEO_PROGRESS_LIST_BYTES = 524_288;
const MAX_ROWS = 1_000;
const CONTENT_ID = /^video:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(['started', 'in_progress', 'completed']);
const DECIMAL = /^\d+(?:\.\d+)?$/;

export class VideoProgressProviderError extends Error {
  constructor(message, { status, code }) {
    super(message);
    this.name = 'VideoProgressProviderError';
    this.status = status;
    this.code = code;
  }
}

function invalidResponse() {
  return new VideoProgressProviderError('Saved video progress is temporarily unavailable.', {
    status: 502, code: 'VIDEO_PROGRESS_RESPONSE_INVALID',
  });
}

function uncertainWrite() {
  // A 409 is deliberately non-retryable by the existing r2 player. Do not turn
  // an unrepresented or timed-out write into a false ACK or an automatic retry.
  return new VideoProgressProviderError('The video progress save could not be confirmed. Reload before syncing again.', {
    status: 409, code: 'VIDEO_PROGRESS_SAVE_UNCONFIRMED',
  });
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function position(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && DECIMAL.test(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 86_400 ? number : null;
}

function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function validateVideoProgressRows(rows, accountId, contentId = null) {
  if (!Array.isArray(rows) || rows.length > (contentId ? 1 : MAX_ROWS)) throw invalidResponse();
  const seen = new Set();
  for (const row of rows) {
    if (!object(row) || row.account_id !== accountId || typeof row.content_id !== 'string' || !CONTENT_ID.test(row.content_id)
      || (contentId && row.content_id !== contentId) || seen.has(row.content_id)
      || !STATUSES.has(row.status) || !Number.isInteger(row.progress_percent)
      || row.progress_percent < 0 || row.progress_percent > 100
      || position(row.resume_position) === null
      || (row.status === 'completed' && row.progress_percent !== 100)
      || (row.status !== 'completed' && row.progress_percent === 100)
      || (row.status === 'started' && (position(row.resume_position) !== 0 || row.progress_percent !== 0))) {
      throw invalidResponse();
    }
    if (row.completed_at != null && !timestamp(row.completed_at)) throw invalidResponse();
    if (row.data !== undefined && row.data !== null && !object(row.data)) throw invalidResponse();
    if (row.data?.durationSeconds !== undefined) {
      const duration = row.data.durationSeconds;
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > 86_400
        || position(row.resume_position) > duration + 0.051) throw invalidResponse();
    }
    if (row.data?.contentType !== undefined && row.data.contentType !== 'video') throw invalidResponse();
    seen.add(row.content_id);
  }
  return Object.freeze(rows.map(row => Object.freeze({ ...row })));
}

export function validateVideoProgressSave(rows, submitted) {
  try {
    validateVideoProgressRows(rows, submitted.account_id, submitted.content_id);
    if (rows.length !== 1) throw invalidResponse();
    const row = rows[0];
    if (row.status !== submitted.status || row.progress_percent !== submitted.progress_percent
      || Math.abs(position(row.resume_position) - Number(submitted.resume_position)) > 0.000001
      || !object(row.data) || row.data.contentType !== 'video'
      || row.data.durationSeconds !== submitted.data.durationSeconds
      || (submitted.completed_at && (!timestamp(row.completed_at)
        || Date.parse(row.completed_at) !== Date.parse(submitted.completed_at)))) throw invalidResponse();
    return Object.freeze({ ...row });
  } catch {
    throw uncertainWrite();
  }
}

// A returned representation can accompany an explicitly rolled-back transaction.
// Reject that negative evidence; do not force commit or require a preference header
// from providers that use the default transaction behavior.
function reportsRollback(headers) {
  const applied = headers?.get('preference-applied') || '';
  return /(?:^|,)\s*tx\s*=\s*(?:rollback|"rollback")\s*(?:;|,|$)/i.test(applied);
}

function cancelBody(body) {
  try { void body?.cancel?.().catch(() => {}); } catch { /* best-effort cleanup */ }
}

async function readBoundedJson(response, limit, signal, ensureActive) {
  const mime = response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
  const rawLength = response.headers?.get('content-length');
  if (mime !== 'application/json' || !response.body?.getReader
    || (rawLength !== null && rawLength !== undefined
      && (!/^\d+$/.test(rawLength) || Number(rawLength) > limit))) {
    cancelBody(response.body);
    throw invalidResponse();
  }
  const reader = response.body.getReader();
  const cancel = () => cancelBody(reader);
  signal.addEventListener('abort', cancel, { once: true });
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    ensureActive();
    while (true) {
      const { done, value } = await reader.read();
      ensureActive();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw invalidResponse();
      bytes += value.byteLength;
      if (bytes > limit) throw invalidResponse();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    ensureActive();
    return JSON.parse(text);
  } catch (error) {
    cancel();
    if (error instanceof VideoProgressProviderError) throw error;
    throw invalidResponse();
  } finally {
    signal.removeEventListener('abort', cancel);
    try { reader.releaseLock(); } catch { /* cancellation may still be pending */ }
  }
}

// The single timer spans the previous-row GET, POST, both bodies and validation.
// No retries. Abort bounds local waiting; it cannot prove remote rollback.
export async function runVideoProgressStorage({ config, accessToken, fetchImpl = fetch }, operation) {
  const controller = new AbortController();
  const startedAt = performance.now();
  let active = true;
  let dispatchedWrite = false;
  let timeout;
  const timeoutError = () => dispatchedWrite ? uncertainWrite() : new VideoProgressProviderError(
    'Saved video progress timed out.', { status: 504, code: 'VIDEO_PROGRESS_TIMEOUT' },
  );
  const ensureActive = () => {
    if (!active || controller.signal.aborted || performance.now() - startedAt >= VIDEO_PROGRESS_STORAGE_TIMEOUT_MS) {
      throw timeoutError();
    }
  };
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      active = false;
      controller.abort();
      reject(timeoutError());
    }, VIDEO_PROGRESS_STORAGE_TIMEOUT_MS);
  });
  const request = async (path, { method = 'GET', body, maxBytes = VIDEO_PROGRESS_ROW_BYTES } = {}) => {
    ensureActive();
    const isWrite = method === 'POST';
    if (!['GET', 'POST'].includes(method) || !path.startsWith('/rest/v1/learning_progress?')) {
      throw invalidResponse();
    }
    try {
      // Mark dispatch before awaiting: a transport error may follow a commit.
      if (isWrite) dispatchedWrite = true;
      const response = await fetchImpl(`${config.url}${path}`, {
        method,
        headers: {
          Accept: 'application/json', 'Content-Type': 'application/json',
          apikey: config.publishableKey, Authorization: `Bearer ${accessToken || config.publishableKey}`,
          ...(isWrite ? { Prefer: 'resolution=merge-duplicates,return=representation' } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal, redirect: 'error', cache: 'no-store',
      });
      if (!active) { cancelBody(response?.body); throw timeoutError(); }
      if (!response || !Number.isInteger(response.status) || response.redirected
        || !(isWrite ? [200, 201] : [200]).includes(response.status)) {
        cancelBody(response?.body);
        const status = response?.status;
        // Retain definite HTTP denials, without exporting provider error text.
        if (Number.isInteger(status) && status >= 400 && status < 500 && !(isWrite && status === 408)) {
          throw new VideoProgressProviderError('The video progress request was rejected.', {
            status, code: 'VIDEO_PROGRESS_REQUEST_REJECTED',
          });
        }
        if (isWrite) throw uncertainWrite();
        throw new VideoProgressProviderError('Saved video progress is temporarily unavailable.', {
          status: Number.isInteger(status) && status >= 500 && status < 600 ? status : 502,
          code: 'VIDEO_PROGRESS_PROVIDER_FAILED',
        });
      }
      if (isWrite && reportsRollback(response.headers)) {
        cancelBody(response.body);
        throw uncertainWrite();
      }
      return await readBoundedJson(response, maxBytes, controller.signal, ensureActive);
    } catch (error) {
      if (isWrite && !(error instanceof VideoProgressProviderError && error.code === 'VIDEO_PROGRESS_REQUEST_REJECTED')) {
        throw uncertainWrite();
      }
      if (error instanceof VideoProgressProviderError) throw error;
      throw new VideoProgressProviderError('Saved video progress is temporarily unavailable.', {
        status: 502, code: 'VIDEO_PROGRESS_PROVIDER_FAILED',
      });
    }
  };
  try {
    const task = Promise.resolve().then(() => operation({ request, ensureActive })).then(value => {
      ensureActive();
      return value;
    });
    return await Promise.race([task, deadline]);
  } finally {
    active = false;
    clearTimeout(timeout);
    controller.abort();
  }
}
