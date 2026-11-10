import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleDraftTwoPhaseWorker } from '../src/lib/account-deletion-two-phase-worker-review.js';

// Synthetic offline denial. Never supplies a live network client.
const environment = {
  VERCEL_ENV: 'preview',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_ROUTE_ENABLED: 'true',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_EXECUTION_APPROVED: 'true',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_SCHEMA_APPROVED: 'true',
  ACCOUNT_DELETION_TWO_PHASE_REVIEW_LEGACY_DRAINED: 'true',
  ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'false',
  ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
  EMAIL_READINESS_LEDGER_ENABLED: 'true',
  SUPABASE_URL: 'https://ycstrcvshdluovtuasjc.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  SUPABASE_SECRET_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
  CRON_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
};
const response = {
  statusCode: 0,
  setHeader() {},
  end(value) { this.body = JSON.parse(value); },
};
let calls = 0;
await handleDraftTwoPhaseWorker(
  { method: 'GET', headers: { authorization: 'Bearer ' + environment.CRON_SECRET } },
  response, {
    environment,
    fetchImpl: async () => { calls++; throw Error('No network'); },
  },
);
assert.equal(response.statusCode, 423);
assert.equal(response.body.code, 'TWO_PHASE_A_STRICT_SUPERVISION_REQUIRED');
assert.equal(response.body.deletionExecuted, false);
assert.equal(response.body.releaseApproved, false);
assert.equal(calls, 0);
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal((vercel.crons || []).some(({ path }) => /two-phase/i.test(path)), false);
assert.equal((vercel.rewrites || []).some(({ source }) => /two-phase/i.test(source)), false);
console.log('A-strict real route fail-closed regression PASS (zero external IO).');
