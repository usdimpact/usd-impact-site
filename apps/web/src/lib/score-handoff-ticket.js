// Score handoff ticket primitives. NOT an HTTP endpoint or a deployed gateway.
// A production caller must supply a durable, atomic, shared ticket store.
import { createHash, randomBytes } from 'node:crypto';

const TTL_MS = 60_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const PATHS = new Set(['/en/', '/es/', '/archive/en/', '/archive/es/']);
const AUDIENCE = 'score.usd-impact.com';

export function scoreTicketDigest(ticket) {
  if (typeof ticket !== 'string' || !TOKEN_RE.test(ticket)) return null;
  return createHash('sha256').update(ticket, 'utf8').digest('hex');
}

export function scoreTicketPath(path) {
  return typeof path === 'string' && PATHS.has(path) ? path : null;
}

// store.insertIfAbsent(record) must persist the digest (never the raw ticket).
// Fail closed if the write is unavailable or unsuccessful.
export async function issueScoreTicket({ accountId, path, store, nowMs = Date.now() }) {
  if (typeof accountId !== 'string' || !/^[0-9a-f-]{36}$/i.test(accountId)) {
    throw new TypeError('Verified account ID required');
  }
  const safePath = scoreTicketPath(path);
  if (!safePath) throw new TypeError('Invalid Score destination');
  if (!store || typeof store.insertIfAbsent !== 'function') throw new TypeError('Atomic store required');
  const ticket = randomBytes(32).toString('base64url');
  const digest = scoreTicketDigest(ticket);
  const record = Object.freeze({
    digest, accountId, audience: AUDIENCE, path: safePath,
    expiresAtMs: nowMs + TTL_MS,
  });
  const inserted = await store.insertIfAbsent(record);
  if (inserted !== true) throw new Error('Ticket storage unavailable');
  return Object.freeze({ ticket, expiresAtMs: record.expiresAtMs, path: safePath });
}

// store.consume(digest) MUST atomically delete/mark consumed and return one
// record at most once across concurrent requests. Caller must recheck the
// current membership entitlement before creating a Score session.
export async function consumeScoreTicket({ ticket, store, nowMs = Date.now() }) {
  const digest = scoreTicketDigest(ticket);
  if (!digest || !store || typeof store.consume !== 'function') return null;
  const record = await store.consume(digest);
  if (!record || record.digest !== digest || record.audience !== AUDIENCE ||
      !scoreTicketPath(record.path) || !record.accountId ||
      !Number.isFinite(record.expiresAtMs) || record.expiresAtMs <= nowMs ||
      record.expiresAtMs > nowMs + TTL_MS) return null;
  return Object.freeze({ accountId: record.accountId, path: record.path });
}
