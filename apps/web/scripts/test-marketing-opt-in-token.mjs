import assert from 'node:assert/strict';
import {
  createMarketingOptInConfirmationUrl,
  createMarketingOptInToken,
  MarketingOptInTokenError,
  verifyMarketingOptInToken,
} from '../src/lib/marketing-opt-in-token.js';

const secret = `moi_${'A'.repeat(43)}`;
const requestId = '9b6f4502-d38b-4bd5-b36c-523c22481527';
const issuedAt = 1789130000;

const token = createMarketingOptInToken({
  requestId,
  purpose: 'weekly_newsletter',
  secret,
  issuedAt,
  ttlSeconds: 48 * 60 * 60,
});
assert.equal(token.includes('@'), false);
assert.equal(token.includes('weekly_newsletter'), true);

const verified = verifyMarketingOptInToken({
  token,
  secret,
  now: issuedAt + 60,
});
assert.equal(verified.requestId, requestId);
assert.equal(verified.purpose, 'weekly_newsletter');
assert.equal(verified.expiresAt, new Date((issuedAt + 48 * 60 * 60) * 1000).toISOString());

const progressToken = createMarketingOptInToken({
  requestId,
  purpose: 'learning_progress_updates',
  secret,
  issuedAt,
});
assert.equal(
  verifyMarketingOptInToken({ token: progressToken, secret, now: issuedAt + 1 }).purpose,
  'learning_progress_updates',
);

const url = createMarketingOptInConfirmationUrl({
  token,
  baseUrl: 'https://www.usd-impact.com/anything?discard=yes#fragment',
});
assert.equal(url.startsWith('https://www.usd-impact.com/email/confirm?token='), true);
assert.equal(url.includes('discard=yes'), false);
assert.equal(url.includes('#fragment'), false);

const parts = token.split('.');
parts[2] = 'learning_progress_updates';
assert.throws(
  () => verifyMarketingOptInToken({ token: parts.join('.'), secret, now: issuedAt + 1 }),
  (error) => error instanceof MarketingOptInTokenError && error.code === 'INVALID_OPT_IN_TOKEN',
);

assert.throws(
  () => verifyMarketingOptInToken({ token, secret, now: issuedAt + (48 * 60 * 60) + 1 }),
  (error) => error instanceof MarketingOptInTokenError && error.code === 'OPT_IN_TOKEN_EXPIRED' && error.status === 410,
);

assert.throws(
  () => createMarketingOptInToken({ requestId, purpose: 'product_updates', secret, issuedAt }),
  (error) => error instanceof MarketingOptInTokenError && error.code === 'INVALID_OPT_IN_PURPOSE',
);

assert.throws(
  () => createMarketingOptInToken({ requestId, purpose: 'weekly_newsletter', secret: 'weak', issuedAt }),
  (error) => error instanceof MarketingOptInTokenError && error.code === 'MARKETING_OPT_IN_CONFIGURATION_ERROR',
);

assert.throws(
  () => createMarketingOptInToken({ requestId, purpose: 'weekly_newsletter', secret, issuedAt, ttlSeconds: 73 * 60 * 60 }),
  (error) => error instanceof MarketingOptInTokenError && error.code === 'INVALID_OPT_IN_TTL',
);

assert.throws(
  () => createMarketingOptInConfirmationUrl({ token, baseUrl: 'http://www.usd-impact.com' }),
  (error) => error instanceof MarketingOptInTokenError && error.code === 'MARKETING_OPT_IN_CONFIGURATION_ERROR',
);

console.log('marketing opt-in token tests passed');
