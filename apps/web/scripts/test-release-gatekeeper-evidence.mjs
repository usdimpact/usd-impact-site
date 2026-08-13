import assert from 'node:assert/strict';
import { parseReleaseEvidence } from './release-gatekeeper-evidence.mjs';

const head = 'f'.repeat(40);
const now = Date.parse('2026-08-13T01:30:00.000Z');
const observed = '2026-08-13T01:00:00.000Z';

const record = (gate, source, ref, overrides = {}) => ({
  gate,
  status: 'verified',
  source,
  ref,
  observed_at: observed,
  release_head: head,
  ...overrides,
});

const envelope = (records, overrides = {}) => JSON.stringify({
  schema: 'usd-impact.release-gate-evidence.v1',
  release_head: head,
  records,
  ...overrides,
});

const promotionRecords = [
  record('vercel-production-environment', 'vercel-api', 'vercel:audit-123'),
  record('paddle-live', 'paddle-dashboard', 'paddle:audit-456'),
  record('production-data-plane', 'supabase-api', 'supabase:audit-789'),
  record('checkout-closed', 'deployment-validation', 'github:run-101'),
];

{
  const result = parseReleaseEvidence(envelope(promotionRecords), { expectedHead: head, now });
  assert.equal(result.gates.vercelProductionEnvironment, true);
  assert.equal(result.gates.paddleLive, true);
  assert.equal(result.gates.productionDataPlane, true);
  assert.equal(result.gates.checkoutClosed, true);
  assert.equal(result.gates.protectedProduction, false);
  assert.equal(result.refs.length, 4);
}

{
  const result = parseReleaseEvidence(
    envelope([
      ...promotionRecords,
      record('protected-production', 'production-smoke', 'production:smoke-2026-08-13'),
    ]),
    { expectedHead: head, now },
  );
  assert.equal(result.gates.protectedProduction, true);
}

assert.throws(
  () => parseReleaseEvidence(envelope(promotionRecords, { release_head: 'e'.repeat(40) }), { expectedHead: head, now }),
  /release_head mismatch/,
);

assert.throws(
  () => parseReleaseEvidence(
    envelope([
      ...promotionRecords.slice(0, 3),
      record('checkout-closed', 'deployment-validation', 'github:run-101', {
        observed_at: '2026-08-12T23:00:00.000Z',
      }),
    ]),
    { expectedHead: head, now },
  ),
  /stale/,
);

assert.throws(
  () => parseReleaseEvidence(
    envelope([
      record('vercel-production-environment', 'paddle-api', 'wrong:source'),
      ...promotionRecords.slice(1),
    ]),
    { expectedHead: head, now },
  ),
  /unsupported source/,
);

assert.throws(
  () => parseReleaseEvidence(
    envelope([
      { ...promotionRecords[0], api_key: 'must-never-be-accepted' },
      ...promotionRecords.slice(1),
    ]),
    { expectedHead: head, now },
  ),
  /unsupported fields/,
);

assert.throws(
  () => parseReleaseEvidence('{bad-json', { expectedHead: head, now }),
  /valid JSON/,
);

assert.throws(
  () => parseReleaseEvidence(
    envelope([
      ...promotionRecords.slice(0, 3),
      record('checkout-closed', 'deployment-validation', 'github:run-101', {
        status: 'unverified',
      }),
    ]),
    { expectedHead: head, now },
  ),
  /status must be verified/,
);

assert.throws(
  () => parseReleaseEvidence(
    envelope([
      ...promotionRecords.slice(0, 3),
      record('checkout-closed', 'deployment-validation', 'github:run-101', {
        release_head: 'd'.repeat(40),
      }),
    ]),
    { expectedHead: head, now },
  ),
  /release_head mismatch/,
);

console.log('Release gatekeeper structured evidence tests passed.');
