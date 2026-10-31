import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { handleTransactionalLocaleRequest } from '../src/lib/transactional-locale-handler.js';

// Offline, fake identity and fake network only. Never uses a real access
// token, changes Development profiles, contacts PostgREST or sends email.
const accountId = '123e4567-e89b-42d3-a456-426614174000';
const otherAccountId = '223e4567-e89b-42d3-a456-426614174000';
const fakeAccessToken = 'ui02-synthetic-token-not-real-'.padEnd(70, 'x');
const verifiedAt = '2026-10-30T18:00:00.000Z';
const fakeConfig = Object.freeze({
  url: 'https://ycstrcvshdluovtuasjc.supabase.co',
  publishableKey: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  secretKey: null,
});
const development = Object.freeze({
  VERCEL_ENV: 'preview',
  ACCOUNT_TRANSACTIONAL_LOCALE_UI_ENABLED: 'true',
  ACCOUNT_TRANSACTIONAL_LOCALE_WRITE_ENABLED: 'true',
});
const activeState = Object.freeze({
  user: { id: accountId, emailConfirmedAt: verifiedAt, email: 'example@test.invalid' },
  profile: { account_id: accountId, status: 'active' },
  allowed: false, // Entitlement is unrelated to account settings.
});
const verifiedPreference = (locale = 'es', revision = 1, id = accountId) => ({
  account_id: id,
  preferred_locale: locale,
  selection_provenance: 'authenticated_account',
  revision,
  updated_at: '2026-10-30T20:00:00.000Z',
});
function response() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(data) { this.body = JSON.parse(data); },
  };
}
function request(method = 'GET', body = undefined, headerOverride = {}) {
  return {
    method,
    url: '/api/account?action=transactional-locale',
    headers: {
      host: 'ui02-preview.example.test',
      origin: 'https://ui02-preview.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...headerOverride,
    },
    body,
  };
}
const emptyNetwork = async () => {
  throw new Error('No network should be requested in this test.');
};
function fixture({
  environment = development, config = fakeConfig,
  state = activeState, signedIn = true, fetchImpl = emptyNetwork,
  spy = null,
} = {}) {
  return {
    environment, config, fetchImpl,
    resolveSessionWithRefresh: async ({ verifyAccessToken }) => {
      spy?.('auth_session');
      if (!signedIn) return null;
      return {
        accessToken: fakeAccessToken,
        value: await verifyAccessToken(fakeAccessToken),
      };
    },
    readAccountAccessState: async ({ accessToken }) => {
      assert.equal(accessToken, fakeAccessToken);
      spy?.('verified_account');
      return state;
    },
  };
}
async function run(req, dependencies) {
  const res = response();
  await handleTransactionalLocaleRequest(req, res, dependencies);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  return res;
}
const disabledEvents = [];
const disabled = await run(request(), fixture({
  environment: {
    ...development, ACCOUNT_TRANSACTIONAL_LOCALE_UI_ENABLED: 'false',
  },
  spy: event => disabledEvents.push(event),
}));
assert.equal(disabled.statusCode, 404);
assert.equal(disabled.body.code, 'TRANSACTIONAL_LOCALE_UI_DISABLED');
assert.deepEqual(disabledEvents, [], 'disabled routes may not authenticate or query any database');

const production = await run(request(), fixture({
  environment: { ...development, VERCEL_ENV: 'production' },
}));
assert.equal(production.statusCode, 404, 'even enabled flags must not expose Production');
const noSession = await run(request(), fixture({ signedIn: false }));
assert.equal(noSession.statusCode, 401);
const suspended = await run(request(), fixture({
  state: { ...activeState, profile: { account_id: accountId, status: 'suspended' } },
}));
assert.equal(suspended.statusCode, 403);
const crossAccountState = await run(request(), fixture({
  state: { ...activeState, profile: { account_id: otherAccountId, status: 'active' } },
}));
assert.equal(crossAccountState.statusCode, 403);
const unverifiedEmail = await run(request(), fixture({
  state: { ...activeState, user: { id: accountId, emailConfirmedAt: null } },
}));
assert.equal(unverifiedEmail.statusCode, 403);
const wrongProject = await run(request(), fixture({
  config: { ...fakeConfig, url: 'https://gjzetjugmnwanvjkchux.supabase.co' },
}));
assert.equal(wrongProject.statusCode, 503);
assert.equal(wrongProject.body.code, 'TRANSACTIONAL_LOCALE_DEV_PROJECT_HOLD');
assert.equal((await run(request('DELETE'), fixture())).statusCode, 405);
assert.equal((await run(request('PUT'), fixture())).statusCode, 405);

