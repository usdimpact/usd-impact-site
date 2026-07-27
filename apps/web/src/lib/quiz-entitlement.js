import { createHmac, timingSafeEqual } from 'node:crypto';

export const QUIZ_PROGRESS_COOKIE = 'usd-impact-learning-progress';
export const QUIZ_ENTITLEMENT_VERSION = 1;
export const QUIZ_PROGRESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function unixSeconds(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000);
}

function requireSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('QUIZ_PROGRESS_SECRET is missing or too short.');
  }
  return secret;
}

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signatureFor(encodedPayload, secret) {
  return createHmac('sha256', requireSecret(secret)).update(encodedPayload).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function cookieValue(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key === name) return part.slice(index + 1).trim();
  }
  return null;
}

function sanitizeCompletedIds(value, totalQuizzes) {
  if (!Array.isArray(value) || value.length > totalQuizzes) return null;
  const ids = [];
  for (const item of value) {
    if (typeof item !== 'string' || !/^quiz-[a-z0-9-]{1,96}$/.test(item)) return null;
    if (!ids.includes(item)) ids.push(item);
  }
  return ids;
}

function validatePayload(payload, totalQuizzes, nowMs) {
  const now = unixSeconds(nowMs);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.version !== QUIZ_ENTITLEMENT_VERSION) return null;
  if (!Number.isInteger(payload.highestUnlockedOrder) || payload.highestUnlockedOrder < 1 || payload.highestUnlockedOrder > totalQuizzes) return null;
  if (typeof payload.sequenceCompleted !== 'boolean') return null;
  if (!Number.isInteger(payload.issuedAt) || !Number.isInteger(payload.expiresAt)) return null;
  if (payload.issuedAt > now + 300 || payload.expiresAt <= now) return null;
  const completedQuizIds = sanitizeCompletedIds(payload.completedQuizIds, totalQuizzes);
  if (!completedQuizIds) return null;
  return {
    version: QUIZ_ENTITLEMENT_VERSION,
    highestUnlockedOrder: payload.highestUnlockedOrder,
    completedQuizIds,
    sequenceCompleted: payload.sequenceCompleted,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export function createInitialQuizEntitlement(totalQuizzes, nowMs = Date.now()) {
  if (!Number.isInteger(totalQuizzes) || totalQuizzes < 1) throw new Error('totalQuizzes must be a positive integer.');
  const issuedAt = unixSeconds(nowMs);
  return {
    version: QUIZ_ENTITLEMENT_VERSION,
    highestUnlockedOrder: 1,
    completedQuizIds: [],
    sequenceCompleted: false,
    issuedAt,
    expiresAt: issuedAt + QUIZ_PROGRESS_MAX_AGE_SECONDS,
  };
}

export function signQuizEntitlement(entitlement, secret) {
  const encodedPayload = encode(JSON.stringify(entitlement));
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

export function readQuizEntitlement(cookieHeader, secret, totalQuizzes, nowMs = Date.now()) {
  const initial = createInitialQuizEntitlement(totalQuizzes, nowMs);
  if (typeof secret !== 'string' || secret.length < 32) {
    return { valid: false, reason: 'unconfigured', entitlement: initial };
  }
  const token = cookieValue(cookieHeader, QUIZ_PROGRESS_COOKIE);
  if (!token) return { valid: false, reason: 'missing', entitlement: initial };
  const separator = token.lastIndexOf('.');
  if (separator <= 0 || separator === token.length - 1) return { valid: false, reason: 'malformed', entitlement: initial };
  const encodedPayload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = signatureFor(encodedPayload, secret);
  if (!safeEqual(suppliedSignature, expectedSignature)) return { valid: false, reason: 'invalid-signature', entitlement: initial };
  try {
    const payload = JSON.parse(decode(encodedPayload));
    const entitlement = validatePayload(payload, totalQuizzes, nowMs);
    return entitlement
      ? { valid: true, reason: 'valid', entitlement }
      : { valid: false, reason: 'invalid-payload', entitlement: initial };
  } catch {
    return { valid: false, reason: 'invalid-payload', entitlement: initial };
  }
}

export function canAccessQuizOrder(entitlement, order) {
  return Boolean(entitlement?.sequenceCompleted) || order <= (entitlement?.highestUnlockedOrder ?? 1);
}

export function advanceQuizEntitlement(entitlement, quiz, totalQuizzes, nowMs = Date.now()) {
  const current = validatePayload(entitlement, totalQuizzes, nowMs)
    ?? createInitialQuizEntitlement(totalQuizzes, nowMs);
  const completedQuizIds = current.completedQuizIds.includes(quiz.canonicalId)
    ? current.completedQuizIds
    : [...current.completedQuizIds, quiz.canonicalId];
  const isCurrentCheckpoint = quiz.order === current.highestUnlockedOrder;
  const sequenceCompleted = current.sequenceCompleted || (isCurrentCheckpoint && quiz.order === totalQuizzes);
  const highestUnlockedOrder = sequenceCompleted
    ? totalQuizzes
    : (isCurrentCheckpoint ? Math.min(totalQuizzes, quiz.order + 1) : current.highestUnlockedOrder);
  const issuedAt = unixSeconds(nowMs);
  return {
    version: QUIZ_ENTITLEMENT_VERSION,
    highestUnlockedOrder,
    completedQuizIds,
    sequenceCompleted,
    issuedAt,
    expiresAt: issuedAt + QUIZ_PROGRESS_MAX_AGE_SECONDS,
  };
}

export function serializeQuizEntitlementCookie(entitlement, secret) {
  const value = signQuizEntitlement(entitlement, secret);
  return `${QUIZ_PROGRESS_COOKIE}=${value}; Max-Age=${QUIZ_PROGRESS_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
