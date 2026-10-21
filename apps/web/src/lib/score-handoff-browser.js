// Browser-only, fail-closed handoff request. No session token is kept in
// localStorage, query parameters, referrers or analytics.
const ALLOWED_SCORE_PATHS = new Set(['/en/', '/es/', '/archive/en/', '/archive/es/']);
const OPAQUE_TICKET = /^[A-Za-z0-9_-]{43}$/;

export function validScoreHandoffPayload(value, requestedPath) {
  if (!value || value.allowed !== true || !ALLOWED_SCORE_PATHS.has(requestedPath) ||
      value.path !== requestedPath || !OPAQUE_TICKET.test(value.ticket || '') ||
      typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) {
    return false;
  }
  return true;
}

export async function requestScoreHandoff(path, fetchImpl = fetch) {
  if (!ALLOWED_SCORE_PATHS.has(path)) return { ok: false, code: 'INVALID_SCORE_PATH' };
  let response;
  try {
    response = await fetchImpl('/api/score-handoff', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch {
    return { ok: false, code: 'HANDOFF_UNAVAILABLE' };
  }
  if (response.status !== 200) {
    return { ok: false, code: response.status === 401 ? 'AUTHENTICATION_REQUIRED'
      : response.status === 403 ? 'RESEARCH_MEMBERSHIP_REQUIRED'
        : 'HANDOFF_UNAVAILABLE' };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, code: 'INVALID_HANDOFF_RESPONSE' };
  }
  if (!validScoreHandoffPayload(payload, path)) {
    return { ok: false, code: 'INVALID_HANDOFF_RESPONSE' };
  }
  return { ok: true, ticket: payload.ticket, path };
}