const noSavedPreference = await run(request(), fixture({
  fetchImpl: async (url, init) => {
    assert.match(url, /\/rest\/v1\/account_transactional_locale_preferences\?/);
    assert.match(url, new RegExp('account_id=eq\\.' + accountId));
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.apikey, fakeConfig.publishableKey);
    assert.equal(init.headers.Authorization, 'Bearer ' + fakeAccessToken);
    assert.equal(init.headers['Content-Type'], undefined);
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
}));
assert.equal(noSavedPreference.statusCode, 200);
assert.equal(noSavedPreference.body.locale, 'en');
assert.equal(noSavedPreference.body.source, 'english_fallback');
assert.equal(noSavedPreference.body.revision, null);
assert.equal(noSavedPreference.body.writable, true);
assert.equal(noSavedPreference.body.notificationsEnabled, false);
assert.equal(noSavedPreference.body.marketingConsentChanged, false);
assert.equal(JSON.stringify(noSavedPreference.body).includes('example@test.invalid'), false);

const readExisting = await run(request(), fixture({
  fetchImpl: async () => new Response(JSON.stringify([verifiedPreference()]), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }),
}));
assert.equal(readExisting.statusCode, 200);
assert.equal(readExisting.body.locale, 'es');
assert.equal(readExisting.body.source, 'verified_account');
assert.equal(readExisting.body.revision, 1);

const readForeign = await run(request(), fixture({
  fetchImpl: async () => new Response(JSON.stringify([verifiedPreference('es', 1, otherAccountId)]), {
    status: 200,
  }),
}));
assert.equal(readForeign.statusCode, 503);
assert.equal(readForeign.body.code, 'TRANSACTIONAL_LOCALE_RECORD_UNVERIFIED');

let reads = 0;
let writes = 0;
const approvedWriteMock = async (url, init) => {
  assert.equal(init.headers.Authorization, 'Bearer ' + fakeAccessToken);
  assert.equal(init.headers.apikey, fakeConfig.publishableKey);
  assert.equal(JSON.stringify(init).includes('sb_secret_'), false);
  if (init.method === 'GET') {
    reads++;
    assert.match(url, new RegExp('account_id=eq\\.' + accountId));
    return new Response('[]', { status: 200 });
  }
  writes++;
  assert.match(url, /\/rest\/v1\/account_transactional_locale_preferences\?select=/);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Prefer, 'return=representation');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), {
    account_id: accountId,
    preferred_locale: 'es',
  });
  return new Response(JSON.stringify([verifiedPreference()]), { status: 201 });
};
const saved = await run(request('POST', JSON.stringify({ locale: 'es' })), fixture({
  fetchImpl: approvedWriteMock,
}));
assert.equal(saved.statusCode, 200);
assert.equal(saved.body.locale, 'es');
assert.equal(saved.body.marketingConsentChanged, false);
assert.equal(saved.body.notificationsEnabled, false);
assert.equal(reads, 1);
assert.equal(writes, 1);

// An existing row needs only UPDATE(preferred_locale); never update
// the immutable authenticated account_id.
let patches = 0;
const changed = await run(request('POST', JSON.stringify({ locale: 'es' })), fixture({
  fetchImpl: async (url, init) => {
    if (init.method === 'GET') {
      return new Response(JSON.stringify([verifiedPreference('en', 1)]), { status: 200 });
    }
    patches++;
    assert.equal(init.method, 'PATCH');
    assert.match(url, new RegExp('account_id=eq\\.' + accountId));
    assert.equal(init.headers.Prefer, 'return=representation');
    assert.deepEqual(JSON.parse(init.body), { preferred_locale: 'es' });
    return new Response(JSON.stringify([verifiedPreference('es', 2)]), { status: 200 });
  },
}));
assert.equal(changed.statusCode, 200);
assert.equal(changed.body.revision, 2);
assert.equal(changed.body.locale, 'es');
assert.equal(patches, 1);

// Saving an already selected locale is a no-op; revision does not change.
const same = await run(request('POST', JSON.stringify({ locale: 'es' })), fixture({
  fetchImpl: async (url, init) => {
    assert.equal(init.method, 'GET');
    return new Response(JSON.stringify([verifiedPreference('es', 2)]), { status: 200 });
  },
}));
assert.equal(same.body.revision, 2);
assert.equal(same.statusCode, 200);

