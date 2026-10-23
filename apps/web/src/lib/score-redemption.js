// Server-only redemption orchestration. No route is exposed until Score edge
// gateway and session storage are independently reviewed and integrated.
import { consumeScoreTicket } from './score-handoff-ticket.js';

export async function redeemScoreHandoff({
  ticket, ticketStore, membership, sessions, nowMs = Date.now(),
}) {
  if (typeof membership?.isActive !== 'function' ||
      typeof sessions?.create !== 'function') {
    throw new TypeError('Verified membership and secure session providers required');
  }
  // The atomic consume happens before the entitlement check; a failed check
  // burns the ticket. This is intentional and prevents retry races.
  const redeemed = await consumeScoreTicket({ ticket, store: ticketStore, nowMs });
  if (!redeemed) return { allowed: false, code: 'INVALID_OR_EXPIRED_TICKET' };

  // MUST query current authoritative profile + entitlement, not JWT claims,
  // cached account state, or client-provided identity.
  const active = await membership.isActive(redeemed.accountId);
  if (active !== true) return { allowed: false, code: 'RESEARCH_MEMBERSHIP_REQUIRED' };

  // sessions.create must persist an opaque, random, revocable session token
  // and return a short-lived token + expiry; NEVER reuse the handoff ticket.
  const session = await sessions.create({ accountId: redeemed.accountId, nowMs });
  if (!session || typeof session.token !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.token) ||
      !Number.isFinite(session.expiresAtMs) ||
      session.expiresAtMs <= nowMs || session.expiresAtMs > nowMs + 15 * 60_000 ||
      session.token === ticket) {
    throw new Error('Secure Score session provider unavailable');
  }
  return { allowed: true, token: session.token, expiresAtMs: session.expiresAtMs, path: redeemed.path };
}

export async function authorizeScoreSession({ token, sessions, membership, nowMs = Date.now() }) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
      typeof sessions?.lookup !== 'function' || typeof membership?.isActive !== 'function') {
    return false;
  }
  // Each premium request rechecks membership; revocation takes effect without
  // waiting for session expiry. Storage errors must propagate to a deny response.
  const session = await sessions.lookup(token);
  if (!session?.accountId || !Number.isFinite(session.expiresAtMs) ||
      session.expiresAtMs <= nowMs) return false;
  return (await membership.isActive(session.accountId)) === true;
}
