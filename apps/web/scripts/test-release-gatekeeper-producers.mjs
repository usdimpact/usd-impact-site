import assert from 'node:assert/strict';
import {
  produceVercelProductionEnvironmentEvidence,
  producePaddleLiveEvidence,
  buildReleaseEvidenceEnvelope,
} from './release-gatekeeper-producers.mjs';

const head = 'a'.repeat(40);
const now = '2026-08-13T01:20:00.000Z';
const variables = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'PADDLE_WEBHOOK_SECRET',
  'PADDLE_ENVIRONMENT',
  'PADDLE_API_KEY',
  'PADDLE_LAUNCH_PRICE_ID',
  'PADDLE_STANDARD_PRICE_ID',
  'PUBLIC_PADDLE_CLIENT_TOKEN',
  'PADDLE_CHECKOUT_URL',
];

const vercel = {
  provider: 'vercel',
  environment: 'production',
  checkoutEnabled: false,
  presentVariableNames: variables,
  valuesExposed: false,
  source: 'vercel-api',
  ref: 'vercel:audit:12345',
  checkoutRef: 'vercel:checkout:12345',
  observedAt: now,
  releaseHead: head,
};

const paddle = {
  provider: 'paddle',
  environment: 'live',
  accountApproved: true,
  domainApproved: true,
  catalogActive: true,
  credentialsValidated: true,
  notificationDestinationValidated: true,
  valuesExposed: false,
  source: 'paddle-api',
  ref: 'paddle:audit:67890',
  observedAt: now,
  releaseHead: head,
};

const vercelRecords = produceVercelProductionEnvironmentEvidence(vercel);
assert.equal(vercelRecords.length, 2);
assert.equal(vercelRecords[0].gate, 'vercel-production-environment');
assert.equal(vercelRecords[1].gate, 'checkout-closed');

const paddleRecords = producePaddleLiveEvidence(paddle);
assert.equal(paddleRecords.length, 1);
assert.equal(paddleRecords[0].gate, 'paddle-live');

const envelope = buildReleaseEvidenceEnvelope({ releaseHead: head, records: [...vercelRecords, ...paddleRecords] });
assert.equal(envelope.schema, 'usd-impact.release-gate-evidence.v1');
assert.equal(envelope.records.length, 3);

assert.throws(() => produceVercelProductionEnvironmentEvidence({ ...vercel, checkoutEnabled: true }), /Checkout must remain CLOSED/);
assert.throws(() => produceVercelProductionEnvironmentEvidence({ ...vercel, presentVariableNames: variables.filter((x) => x !== 'SUPABASE_SECRET_KEY') }), /Missing Production variable name: SUPABASE_SECRET_KEY/);
assert.doesNotThrow(() => produceVercelProductionEnvironmentEvidence({ ...vercel, presentVariableNames: variables.filter((x) => !x.startsWith('PADDLE_') && x !== 'PUBLIC_PADDLE_CLIENT_TOKEN') }));
assert.throws(() => produceVercelProductionEnvironmentEvidence({ ...vercel, valuesExposed: true }), /must not expose secret values/);
assert.throws(() => produceVercelProductionEnvironmentEvidence({ ...vercel, source: 'manual' }), /Unsupported Vercel evidence source/);

assert.throws(() => producePaddleLiveEvidence({ ...paddle, accountApproved: false }), /account is not approved/);
assert.throws(() => producePaddleLiveEvidence({ ...paddle, domainApproved: false }), /domain is not approved/);
assert.throws(() => producePaddleLiveEvidence({ ...paddle, catalogActive: false }), /catalog is not active/);
assert.throws(() => producePaddleLiveEvidence({ ...paddle, credentialsValidated: false }), /credentials are not validated/);
assert.throws(() => producePaddleLiveEvidence({ ...paddle, notificationDestinationValidated: false }), /notification destination is not validated/);
assert.throws(() => producePaddleLiveEvidence({ ...paddle, valuesExposed: true }), /must not expose secret values/);
assert.throws(() => producePaddleLiveEvidence({ ...paddle, source: 'manual' }), /Unsupported Paddle evidence source/);

assert.throws(() => buildReleaseEvidenceEnvelope({ releaseHead: head, records: [{ ...paddleRecords[0], release_head: 'b'.repeat(40) }] }), /record release SHA mismatch/);

console.log('release gatekeeper producer tests passed');
