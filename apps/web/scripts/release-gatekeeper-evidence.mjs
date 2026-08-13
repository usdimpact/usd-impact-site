import assert from 'node:assert/strict';

const GATES = new Set([
  'vercel-production-environment',
  'commerce-provider-live',
  'paddle-live',
  'production-data-plane',
  'checkout-closed',
  'protected-production',
]);

const SOURCES = {
  'vercel-production-environment': new Set(['vercel-api', 'vercel-dashboard', 'owner-visible-vercel']),
  'commerce-provider-live': new Set(['commerce-provider-api', 'commerce-provider-dashboard', 'owner-visible-commerce-provider']),
  'paddle-live': new Set(['paddle-api', 'paddle-dashboard', 'owner-visible-paddle']),
  'production-data-plane': new Set(['supabase-api', 'github-audit']),
  'checkout-closed': new Set(['vercel-api', 'vercel-dashboard', 'deployment-validation', 'github-actions']),
  'protected-production': new Set(['production-smoke', 'vercel-runtime', 'github-audit']),
};

const MAX_AGE_MS = {
  'vercel-production-environment': 6 * 60 * 60 * 1000,
  'commerce-provider-live': 6 * 60 * 60 * 1000,
  'paddle-live': 6 * 60 * 60 * 1000,
  'production-data-plane': 24 * 60 * 60 * 1000,
  'checkout-closed': 60 * 60 * 1000,
  'protected-production': 2 * 60 * 60 * 1000,
};

const allowedEnvelopeKeys = new Set(['schema', 'release_head', 'records']);
const allowedRecordKeys = new Set(['gate', 'status', 'source', 'ref', 'observed_at', 'release_head']);

function assertExactKeys(object, allowed, label) {
  assert.ok(object && typeof object === 'object' && !Array.isArray(object), `${label} must be an object`);
  const unexpected = Object.keys(object).filter((key) => !allowed.has(key));
  assert.deepEqual(unexpected, [], `${label} contains unsupported fields: ${unexpected.join(', ')}`);
}

function normalizeIso(value, label) {
  assert.equal(typeof value, 'string', `${label} must be an ISO timestamp string`);
  const time = Date.parse(value);
  assert.ok(Number.isFinite(time), `${label} must be a valid timestamp`);
  return time;
}

export function parseReleaseEvidence(raw, { expectedHead, now = Date.now() }) {
  assert.equal(typeof raw, 'string', 'Evidence input must be a JSON string');
  assert.ok(raw.length > 2 && raw.length <= 20000, 'Evidence JSON must be between 3 and 20000 characters');

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error('Evidence input must be valid JSON');
  }

  assertExactKeys(envelope, allowedEnvelopeKeys, 'Evidence envelope');
  assert.equal(envelope.schema, 'usd-impact.release-gate-evidence.v1', 'Unsupported evidence schema');
  assert.equal(envelope.release_head?.toLowerCase(), expectedHead.toLowerCase(), 'Evidence envelope release_head mismatch');
  assert.ok(Array.isArray(envelope.records), 'Evidence records must be an array');
  assert.ok(envelope.records.length >= 3 && envelope.records.length <= 20, 'Evidence must contain 3 to 20 records');

  const verified = new Map();
  const refs = [];

  for (const [index, record] of envelope.records.entries()) {
    assertExactKeys(record, allowedRecordKeys, `Evidence record ${index + 1}`);
    assert.ok(GATES.has(record.gate), `Evidence record ${index + 1} has unsupported gate`);
    assert.equal(record.status, 'verified', `Evidence record ${index + 1} status must be verified`);
    assert.ok(SOURCES[record.gate].has(record.source), `Evidence record ${index + 1} has unsupported source for ${record.gate}`);
    assert.equal(record.release_head?.toLowerCase(), expectedHead.toLowerCase(), `Evidence record ${index + 1} release_head mismatch`);
    assert.equal(typeof record.ref, 'string', `Evidence record ${index + 1} ref must be a string`);
    assert.match(record.ref, /^[A-Za-z0-9][A-Za-z0-9._:/#-]{2,199}$/, `Evidence record ${index + 1} ref format is invalid`);

    const observed = normalizeIso(record.observed_at, `Evidence record ${index + 1} observed_at`);
    const age = now - observed;
    assert.ok(age >= -5 * 60 * 1000, `Evidence record ${index + 1} is too far in the future`);
    assert.ok(age <= MAX_AGE_MS[record.gate], `Evidence record ${index + 1} for ${record.gate} is stale`);

    if (!verified.has(record.gate) || observed > verified.get(record.gate).observed) {
      verified.set(record.gate, { ...record, observed });
    }
    refs.push(`${record.gate}:${record.source}:${record.ref}`);
  }

  const paddleLive = verified.has('paddle-live');
  return {
    gates: {
      vercelProductionEnvironment: verified.has('vercel-production-environment'),
      commerceProviderLive: verified.has('commerce-provider-live') || paddleLive,
      paddleLive,
      productionDataPlane: verified.has('production-data-plane'),
      checkoutClosed: verified.has('checkout-closed'),
      protectedProduction: verified.has('protected-production'),
    },
    refs,
  };
}
