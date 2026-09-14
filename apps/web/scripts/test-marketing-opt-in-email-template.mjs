import assert from 'node:assert/strict';
import {
  MarketingOptInEmailTemplateError,
  buildMarketingOptInConfirmationEmail,
} from '../src/lib/marketing-opt-in-email-template.js';

const confirmationUrl = 'https://usd-impact-site-example.vercel.app/email/confirm?token=m1.test-token';

const weekly = buildMarketingOptInConfirmationEmail({
  purpose: 'weekly_newsletter',
  confirmationUrl,
});
assert.equal(weekly.subject, 'Confirm your Weekly USD Impact email');
assert.match(weekly.text, /published USD Impact Weekly Score/i);
assert.match(weekly.text, /not a forecast, trading signal/i);
assert.match(weekly.text, /No subscription is activated unless you explicitly confirm/i);
assert.match(weekly.text, /KELA LEADS S\.R\.L\./);
assert.match(weekly.html, /^<!DOCTYPE html>/);
assert.match(weekly.html, /<table /i);
assert.match(weekly.html, /Review and confirm/);
assert.match(weekly.html, /Opening it does not subscribe you/i);
assert.match(weekly.html, /support@usd-impact\.com/);
assert.doesNotMatch(weekly.html, /<div\b/i);
assert.doesNotMatch(weekly.html, /<form\b/i);
assert.doesNotMatch(weekly.html, /<input\b/i);
assert.doesNotMatch(weekly.html, /<button\b/i);
assert.doesNotMatch(weekly.html, /reader@example\.com/i);

const progress = buildMarketingOptInConfirmationEmail({
  purpose: 'learning_progress_updates',
  confirmationUrl,
});
assert.equal(progress.subject, 'Confirm USD Impact learning progress updates');
assert.match(progress.text, /educational follow-ups/i);
assert.match(progress.text, /not market alerts or personalized investment advice/i);
assert.notEqual(progress.subject, weekly.subject);

assert.throws(
  () => buildMarketingOptInConfirmationEmail({ purpose: 'book_availability', confirmationUrl }),
  (error) => error instanceof MarketingOptInEmailTemplateError && error.code === 'INVALID_OPT_IN_PURPOSE',
);
assert.throws(
  () => buildMarketingOptInConfirmationEmail({
    purpose: 'weekly_newsletter',
    confirmationUrl: 'http://example.com/email/confirm?token=m1.test',
  }),
  (error) => error instanceof MarketingOptInEmailTemplateError && error.code === 'INVALID_CONFIRMATION_URL',
);
assert.throws(
  () => buildMarketingOptInConfirmationEmail({
    purpose: 'weekly_newsletter',
    confirmationUrl: 'https://www.usd-impact.com/email/confirm',
  }),
  (error) => error instanceof MarketingOptInEmailTemplateError && error.code === 'INVALID_CONFIRMATION_URL',
);
assert.throws(
  () => buildMarketingOptInConfirmationEmail({
    purpose: 'weekly_newsletter',
    confirmationUrl: 'https://www.usd-impact.com/account/?token=m1.test',
  }),
  (error) => error instanceof MarketingOptInEmailTemplateError && error.code === 'INVALID_CONFIRMATION_URL',
);

console.log('Marketing opt-in confirmation renderer contract passed.');
