import assert from 'node:assert/strict';
import { assembleReleaseEvidence } from './assemble-release-evidence.mjs';

const releaseHead = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const now = Date.parse('2026-08-13T02:30:00.000Z');
const observedAt = '2026-08-13T02:20:00.000Z';

const requiredEnvNames = [
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
  'PADDLE_CHECKOUT_ENABLED',
];

function vercelAudit(overrides = {}) {
  return {
    provider: 'vercel',
    authenticated: true,
    readOnly: true,
    valuesExposed: false,
    source: 'vercel-api',
    ref: 'vercel-api:project-env:prj-test:20260813T022000Z',
    checkoutRef: 'vercel-api:checkout-gate:prj-test:20260813T022000Z',
    observedAt,
    project: {
      id: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
      name: 'usd-impact-site',
    },
    environmentVariables: requiredEnvNames.map((key) => ({
      key,
      target: ['production'],
      ...(key === 'PADDLE_CHECKOUT_ENABLED' ? { state: 'closed' } : {}),
    })),
    ...overrides,
  };
}

function paddleAudit(overrides = {}) {
  return {
    provider: 'paddle',
    authenticated: true,
    readOnly: true,
    valuesExposed: false,
    source: 'paddle-api',
    ref: 'paddle-api:live-readiness:20260813T022000Z',
    observedAt,
    environment: 'live',
    account: { status: 'approved' },
    domain: { hostname: 'usd-impact.com', status: 'approved' },
    catalog: { active: true },
    credentials: { validated: true },
    notificationDestination: {
      validated: true,
      url: 'https://www.usd-impact.com/api/paddle-webhook',
    },
    ...overrides,
  };
}

function dataPlane(overrides = {}) {
  return {
    gate: 'production-data-plane',
    status: 'verified',
    source: 'github-audit',
    ref: 'github-audit:production-data-plane:20260813T022000Z',
    observed_at: observedAt,
    release_head: releaseHead,
    ...overrides,
  };
}

{
  const envelope = assembleReleaseEvidence({
    releaseHead,
    vercelAudit: vercelAudit(),
    paddleAudit: paddleAudit(),
    productionDataPlaneRecord: dataPlane(),
    now,
  });
  assert.equal(envelope.schema, 'usd-impact.release-gate-evidence.v1');
  assert.equal(envelope.release_head, releaseHead);
  assert.equal(envelope.records.length, 4);
  assert.deepEqual(envelope.records.map((record) => record.gate).sort(), [
    'checkout-closed',
    'paddle-live',
    'production-data-plane',
    'vercel-production-environment',
  ]);
}

{
  const audit = vercelAudit();
  audit.apiKey = 'must-never-pass';
  assert.throws(
    () => assembleReleaseEvidence({ releaseHead, vercelAudit: audit, paddleAudit: paddleAudit(), productionDataPlaneRecord: dataPlane(), now }),
    /forbidden secret-bearing material/,
  );
}

{
  const audit = vercelAudit({
    environmentVariables: requiredEnvNames
      .filter((key) => key !== 'SUPABASE_SECRET_KEY')
      .map((key) => ({ key, target: ['production'], ...(key === 'PADDLE_CHECKOUT_ENABLED' ? { state: 'closed' } : {}) })),
  });
  assert.throws(
    () => assembleReleaseEvidence({ releaseHead, vercelAudit: audit, paddleAudit: paddleAudit(), productionDataPlaneRecord: dataPlane(), now }),
    /Missing Production variable name: SUPABASE_SECRET_KEY/,
  );
}

{
  const audit = vercelAudit();
  audit.environmentVariables = audit.environmentVariables.map((entry) =>
    entry.key === 'PADDLE_CHECKOUT_ENABLED' ? { ...entry, state: 'open' } : entry,
  );
  assert.throws(
    () => assembleReleaseEvidence({ releaseHead, vercelAudit: audit, paddleAudit: paddleAudit(), productionDataPlaneRecord: dataPlane(), now }),
    /must explicitly report CLOSED/,
  );
}

{
  assert.throws(
    () => assembleReleaseEvidence({
      releaseHead,
      vercelAudit: vercelAudit(),
      paddleAudit: paddleAudit({ domain: { hostname: 'usd-impact.com', status: 'pending' } }),
      productionDataPlaneRecord: dataPlane(),
      now,
    }),
    /domain is not approved/,
  );
}

{
  assert.throws(
    () => assembleReleaseEvidence({
      releaseHead,
      vercelAudit: vercelAudit(),
      paddleAudit: paddleAudit(),
      productionDataPlaneRecord: dataPlane({ release_head: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
      now,
    }),
    /release SHA mismatch/,
  );
}

{
  assert.throws(
    () => assembleReleaseEvidence({
      releaseHead,
      vercelAudit: vercelAudit({ observedAt: '2026-08-12T18:00:00.000Z' }),
      paddleAudit: paddleAudit(),
      productionDataPlaneRecord: dataPlane(),
      now,
    }),
    /vercel-production-environment is stale/,
  );
}

{
  assert.throws(
    () => assembleReleaseEvidence({
      releaseHead,
      vercelAudit: vercelAudit(),
      paddleAudit: paddleAudit(),
      productionDataPlaneRecord: dataPlane({ observed_at: '2026-08-11T22:00:00.000Z' }),
      now,
    }),
    /production-data-plane is stale/,
  );
}

console.log('Release evidence envelope assembler tests passed');
