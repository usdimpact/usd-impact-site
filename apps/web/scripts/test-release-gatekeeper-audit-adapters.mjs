import assert from 'node:assert/strict';
import {
  adaptAuthenticatedPaddleAudit,
  adaptAuthenticatedVercelAudit,
} from './release-gatekeeper-audit-adapters.mjs';

const head = 'd2ac8bbc6611abee00f78f7f5c94509cfcc78ac5';
const now = new Date().toISOString();

const vercelSnapshot = {
  provider: 'vercel',
  authenticated: true,
  readOnly: true,
  valuesExposed: false,
  source: 'vercel-api',
  ref: 'vercel-audit:project-env:prod',
  checkoutRef: 'vercel-audit:checkout-closed',
  observedAt: now,
  project: { id: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', name: 'usd-impact-site' },
  environmentVariables: [
    { key: 'SUPABASE_URL', target: ['production'] },
    { key: 'SUPABASE_PUBLISHABLE_KEY', target: ['production'] },
    { key: 'SUPABASE_SECRET_KEY', target: ['production'] },
    { key: 'PADDLE_WEBHOOK_SECRET', target: ['production'] },
    { key: 'PADDLE_ENVIRONMENT', target: ['production'] },
    { key: 'PADDLE_API_KEY', target: ['production'] },
    { key: 'PADDLE_LAUNCH_PRICE_ID', target: ['production'] },
    { key: 'PADDLE_STANDARD_PRICE_ID', target: ['production'] },
    { key: 'PUBLIC_PADDLE_CLIENT_TOKEN', target: ['production'] },
    { key: 'PADDLE_CHECKOUT_URL', target: ['production'] },
    { key: 'PADDLE_CHECKOUT_ENABLED', target: ['production'], state: 'closed' },
  ],
};

const vercelRecords = adaptAuthenticatedVercelAudit(vercelSnapshot, { releaseHead: head });
assert.equal(vercelRecords.length, 2);
assert.equal(vercelRecords[0].gate, 'vercel-production-environment');
assert.equal(vercelRecords[1].gate, 'checkout-closed');
assert.equal(vercelRecords[0].release_head, head);

assert.throws(() => adaptAuthenticatedVercelAudit({ ...vercelSnapshot, authenticated: false }, { releaseHead: head }), /authenticated/);
assert.throws(() => adaptAuthenticatedVercelAudit({ ...vercelSnapshot, readOnly: false }, { releaseHead: head }), /read-only/);
assert.throws(() => adaptAuthenticatedVercelAudit({ ...vercelSnapshot, project: { id: 'wrong', name: 'usd-impact-site' } }, { releaseHead: head }), /project id/);
assert.throws(() => adaptAuthenticatedVercelAudit({ ...vercelSnapshot, environmentVariables: vercelSnapshot.environmentVariables.filter((e) => e.key !== 'SUPABASE_SECRET_KEY') }, { releaseHead: head }), /Missing Production variable name/);
assert.throws(() => adaptAuthenticatedVercelAudit({ ...vercelSnapshot, environmentVariables: vercelSnapshot.environmentVariables.map((e) => e.key === 'PADDLE_CHECKOUT_ENABLED' ? { ...e, state: 'open' } : e) }, { releaseHead: head }), /CLOSED/);
assert.throws(() => adaptAuthenticatedVercelAudit({ ...vercelSnapshot, secret: 'forbidden' }, { releaseHead: head }), /forbidden secret-bearing material/);

const paddleSnapshot = {
  provider: 'paddle',
  authenticated: true,
  readOnly: true,
  valuesExposed: false,
  source: 'paddle-api',
  ref: 'paddle-audit:live-readiness',
  observedAt: now,
  environment: 'live',
  account: { status: 'approved' },
  domain: { hostname: 'usd-impact.com', status: 'approved' },
  catalog: { active: true },
  credentials: { validated: true },
  notificationDestination: {
    validated: true,
    url: 'https://www.usd-impact.com/api/paddle-webhook',
  },
};

const paddleRecords = adaptAuthenticatedPaddleAudit(paddleSnapshot, { releaseHead: head });
assert.equal(paddleRecords.length, 1);
assert.equal(paddleRecords[0].gate, 'paddle-live');
assert.equal(paddleRecords[0].release_head, head);

assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, account: { status: 'pending' } }, { releaseHead: head }), /not approved/);
assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, domain: { hostname: 'example.com', status: 'approved' } }, { releaseHead: head }), /Unexpected Paddle production domain/);
assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, domain: { hostname: 'usd-impact.com', status: 'pending' } }, { releaseHead: head }), /domain is not approved/);
assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, catalog: { active: false } }, { releaseHead: head }), /catalog is not active/);
assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, credentials: { validated: false } }, { releaseHead: head }), /credentials are not validated/);
assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, notificationDestination: { validated: true, url: 'https://example.com/webhook' } }, { releaseHead: head }), /Unexpected Paddle notification destination/);
assert.throws(() => adaptAuthenticatedPaddleAudit({ ...paddleSnapshot, api_key: 'forbidden' }, { releaseHead: head }), /forbidden secret-bearing material/);

console.log('Release gatekeeper authenticated audit adapter tests passed');
