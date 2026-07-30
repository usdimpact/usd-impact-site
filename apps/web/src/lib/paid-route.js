export const PAID_CONTENT_PREFIX = '/guided-edition';

const KNOWN_DENIAL_REASONS = new Set([
  'missing',
  'missing-profile',
  'wrong-product',
  'suspended',
  'suspended_dispute',
  'refunded',
  'charged_back',
  'revoked',
  'account_deleted',
  'deletion_pending',
  'deleted',
  'disabled',
  'expired',
  'not-started',
  'malformed',
  'unknown-state',
  'invalid-window',
]);

function normalizePathname(value) {
  const pathname = String(value || '/').replace(/\/{2,}/g, '/');
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function requestTarget(requestUrl) {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  return `${url.pathname}${url.search}`;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function isPaidContentPath(pathname) {
  const normalized = normalizePathname(pathname);
  return normalized === PAID_CONTENT_PREFIX || normalized.startsWith(`${PAID_CONTENT_PREFIX}/`);
}

export function normalizePaidAccessReason(reason) {
  return KNOWN_DENIAL_REASONS.has(reason) ? reason : 'denied';
}

export function buildPaidSignInRedirect(requestUrl) {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  const destination = new URL('/account/sign-in/', url);
  destination.searchParams.set('next', requestTarget(url));
  return destination;
}

export function buildPaidAccessRequiredRedirect(requestUrl, reason) {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  const destination = new URL('/account/access-required/', url);
  destination.searchParams.set('reason', normalizePaidAccessReason(reason));
  destination.searchParams.set('next', requestTarget(url));
  return destination;
}

export async function readPaidAccessFromAccountApi({
  requestUrl,
  cookieHeader,
  fetchImpl = fetch,
}) {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  const endpoint = new URL('/api/account-access', url);
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: String(cookieHeader || ''),
    },
    redirect: 'manual',
    cache: 'no-store',
  });

  if (response.status === 401) {
    return Object.freeze({ hasSession: false, accessState: null });
  }

  const payload = await readJsonSafely(response);
  if (!response.ok) {
    const error = new Error('Paid access could not be verified.');
    error.name = 'PaidAccessServiceError';
    error.status = response.status;
    error.code = typeof payload?.code === 'string' ? payload.code : 'PAID_ACCESS_SERVICE_FAILED';
    throw error;
  }

  const paidAccess = payload?.paidAccess;
  if (
    !paidAccess
    || typeof paidAccess !== 'object'
    || typeof paidAccess.allowed !== 'boolean'
    || typeof paidAccess.reason !== 'string'
  ) {
    const error = new Error('Paid access response was invalid.');
    error.name = 'PaidAccessServiceError';
    error.status = 502;
    error.code = 'INVALID_PAID_ACCESS_RESPONSE';
    throw error;
  }

  return Object.freeze({
    hasSession: true,
    accessState: Object.freeze({
      allowed: paidAccess.allowed,
      reason: paidAccess.reason,
      productId: typeof paidAccess.productId === 'string' ? paidAccess.productId : null,
      state: typeof paidAccess.state === 'string' ? paidAccess.state : null,
    }),
  });
}

export function decidePaidRouteAccess({ requestUrl, hasSession, accessState }) {
  if (!hasSession) {
    return Object.freeze({
      action: 'redirect',
      reason: 'authentication-required',
      location: buildPaidSignInRedirect(requestUrl).toString(),
    });
  }

  if (accessState?.allowed === true) {
    return Object.freeze({ action: 'allow', reason: 'active', location: null });
  }

  const reason = normalizePaidAccessReason(accessState?.reason);
  return Object.freeze({
    action: 'redirect',
    reason,
    location: buildPaidAccessRequiredRedirect(requestUrl, reason).toString(),
  });
}
