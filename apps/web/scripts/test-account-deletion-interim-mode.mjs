// Research P1 interim (non-destructive) deletion mode: offline regressions.
// Synthetic only: globalThis.fetch is replaced by an in-memory Supabase model;
// no connected database, Auth, merchant, email or scheduler is reached.
//
// Interim mode = the live request-intake path only. A request records a
// deletion_pending profile and an open privacy case; nothing finalizes it.
// These cases prove, against the real handlers:
//   - no Auth Admin DELETE, legacy finalization, two-phase Phase A or
//     completion email can run under interim configuration;
//   - a still-valid (or refreshed) session for a deletion_pending account is
//     denied paid content by server-side authorization, not by the frontend;
//   - the request is acknowledged as pending, never as completed;
//   - duplicate requests do not create a second case or a second email.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import accountHandler from '../api/account.js';
import { handleGuidedEditionRequest } from '../api/guided-edition.js';
import { readAccountAccessState } from '../src/lib/supabase-server.js';
import { decideResearchPreviewRequest } from '../src/lib/research-preview-route.js';
import { handleScoreMemberContent } from '../src/lib/score-member-handler.js';
import { handleScoreMembershipCheck } from '../src/lib/score-membership-handler.js';
import { handleBookDeliveryRequest } from '../src/lib/book-delivery-handler.js';
import { handleAudiobookRequest } from '../src/lib/audiobook-handler.js';
import { handleVideoLibraryRequest } from '../src/lib/video-library-handler.js';
import { getLaunchEmailTemplateSpec, renderLaunchEmail } from '../src/lib/launch-email-templates.js';
import { createAccountDeletionRequestedEmailIntent } from '../src/lib/account-deletion-email.js';

const ACCOUNT = '5f0c3a1e-7b2d-4c8e-9a1f-2b3c4d5e6f70';
const LIBRARY_PASS = 'read-the-dollar-first-guided-interactive-edition';
const RESEARCH = 'research-membership';
const OLD_ACCESS = 'interim-old-access-token-0123456789abcdef';
const NEW_ACCESS = 'interim-new-access-token-0123456789abcdef';
const REFRESH = 'interim-refresh-token-0123456789abcdef';
const CRON = 'interim-cron-secret-0123456789abcdefghijkl';
const ORIGIN = 'https://ycstrcvshdluovtuasjc.supabase.co';

// Interim configuration: what Production looks like with every destructive
// path off. Development project so a mistaken enable could not reach Prod.
const BASE_ENV = Object.freeze({
  VERCEL_ENV: 'production',
  SUPABASE_URL: ORIGIN,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_interimabcdefghijklmnop',
  SUPABASE_SECRET_KEY: 'sb_secret_interimabcdefghijklmnopqrst',
  CRON_SECRET: CRON,
  EMAIL_READINESS_LEDGER_ENABLED: 'false',
});

// Every network call is recorded and classified. Destructive or completion
// endpoints are never answered: reaching one fails the test immediately.
const FORBIDDEN = [
  ['/auth/v1/admin/', 'Auth Admin'],
  ['/rpc/prepare_account_deletion_auth_removal', 'legacy Auth detach'],
  ['/rpc/finalize_account_deletion', 'legacy SQL finalization'],
  ['/rpc/finalize_deletion_and_queue_auth_cleanup', 'two-phase Phase A'],
  ['/rpc/claim_deletion_auth_cleanup_batch', 'two-phase Auth cleanup claim'],
  ['/rpc/list_due_account_deletions', 'deletion scanner'],
  ['/rest/v1/notification_outbox', 'outbox write'],
  ['account_deletion_completed', 'completion email'],
];

let world;
function resetWorld(overrides = {}) {
  world = {
    calls: [],
    status: 'deletion_pending',
    expired: new Set(),
    entitlements: {
      [LIBRARY_PASS]: entitlementRow(LIBRARY_PASS),
      [RESEARCH]: entitlementRow(RESEARCH),
    },
    rpc: () => json(200, profileRow('deletion_pending')),
    ...overrides,
  };
}
function entitlementRow(productId) {
  return {
    id: `ent-${productId.slice(0, 8)}`, account_id: ACCOUNT, product_id: productId,
    state: 'active', starts_at: '2026-09-02T10:00:00.000Z', ends_at: null,
    version: 1, updated_at: '2026-09-02T10:00:00.000Z',
  };
}
function profileRow(status) {
  return {
    account_id: ACCOUNT, email: 'interim@invalid.example', status,
    deletion_requested_at: '2026-11-06T10:00:00.000Z',
    deletion_due_at: '2026-11-13T10:00:00.000Z', deleted_at: null,
  };
}
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

