import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const waitlistApi = readFileSync(new URL('../api/waitlist.js', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

assert.match(
  waitlistApi,
  /handleMarketingEmailPreferencesRequest[\s\S]*from '\.\.\/src\/lib\/marketing-email-preferences-handler\.js';/,
);
assert.match(
  waitlistApi,
  /if \(action\.startsWith\('marketing-email-'\)\) \{[\s\S]*?handleMarketingEmailPreferencesRequest\(request, response, action\)/,
);

assert.deepEqual(
  vercel.rewrites.find((entry) => entry.source === '/email/unsubscribe'),
  { source: '/email/unsubscribe', destination: '/api/waitlist?action=marketing-email-unsubscribe' },
);
assert.deepEqual(
  vercel.rewrites.find((entry) => entry.source === '/api/email-preferences'),
  { source: '/api/email-preferences', destination: '/api/waitlist?action=marketing-email-preferences' },
);

const unsubscribeHeaders = vercel.headers.find((entry) => entry.source === '/email/unsubscribe');
assert.ok(unsubscribeHeaders, 'Marketing unsubscribe route must have explicit privacy headers.');
const headerMap = Object.fromEntries(unsubscribeHeaders.headers.map(({ key, value }) => [key, value]));
assert.equal(headerMap['Cache-Control'], 'private, no-store');
assert.equal(headerMap['X-Robots-Tag'], 'noindex, nofollow');
assert.equal(headerMap['Referrer-Policy'], 'no-referrer');

console.log('Marketing email preference shared-routing contract passed.');
