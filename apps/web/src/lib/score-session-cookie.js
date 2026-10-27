export const SCORE_SESSION_COOKIE = '__Host-score_session';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function scoreSessionCookie(token, expiresAtMs, nowMs = Date.now()) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token) ||
      !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs ||
      expiresAtMs > nowMs + 15 * 60_000) {
    throw new TypeError('Invalid Score session');
  }
  const maxAge = Math.max(1, Math.floor((expiresAtMs - nowMs) / 1000));
  return `${SCORE_SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearScoreSessionCookie() {
  return `${SCORE_SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readScoreSessionCookie(cookieHeader) {
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 8192) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const values = parts.filter((part) => part.startsWith(`${SCORE_SESSION_COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(SCORE_SESSION_COOKIE.length + 1);
  return TOKEN_RE.test(token) ? token : null;
}
