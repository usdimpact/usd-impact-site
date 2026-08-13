import assert from 'node:assert/strict';
import {
  producePaddleLiveEvidence,
  produceVercelProductionEnvironmentEvidence,
} from './release-gatekeeper-producers.mjs';

const forbiddenSecretKeys = new Set([
  'value',
  'secret',
  'secretvalue',
  'encryptedvalue',
  'apikey',
  'api_key',
  'token',
  'clienttoken',
  'client_token',
  'webhooksecret',
  'webhook_secret',
  'password',
  'authorization',
]);

function assertNoSecretMaterial(value, path = 'snapshot') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretMaterial(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[-\s]/g, '');
    assert.ok(!forbiddenSecretKeys.has(normalized), `${path}.${key} is forbidden secret-bearing material`);
    assertNoSecretMaterial(nested, `${path}.${key}`);
  }
}

function assertAuthenticatedSnapshot(snapshot, provider) {
  assert.ok(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), `${provider} audit snapshot is required`);
  assert.equal(snapshot.authenticated, true, `${provider} audit must be authenticated`);
  assert.equal(snapshot.readOnly, true, `${provider} audit must be read-only`);
  assert.equal(snapshot.valuesExposed, false, `${provider} audit must not expose secret values`);
  assertNoSecretMaterial(snapshot);
  assert.equal(typeof snapshot.ref, 'string', `${provider} audit ref is required`);
  assert.ok(Number.isFinite(Date.parse(snapshot.observedAt)), `${provider} audit observedAt must be a valid ISO timestamp`);
}

function normalizeTargets(target) {
  if (Array.isArray(target)) return target.map((item) => String(item).toLowerCase());
  if (typeof target === 'string') return [target.toLowerCase()];
  return [];
}

export function adaptAuthenticatedVercelAudit(snapshot, { releaseHead }) {
  assertAuthenticatedSnapshot(snapshot, 'Vercel');
  assert.equal(snapshot.provider, 'vercel', 'Vercel provider mismatch');
  assert.ok(['vercel-api', 'vercel-dashboard', 'owner-visible-vercel'].includes(snapshot.source), 'Unsupported authenticated Vercel source');
  assert.equal(snapshot.project?.id, 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', 'Unexpected Vercel project id');
  assert.equal(snapshot.project?.name, 'usd-impact-site', 'Unexpected Vercel project name');
  assert.ok(Array.isArray(snapshot.environmentVariables), 'Vercel environmentVariables must be an array');

  const productionNames = snapshot.environmentVariables
    .filter((entry) => normalizeTargets(entry.target).includes('production'))
    .map((entry) => entry.key)
    .filter((key) => typeof key === 'string');

  const checkoutEntry = snapshot.environmentVariables.find(
    (entry) => entry.key === 'PADDLE_CHECKOUT_ENABLED' && normalizeTargets(entry.target).includes('production'),
  );

  assert.ok(checkoutEntry, 'PADDLE_CHECKOUT_ENABLED must have a Production-scoped entry');
  assert.equal(checkoutEntry.state, 'closed', 'Production checkout audit must explicitly report CLOSED');

  return produceVercelProductionEnvironmentEvidence({
    provider: 'vercel',
    environment: 'production',
    checkoutEnabled: false,
    presentVariableNames: productionNames,
    valuesExposed: false,
    source: snapshot.source,
    ref: snapshot.ref,
    checkoutRef: snapshot.checkoutRef ?? snapshot.ref,
    observedAt: snapshot.observedAt,
    releaseHead,
  });
}

export function adaptAuthenticatedPaddleAudit(snapshot, { releaseHead }) {
  assertAuthenticatedSnapshot(snapshot, 'Paddle');
  assert.equal(snapshot.provider, 'paddle', 'Paddle provider mismatch');
  assert.ok(['paddle-api', 'paddle-dashboard', 'owner-visible-paddle'].includes(snapshot.source), 'Unsupported authenticated Paddle source');
  assert.equal(snapshot.environment, 'live', 'Paddle audit must target Live');
  assert.equal(snapshot.account?.status, 'approved', 'Paddle Live account is not approved');
  assert.equal(snapshot.domain?.hostname, 'usd-impact.com', 'Unexpected Paddle production domain');
  assert.equal(snapshot.domain?.status, 'approved', 'Paddle production domain is not approved');
  assert.equal(snapshot.catalog?.active, true, 'Paddle live catalog is not active');
  assert.equal(snapshot.credentials?.validated, true, 'Paddle live credentials are not validated');
  assert.equal(snapshot.notificationDestination?.validated, true, 'Paddle notification destination is not validated');
  assert.equal(
    snapshot.notificationDestination?.url,
    'https://www.usd-impact.com/api/paddle-webhook',
    'Unexpected Paddle notification destination',
  );

  return producePaddleLiveEvidence({
    provider: 'paddle',
    environment: 'live',
    accountApproved: true,
    domainApproved: true,
    catalogActive: true,
    credentialsValidated: true,
    notificationDestinationValidated: true,
    valuesExposed: false,
    source: snapshot.source,
    ref: snapshot.ref,
    observedAt: snapshot.observedAt,
    releaseHead,
  });
}
