import assert from 'node:assert/strict';
import {
  DAILY_CARD_EMAIL_MAX_BATCH,
  dailyCardEmailDistributionEnabled,
  runDailyCardEmailBatch,
} from '../src/lib/daily-card-email-dispatch.js';

assert.equal(dailyCardEmailDistributionEnabled({}), false);
assert.equal(dailyCardEmailDistributionEnabled({ DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED: 'true' }), true);
assert.equal(DAILY_CARD_EMAIL_MAX_BATCH, 25);

let networkCalls = 0;
const disabled = await runDailyCardEmailBatch({
  publishDate: '2026-08-23',
  environment: {},
  fetchImpl: async () => {
    networkCalls += 1;
    throw new Error('network should not be called when disabled');
  },
});
assert.equal(disabled.enabled, false);
assert.equal(disabled.attempted, 0);
assert.equal(networkCalls, 0);

const environment = {
  DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED: 'true',
  DAILY_CARD_EMAIL_BATCH_SIZE: '25',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'p'.repeat(24)}`,
  SUPABASE_SECRET_KEY: `sb_secret_${'s'.repeat(24)}`,
  RESEND_API_KEY: `re_${'r'.repeat(24)}`,
  LAUNCH_EMAIL_FROM_EMAIL: 'USD Impact <no-reply@updates.usd-impact.com>',
  WAITLIST_UNSUBSCRIBE_SECRET: `wus_${'a'.repeat(43)}`,
};

const fetchImpl = async (url) => {
  networkCalls += 1;
  assert.match(String(url), /marketing_consent_events/);
  return new Response(JSON.stringify([]), { status: 200 });
};

const emptyAudience = await runDailyCardEmailBatch({
  publishDate: '2026-08-23',
  environment,
  fetchImpl,
  now: new Date('2026-08-23T06:10:00.000Z'),
});
assert.equal(emptyAudience.enabled, true);
assert.equal(emptyAudience.subscribers, 0);
assert.equal(emptyAudience.attempted, 0);
assert.equal(emptyAudience.accepted, 0);
assert.equal(emptyAudience.failed, 0);
assert.equal(networkCalls, 1);

await assert.rejects(
  () => runDailyCardEmailBatch({
    publishDate: '2026-08-23',
    environment: { ...environment, DAILY_CARD_EMAIL_BATCH_SIZE: '26' },
    fetchImpl,
  }),
  /between 1 and 25/,
);

console.log('Daily Card email dispatch contract: PASS');