let invalidWrites = 0;
for (const input of [
  JSON.stringify({ locale: 'pt' }),
  JSON.stringify({ locale: 'es', account_id: otherAccountId }),
  JSON.stringify({ locale: 'es', marketingConsent: true }),
  JSON.stringify({ preferred_locale: 'en' }),
  JSON.stringify({ locale: 'es-MX' }),
  '{}',
  'broken json',
  'x'.repeat(513),
]) {
  const res = await run(request('POST', input), fixture({
    fetchImpl: async () => { invalidWrites++; throw new Error('Invalid write attempted'); },
  }));
  assert.ok([400, 413].includes(res.statusCode));
}
assert.equal(invalidWrites, 0);
assert.equal((await run(request('POST', '{}', { 'content-type': 'text/plain' }), fixture())).statusCode, 415);
for (const badHeaders of [
  { 'sec-fetch-site': 'cross-site' },
  { 'sec-fetch-site': '' },
  { origin: 'https://foreign.example.test' },
  { origin: '' },
]) {
  const result = await run(request('POST', JSON.stringify({ locale: 'en' }), badHeaders),
    fixture());
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, 'TRANSACTIONAL_LOCALE_SAME_ORIGIN_REQUIRED');
}
const saveDisabled = await run(request('POST', JSON.stringify({ locale: 'es' })),
  fixture({
    environment: { ...development, ACCOUNT_TRANSACTIONAL_LOCALE_WRITE_ENABLED: 'false' },
  }));
assert.equal(saveDisabled.statusCode, 403);
assert.equal(saveDisabled.body.code, 'TRANSACTIONAL_LOCALE_WRITE_DISABLED');

for (const badResult of [
  new Response('No permission', { status: 403 }),
  new Response('{}', { status: 200 }),
  new Response(JSON.stringify([{ ...verifiedPreference(), preferred_locale: 'en' }]), { status: 200 }),
]) {
  const result = await run(request('POST', JSON.stringify({ locale: 'es' })),
    fixture({
      fetchImpl: async (_url, init) => init.method === 'GET'
        ? new Response('[]', { status: 200 })
        : badResult,
    }));
  assert.equal(result.statusCode, 503);
}
const failedNetwork = await run(request(), fixture({
  fetchImpl: async () => { throw new Error('Network unavailable'); },
}));
assert.equal(failedNetwork.statusCode, 503);
assert.equal(failedNetwork.body.code, 'TRANSACTIONAL_LOCALE_REST_UNAVAILABLE');

const sourceFile = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
assert.match(sourceFile, /'transactional-locale': handleTransactionalLocaleRequest/);
assert.doesNotMatch(sourceFile, /ACCOUNT_TRANSACTIONAL_LOCALE_UI_ENABLED\s*=\s*'true'/);


const accountPage = await readFile(new URL('../src/pages/account/index.astro', import.meta.url), 'utf8');
assert.match(accountPage, /id="transactional-language-panel"[^>]*hidden/);
assert.match(accountPage, /id="transactional-language-choice"/);
assert.match(accountPage, /id="transactional-language-save"[^>]*disabled/);
assert.match(accountPage, /loadTransactionalLanguageSettings\(\)/);
assert.match(accountPage, /\/api\/account\?action=transactional-locale/);
assert.match(accountPage, /does not subscribe you to a newsletter/);
assert.match(accountPage, /Portuguese email remains unavailable/);
assert.doesNotMatch(accountPage, /data-marketing-segment|registerMarketingConsent/);


const privacyMigrationSql = await readFile(
  new URL('../../../supabase/migrations/20261030221037_ui02_language_privacy_lifecycle_dev.sql', import.meta.url),
  'utf8',
);
assert.equal(
  createHash('sha256').update(privacyMigrationSql).digest('hex'),
  'b741bd787610b412cc2b1439e1f74dc0bfb5b64e35e071f9400177a451217eb3',
);
assert.match(privacyMigrationSql, /'transactionalLanguagePreference'/);
assert.match(privacyMigrationSql, /create trigger ui02_purge_language_when_account_deleted/);
assert.match(privacyMigrationSql, /after update of status on public\.profiles/);
assert.match(privacyMigrationSql, /security invoker/i);
assert.doesNotMatch(privacyMigrationSql, /^\s*security definer/mi);
assert.doesNotMatch(privacyMigrationSql, /update public\.ui02_access_ready_activation\s+set\s+enabled\s*=\s*true/i);

console.log('Transactional account-language gate and RLS REST contracts passed.');
