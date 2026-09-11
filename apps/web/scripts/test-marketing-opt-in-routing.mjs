import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const waitlistApi = readFileSync(new URL('../api/waitlist.js', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

assert.match(
  waitlistApi,
  /handleMarketingOptInConfirmation[\s\S]*handleMarketingOptInRequest[\s\S]*from '\.\.\/src\/lib\/marketing-opt-in-handler\.js';/,
);
assert.match(
  waitlistApi,
  /if \(action === 'marketing-opt-in'\) \{[\s\S]*?handleMarketingOptInRequest\(request, response\)/,
);
assert.match(
  waitlistApi,
  /if \(action === 'marketing-opt-in-confirm'\) \{[\s\S]*?handleMarketingOptInConfirmation\(request, response\)/,
);

const subscribeRewrite = vercel.rewrites.find((entry) => entry.source === '/api/email-subscribe');
const confirmRewrite = vercel.rewrites.find((entry) => entry.source === '/api/email-confirm');
assert.deepEqual(subscribeRewrite, {
  source: '/api/email-subscribe',
  destination: '/api/waitlist?action=marketing-opt-in',
});
assert.deepEqual(confirmRewrite, {
  source: '/api/email-confirm',
  destination: '/api/waitlist?action=marketing-opt-in-confirm',
});

assert.equal(
  existsSync(new URL('../api/email-subscribe.js', import.meta.url)),
  false,
  'Opt-in subscribe must not create a standalone Vercel function.',
);
assert.equal(
  existsSync(new URL('../api/email-confirm.js', import.meta.url)),
  false,
  'Opt-in confirmation must not create a standalone Vercel function.',
);

console.log('Marketing opt-in shared routing contract passed.');