globalThis.fetch = async (url, init = {}) => {
  const href = String(url);
  world.calls.push(href);
  for (const [needle, label] of FORBIDDEN) {
    if (href.includes(needle) || String(init.body || '').includes(needle)) {
      throw new Error(`INTERIM MODE VIOLATION: ${label} reached (${needle})`);
    }
  }
  assert.ok(href.startsWith(ORIGIN + '/'), 'only the synthetic Development origin');
  const auth = String(init.headers?.Authorization || init.headers?.authorization || '');
  const token = auth.replace(/^Bearer /, '');
  if (href.endsWith('/auth/v1/user')) {
    if (world.expired.has(token)) return json(401, { msg: 'JWT expired' });
    if (token !== OLD_ACCESS && token !== NEW_ACCESS) return json(401, { msg: 'invalid' });
    return json(200, { id: ACCOUNT, email: 'interim@invalid.example', email_confirmed_at: '2026-09-01T00:00:00Z' });
  }
  if (href.includes('/auth/v1/token?grant_type=refresh_token')) {
    const body = JSON.parse(init.body);
    if (body.refresh_token !== REFRESH) return json(400, { error: 'invalid_grant' });
    return json(200, {
      access_token: NEW_ACCESS, refresh_token: REFRESH + '-rotated',
      expires_in: 3600, token_type: 'bearer',
      user: { id: ACCOUNT, email: 'interim@invalid.example' },
    });
  }
  if (href.includes('/rest/v1/profiles?')) return json(200, [profileRow(world.status)]);
  if (href.includes('/rest/v1/entitlements?')) {
    const product = decodeURIComponent(href.match(/product_id=eq\.([^&]+)/)?.[1] || '');
    const row = world.entitlements[product];
    return json(200, row ? [row] : []);
  }
  if (href.endsWith('/rest/v1/rpc/request_account_deletion')) return world.rpc();
  throw new Error('Unexpected synthetic Supabase call: ' + href);
};

function mockResponse() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    getHeader(key) { return this.headers[String(key).toLowerCase()]; },
    end(payload = '') { this.body = String(payload); },
    json() { return JSON.parse(this.body); },
  };
}
function cookieRequest({ url, method = 'GET', access = OLD_ACCESS, refresh = null, extra = {} }) {
  const cookies = [];
  if (access) cookies.push(`usd_impact_access=${access}`);
  if (refresh) cookies.push(`usd_impact_refresh=${refresh}`);
  return { url, method, headers: { cookie: cookies.join('; '), host: 'usd-impact.com', ...extra } };
}
async function withEnv(env, run) {
  const saved = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (/^(ACCOUNT_DELETION_|EMAIL_READINESS_|SCORE_|VERCEL_ENV$|SUPABASE_|CRON_SECRET$)/.test(key)) delete process.env[key];
  }
  Object.assign(process.env, env);
  try { return await run(); } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}
const noDestructiveCalls = () => world.calls.every((href) => !FORBIDDEN.some(([n]) => href.includes(n)));

let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed += 1; };

