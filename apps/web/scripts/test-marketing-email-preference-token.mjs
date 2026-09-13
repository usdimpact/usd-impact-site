import assert from 'node:assert/strict';
import {
  MarketingEmailPreferenceTokenError,
  createMarketingEmailUnsubscribeHeaders,
  createMarketingEmailUnsubscribeToken,
  createMarketingEmailUnsubscribeUrl,
  verifyMarketingEmailUnsubscribeToken,
} from '../src/lib/marketing-email-preference-token.js';

const secret = `moi_${'a'.repeat(43)}`;
const hash = 'b'.repeat(64);
const grant = Object.freeze({
  idempotency_key: `consent:v1:${hash}`,
  purpose: 'weekly_newsletter',
  email_normalized: 'reader@example.com',
});

const token = createMarketingEmailUnsubscribeToken({
  consentIdempotencyKey: grant.idempotency_key,
  purpose: grant.purpose,
  secret,
});
assert.match(token, /^mu1\.[0-9a-f]{64}\.weekly_newsletter\.[A-Za-z0-9_-]{43}$/);
assert.equal(token.includes('reader@example.com'), false);

const verified = verifyMarketingEmailUnsubscribeToken({ token, secret });
assert.equal(verified.consentIdempotencyKey, grant.idempotency_key);
assert.equal(verified.purpose, 'weekly_newsletter');

const url = createMarketingEmailUnsubscribeUrl({
  grant,
  secret,
  baseUrl: 'https://www.usd-impact.com/account?ignored=1#ignored',
});
assert.equal(new URL(url).origin, 'https://www.usd-impact.com');
assert.equal(new URL(url).pathname, '/email/unsubscribe');
assert.equal(new URL(url).searchParams.get('token'), token);
assert.equal(url.includes('reader@example.com'), false);
assert.equal(url.includes('ignored'), false);

const headers = createMarketingEmailUnsubscribeHeaders({
  grant,
  secret,
  baseUrl: 'https://www.usd-impact.com',
});
assert.equal(headers['List-Unsubscribe'], `<${url}>`);
assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

assert.throws(
  () => verifyMarketingEmailUnsubscribeToken({
    token: token.replace('weekly_newsletter', 'learning_progress_updates'),
    secret,
  }),
  (error) => error instanceof MarketingEmailPreferenceTokenError
    && error.code === 'INVALID_MARKETING_EMAIL_UNSUBSCRIBE_TOKEN',
);
assert.throws(
  () => createMarketingEmailUnsubscribeToken({
    consentIdempotencyKey: grant.idempotency_key,
    purpose: 'book_availability',
    secret,
  }),
  (error) => error instanceof MarketingEmailPreferenceTokenError
    && error.code === 'INVALID_MARKETING_EMAIL_PURPOSE',
);
assert.throws(
  () => createMarketingEmailUnsubscribeUrl({
    grant,
    secret,
    baseUrl: 'http://example.com',
  }),
  (error) => error instanceof MarketingEmailPreferenceTokenError
    && error.code === 'MARKETING_EMAIL_PREFERENCE_CONFIGURATION_ERROR',
);

console.log('Marketing email preference token contract passed.');
