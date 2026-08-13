import assert from 'node:assert/strict';

const refPattern = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{2,199}$/;
const shaPattern = /^[0-9a-f]{40}$/;

function baseRecord({ gate, source, ref, observedAt, releaseHead }) {
  assert.match(releaseHead, shaPattern, 'releaseHead must be a full lowercase SHA');
  assert.match(ref, refPattern, 'ref must be a non-secret evidence reference');
  assert.ok(Number.isFinite(Date.parse(observedAt)), 'observedAt must be a valid ISO timestamp');
  return {
    gate,
    status: 'verified',
    source,
    ref,
    observed_at: observedAt,
    release_head: releaseHead,
  };
}

export function produceVercelProductionEnvironmentEvidence(input) {
  assert.equal(input.provider, 'vercel', 'Vercel evidence provider mismatch');
  assert.equal(input.environment, 'production', 'Vercel evidence must target Production');
  assert.equal(input.checkoutEnabled, false, 'Checkout must remain CLOSED');
  const required = new Set([
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
  ]);
  const present = new Set(input.presentVariableNames ?? []);
  for (const name of required) assert.ok(present.has(name), `Missing Production variable name: ${name}`);
  assert.equal(input.valuesExposed, false, 'Producer must not expose secret values');
  assert.ok(['vercel-api', 'vercel-dashboard', 'owner-visible-vercel'].includes(input.source), 'Unsupported Vercel evidence source');

  return [
    baseRecord({
      gate: 'vercel-production-environment',
      source: input.source,
      ref: input.ref,
      observedAt: input.observedAt,
      releaseHead: input.releaseHead,
    }),
    baseRecord({
      gate: 'checkout-closed',
      source: input.source === 'owner-visible-vercel' ? 'vercel-dashboard' : input.source,
      ref: input.checkoutRef ?? input.ref,
      observedAt: input.observedAt,
      releaseHead: input.releaseHead,
    }),
  ];
}

export function producePaddleLiveEvidence(input) {
  assert.equal(input.provider, 'paddle', 'Paddle evidence provider mismatch');
  assert.equal(input.environment, 'live', 'Paddle evidence must target Live');
  assert.equal(input.accountApproved, true, 'Paddle Live account is not approved');
  assert.equal(input.domainApproved, true, 'Paddle production domain is not approved');
  assert.equal(input.catalogActive, true, 'Paddle live catalog is not active');
  assert.equal(input.credentialsValidated, true, 'Paddle live credentials are not validated');
  assert.equal(input.notificationDestinationValidated, true, 'Paddle live notification destination is not validated');
  assert.equal(input.valuesExposed, false, 'Producer must not expose secret values');
  assert.ok(['paddle-api', 'paddle-dashboard', 'owner-visible-paddle'].includes(input.source), 'Unsupported Paddle evidence source');

  return [
    baseRecord({
      gate: 'paddle-live',
      source: input.source,
      ref: input.ref,
      observedAt: input.observedAt,
      releaseHead: input.releaseHead,
    }),
  ];
}

export function buildReleaseEvidenceEnvelope({ releaseHead, records }) {
  assert.match(releaseHead, shaPattern, 'releaseHead must be a full lowercase SHA');
  assert.ok(Array.isArray(records) && records.length > 0, 'records are required');
  for (const record of records) {
    assert.equal(record.release_head, releaseHead, 'record release SHA mismatch');
  }
  return {
    schema: 'usd-impact.release-gate-evidence.v1',
    release_head: releaseHead,
    records,
  };
}