// ---------------------------------------------------------------------------
// 1. Accidental finalizer execution: the scheduled legacy route and both
//    Draft two-phase routes stay inert under interim configuration, even
//    with a valid scheduler secret and partial or near-miss flag values.
// ---------------------------------------------------------------------------
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
check(
  JSON.stringify((vercel.crons || []).filter(({ path }) => path.includes('deletion')))
    === JSON.stringify([{ path: '/api/account-deletion-finalizer', schedule: '20 4 * * *' }]),
  'only the gated legacy finalizer is scheduled; no Draft deletion cron exists',
);
const cronGet = (actionName) => ({
  url: `/api/account?action=${actionName}`, method: 'GET',
  headers: { authorization: 'Bearer ' + CRON },
});
const nearMisses = [
  {},
  { ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'TRUE' },
  { ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: ' true' },
  { ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: '1' },
  { ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'false', ACCOUNT_DELETION_FINALIZER_ENABLED: 'true' },
];
for (const flags of nearMisses) {
  resetWorld();
  const res = mockResponse();
  await withEnv({ ...BASE_ENV, ...flags }, () => accountHandler(cronGet('deletion-finalizer'), res));
  check(res.statusCode === 404 && res.json().code === 'ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED'
      && world.calls.length === 0,
    'legacy finalizer route disabled with zero network calls: ' + JSON.stringify(flags));
}
// Even if the route flag alone is switched on by mistake, Production needs
// separate finalizer and Production approvals; it fails before any request.
{
  // Route flag alone: the finalizer reports itself disabled and does nothing.
  resetWorld();
  const res = mockResponse();
  await withEnv({ ...BASE_ENV, ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'true' },
    () => accountHandler(cronGet('deletion-finalizer'), res));
  const body = res.json();
  check(res.statusCode === 200 && body.enabled === false && body.finalized === 0
      && body.scanned === 0 && world.calls.length === 0,
    'route flag alone: finalizer reports enabled=false and makes zero network calls');
}
for (const flags of [
  { ACCOUNT_DELETION_FINALIZER_ENABLED: 'true', EMAIL_READINESS_LEDGER_ENABLED: 'true' },
  { ACCOUNT_DELETION_FINALIZER_ENABLED: 'true', EMAIL_READINESS_LEDGER_ENABLED: 'true', ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED: 'true' },
  { ACCOUNT_DELETION_FINALIZER_ENABLED: 'true', EMAIL_READINESS_LEDGER_ENABLED: 'true', EMAIL_READINESS_PRODUCTION_APPROVED: 'true' },
]) {
  // Route and finalizer on, but Production approvals incomplete: refused
  // before any request.
  resetWorld();
  const res = mockResponse();
  await withEnv({ ...BASE_ENV, ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'true', ...flags },
    () => accountHandler(cronGet('deletion-finalizer'), res));
  check(res.statusCode === 503 && res.json().code === 'ACCOUNT_DELETION_PRODUCTION_NOT_APPROVED'
      && world.calls.length === 0,
    'Production approvals incomplete: refused before any request: ' + JSON.stringify(flags));
}
for (const actionName of ['deletion-two-phase-review', 'deletion-two-phase-preflight']) {
  for (const flags of [{}, { ACCOUNT_DELETION_TWO_PHASE_REVIEW_ROUTE_ENABLED: 'true', ACCOUNT_DELETION_TWO_PHASE_PREFLIGHT_ROUTE_ENABLED: 'true' }]) {
    resetWorld();
    const res = mockResponse();
    await withEnv({ ...BASE_ENV, ...flags }, () => accountHandler(cronGet(actionName), res));
    check(res.statusCode >= 400 && world.calls.length === 0 && res.json().releaseApproved !== true,
      `${actionName} refuses in Production with zero network calls: ${JSON.stringify(flags)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. A still-valid session for a deletion_pending account: authentication
//    succeeds, paid authorization is denied server-side for every product.
//    Library Pass rights stay on record (entitlement row returned, untouched).
// ---------------------------------------------------------------------------
await withEnv(BASE_ENV, async () => {
  for (const productId of [LIBRARY_PASS, RESEARCH]) {
    resetWorld();
    const state = await readAccountAccessState({ accessToken: OLD_ACCESS, productId });
    check(state.allowed === false && state.reason === 'deletion_pending'
        && state.user.id === ACCOUNT && state.entitlement?.state === 'active',
      `${productId}: valid JWT authenticates but is denied; entitlement record preserved`);
  }
  // Control: the same data with an active profile is allowed, so the denial
  // above comes from the profile status, not from a broken fixture.
  resetWorld({ status: 'active' });
  check((await readAccountAccessState({ accessToken: OLD_ACCESS, productId: LIBRARY_PASS })).allowed === true,
    'control: active profile with the same entitlement is allowed');

  // Library Pass pages (Guided Edition): denied before any content read.
  resetWorld();
  let contentReads = 0;
  const res = mockResponse();
  await handleGuidedEditionRequest(
    cookieRequest({ url: '/api/guided-edition?__paid_path=chapter-1' }), res,
    { environment: BASE_ENV, readContent: async () => { contentReads += 1; return null; } },
  );
  check(res.statusCode === 302 && /access-required/.test(res.headers.location)
      && /deletion_pending/.test(res.headers.location) && contentReads === 0,
    'Library Pass content: deletion_pending redirected to access-required, nothing read');

  // Account access endpoint reports not allowed.
  resetWorld();
  const accessRes = mockResponse();
  await accountHandler(cookieRequest({ url: '/api/account?action=access' }), accessRes);
  const accessBody = accessRes.json();
  check(accessRes.statusCode === 200 && accessBody.paidAccess?.allowed === false
      && accessBody.paidAccess?.reason === 'deletion_pending'
      && accessBody.account?.status === 'deletion_pending',
    'account access endpoint: paidAccess.allowed=false, reason and status deletion_pending');

  // Score member content (Research product) refuses with 403.
  resetWorld();
  const scoreRes = mockResponse();
  await handleScoreMemberContent(
    cookieRequest({ url: '/api/account?action=score-member-content&path=/en/' }), scoreRes,
    { environment: { ...BASE_ENV, SCORE_VERCEL_MEMBER_GATE_ENABLED: 'true' } },
  );
  check(scoreRes.statusCode === 403, 'Score member content: 403 for deletion_pending');

  // Research Preview gate: the real access reader returns the raw active
  // Research entitlement for a non-active profile; the gate must not use it.
  for (const status of ['deletion_pending', 'deleted', 'suspended']) {
    resetWorld({ status });
    const decision = await decideResearchPreviewRequest({
      request: new Request('https://preview.usd-impact.invalid/reports/weekly/2026-08-28/', {
        headers: { cookie: `usd_impact_access=${OLD_ACCESS}` },
      }),
      environment: { ...BASE_ENV, VERCEL_ENV: 'preview' },
    });
    check(decision.action === 'redirect' && /access-required/.test(decision.location),
      `Research Preview gate denies ${status} despite an active Research entitlement`);
  }
  resetWorld({ status: 'active' });
  const allowed = await decideResearchPreviewRequest({
    request: new Request('https://preview.usd-impact.invalid/reports/weekly/2026-08-28/', {
      headers: { cookie: `usd_impact_access=${OLD_ACCESS}` },
    }),
    environment: { ...BASE_ENV, VERCEL_ENV: 'preview' },
  });
  check(allowed.action === 'allow', 'control: active Research member still allowed in Preview');
});

// ---------------------------------------------------------------------------
// 2b. Remaining paid handlers that share the same server-side reader:
//     Library Pass book, audiobook and video library, and the Score
//     membership check. Signing and token minting must never be reached.
// ---------------------------------------------------------------------------
await withEnv(BASE_ENV, async () => {
  const paid = [
    ['book', handleBookDeliveryRequest, '/api/guided-edition?__book=1&__book_path=chapter-1', 'createSignedUrl'],
    ['audiobook', handleAudiobookRequest, '/api/guided-edition?__audiobook=1&__audio_path=track-01', 'createSignedUrl'],
    ['video library', handleVideoLibraryRequest, '/api/guided-edition?__video_library=1&__video_path=intro', 'createToken'],
  ];
  for (const [label, handler, url, signer] of paid) {
    resetWorld();
    let minted = 0;
    const res = mockResponse();
    await handler(cookieRequest({ url }), res, {
      environment: BASE_ENV,
      [signer]: async () => { minted += 1; return 'https://signed.invalid/never'; },
    });
    const location = String(res.headers.location || '');
    check([302, 303, 403].includes(res.statusCode) && minted === 0
        && (res.statusCode === 403 || /access-required/.test(location)),
      `Library Pass ${label}: deletion_pending denied before any signed URL or token`);
  }
  resetWorld({ status: 'active' });
  const control = mockResponse();
  await handleBookDeliveryRequest(cookieRequest({ url: '/api/guided-edition?__book=1' }), control,
    { environment: BASE_ENV, createSignedUrl: async () => 'https://signed.invalid/never' });
  check(control.statusCode === 200, 'control: active Library Pass holder reaches the protected book page');

  resetWorld();
  const membership = mockResponse();
  await handleScoreMembershipCheck(cookieRequest({ url: '/api/account?action=score-membership' }), membership);
  check(membership.statusCode === 403 && membership.json().allowed === false,
    'Score membership check: 403 allowed=false for deletion_pending');
});

// ---------------------------------------------------------------------------
// 2c. Secretless verification probe (documented owner procedure): an
//     UNAUTHENTICATED GET reports only whether a deletion route is switched
//     on (404 off, 401 on) and never executes it, even with every flag set.
// ---------------------------------------------------------------------------
{
  const unauth = (actionName) => ({ url: `/api/account?action=${actionName}`, method: 'GET', headers: {} });
  const allOn = {
    ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED: 'true',
    ACCOUNT_DELETION_FINALIZER_ENABLED: 'true',
    ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED: 'true',
    EMAIL_READINESS_LEDGER_ENABLED: 'true',
    EMAIL_READINESS_PRODUCTION_APPROVED: 'true',
    ACCOUNT_DELETION_TWO_PHASE_REVIEW_ROUTE_ENABLED: 'true',
    ACCOUNT_DELETION_TWO_PHASE_PREFLIGHT_ROUTE_ENABLED: 'true',
  };
  for (const [actionName, offCode] of [
    ['deletion-finalizer', 'ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED'],
    ['deletion-two-phase-review', 'TWO_PHASE_REVIEW_ROUTE_DISABLED'],
    ['deletion-two-phase-preflight', null],
  ]) {
    resetWorld();
    const off = mockResponse();
    await withEnv(BASE_ENV, () => accountHandler(unauth(actionName), off));
    check(off.statusCode === 404 && (offCode === null || off.json().code === offCode) && world.calls.length === 0,
      `probe ${actionName}: route off answers 404 without secrets or network`);
    resetWorld();
    const on = mockResponse();
    await withEnv({ ...BASE_ENV, ...allOn }, () => accountHandler(unauth(actionName), on));
    check(on.statusCode === 401 && world.calls.length === 0,
      `probe ${actionName}: route on answers 401 and never executes, even with every flag set`);
  }
}

// ---------------------------------------------------------------------------
// 3. Token refresh: an expired access token with a valid refresh token is
//    renewed (authentication continues) and the renewed session is denied.
// ---------------------------------------------------------------------------
await withEnv(BASE_ENV, async () => {
  resetWorld();
  world.expired.add(OLD_ACCESS);
  const res = mockResponse();
  let contentReads = 0;
  await handleGuidedEditionRequest(
    cookieRequest({ url: '/api/guided-edition?__paid_path=chapter-1', refresh: REFRESH }), res,
    { environment: BASE_ENV, readContent: async () => { contentReads += 1; return null; } },
  );
  const cookies = [].concat(res.headers['set-cookie'] || []).join(' ');
  check(world.calls.some((h) => h.includes('grant_type=refresh_token'))
      && cookies.includes(NEW_ACCESS),
    'refresh succeeds for a deletion_pending account (Auth identity intact)');
  check(res.statusCode === 302 && /deletion_pending/.test(res.headers.location) && contentReads === 0,
    'refreshed session is still denied paid content');
  check(noDestructiveCalls(), 'refresh path makes no destructive or completion call');
});

// ---------------------------------------------------------------------------
// 4. Request intake: acknowledged as pending, never as complete. Duplicate
//    requests do not create a second case or a second email.
// ---------------------------------------------------------------------------
await withEnv(BASE_ENV, async () => {
  resetWorld({ status: 'active' });
  const res = mockResponse();
  await accountHandler(cookieRequest({
    url: '/api/account?action=delete', method: 'POST',
    extra: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  }), res);
  const body = res.json();
  check(res.statusCode === 202 && body.ok === true && body.status === 'deletion_pending'
      && !('deletedAt' in body) && !/complet/i.test(JSON.stringify(body)),
    'request acknowledged 202 as deletion_pending, with no completion claim');
  check(world.calls.filter((h) => h.endsWith('/rpc/request_account_deletion')).length === 1
      && noDestructiveCalls(),
    'intake calls only the request RPC: no Auth Admin, finalization or completion email');

  resetWorld({
    status: 'deletion_pending',
    rpc: () => json(400, { code: 'P0001', message: 'account is not eligible for deletion request' }),
  });
  const dup = mockResponse();
  await accountHandler(cookieRequest({
    url: '/api/account?action=delete', method: 'POST',
    extra: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  }), dup);
  check(dup.statusCode >= 400 && dup.json().ok !== true && noDestructiveCalls()
      && !world.calls.some((h) => h.includes('notification_outbox')),
    'duplicate request is refused without a second email intent');
});

const requested = getLaunchEmailTemplateSpec('account_deletion_requested');
const rendered = renderLaunchEmail({ messageId: 'account_deletion_requested', reference: 'interim-ref-0001' });
const requestedText = JSON.stringify(requested) + JSON.stringify(rendered);
check(/being processed/.test(requested.subject) && !/deletion (?:is |process is )?complete|has been deleted|account (?:is|was) deleted|permanently|will be deleted on/i.test(requestedText)
    && /being processed|is recorded/i.test(requestedText),
  'acknowledgement email says "being processed", never complete, deleted or permanent');
for (const status of ['active', 'deleted', 'suspended']) {
  assert.throws(() => createAccountDeletionRequestedEmailIntent({
    deletionResult: { user: { id: ACCOUNT, email: 'interim@invalid.example' }, profile: profileRow(status) },
  }), undefined, status);
  passed += 1;
}

console.log('Research P1 interim deletion mode regressions passed (' + passed + ' checks).');
