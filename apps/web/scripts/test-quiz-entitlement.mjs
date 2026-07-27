import assert from 'node:assert/strict';
import accessMap from '../src/data/quiz-access-map.json' with { type: 'json' };
import middleware from '../middleware.js';
import {
  advanceQuizEntitlement,
  canAccessQuizOrder,
  createInitialQuizEntitlement,
  readQuizEntitlement,
  serializeQuizEntitlementCookie,
  signQuizEntitlement,
} from '../src/lib/quiz-entitlement.js';

const secret = 'test-secret-that-is-longer-than-thirty-two-characters';
const totalQuizzes = accessMap.quizzes.length;
const now = Date.UTC(2026, 6, 27, 12, 0, 0);
const initial = createInitialQuizEntitlement(totalQuizzes, now);

assert.equal(initial.highestUnlockedOrder, 1);
assert.equal(initial.sequenceCompleted, false);
assert.equal(canAccessQuizOrder(initial, 1), true);
assert.equal(canAccessQuizOrder(initial, 2), false);

const signed = signQuizEntitlement(initial, secret);
const valid = readQuizEntitlement(`other=1; usd-impact-learning-progress=${signed}`, secret, totalQuizzes, now + 1000);
assert.equal(valid.valid, true);
assert.deepEqual(valid.entitlement.completedQuizIds, []);

const tampered = readQuizEntitlement(`usd-impact-learning-progress=${signed.slice(0, -1)}x`, secret, totalQuizzes, now + 1000);
assert.equal(tampered.valid, false);
assert.equal(tampered.entitlement.highestUnlockedOrder, 1);

const expiredPayload = { ...initial, issuedAt: initial.issuedAt - 1000, expiresAt: initial.issuedAt - 1 };
const expired = readQuizEntitlement(`usd-impact-learning-progress=${signQuizEntitlement(expiredPayload, secret)}`, secret, totalQuizzes, now);
assert.equal(expired.valid, false);

const quiz1 = accessMap.quizzes[0];
const afterQuiz1 = advanceQuizEntitlement(initial, quiz1, totalQuizzes, now + 2000);
assert.equal(afterQuiz1.highestUnlockedOrder, 2);
assert.deepEqual(afterQuiz1.completedQuizIds, [quiz1.canonicalId]);

const repeatedQuiz1 = advanceQuizEntitlement(afterQuiz1, quiz1, totalQuizzes, now + 3000);
assert.equal(repeatedQuiz1.highestUnlockedOrder, 2);
assert.deepEqual(repeatedQuiz1.completedQuizIds, [quiz1.canonicalId]);

process.env.QUIZ_PROGRESS_SECRET = secret;
const openQuiz1 = middleware(new Request('https://www.usd-impact.com/start-here/quiz'));
assert.equal(openQuiz1, undefined);

const blockedFuture = middleware(new Request('https://www.usd-impact.com/fx/usd-and-currency-risk/quiz'));
assert.equal(blockedFuture.status, 302);
assert.equal(new URL(blockedFuture.headers.get('location')).pathname, '/start-here/');

const cookie = serializeQuizEntitlementCookie(afterQuiz1, secret).split(';', 1)[0];
const openDollarLesson = middleware(new Request('https://www.usd-impact.com/dollar/what-is-the-us-dollar', { headers: { cookie } }));
assert.equal(openDollarLesson, undefined);

const stillBlocked = middleware(new Request('https://www.usd-impact.com/fx/fx-depreciation-vs-inflation', { headers: { cookie } }));
assert.equal(stillBlocked.status, 302);
assert.equal(new URL(stillBlocked.headers.get('location')).pathname, '/dollar/what-is-the-us-dollar/');

console.log('Quiz entitlement and middleware tests passed.');
