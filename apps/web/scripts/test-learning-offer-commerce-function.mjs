import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import commerceHandler from '../api/commerce.js';
import { handleCommerceReadinessRequest } from '../src/lib/commerce-readiness-handler.js';
import { LEARNING_OFFER_MODE_KEY } from '../src/lib/learning-offer-commerce-policy.js';

// Offline direct-request matrix only. Explicitly disable both providers and
// the cron secret so these tests cannot create orders, mutate accounts or call
// an external API even on a CI runner with ambient environment configuration.
const managed = [
  LEARNING_OFFER_MODE_KEY,
  'COMMERCE_MODE',
  'RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED',
  'CRON_SECRET',
];
const saved = Object.fromEntries(managed.map((key) => [key, process.env[key]]));

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    end(value = '') { this.body = String(value); },
  };
}

async function invokeCommerce({
  action = 'checkout',
  method = 'POST',
  site = 'same-origin',
  type = 'application/json',
  body = '{"idempotencyKey":"ui37-offline-12345"}',
} = {}) {
  const response = responseRecorder();
  const headers = { 'sec-fetch-site': site };
  if (type) headers['content-type'] = type;
  await commerceHandler({
    method,
    url: `/api/commerce?action=${encodeURIComponent(action)}`,
    headers,
    body,
  }, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

async function invokeReadiness(environment) {
  const response = responseRecorder();
  await handleCommerceReadinessRequest(
    { method: 'GET', headers: {}, url: '/api/account?action=commerce-readiness' },
    response,
    { environment },
  );
  return { status: response.statusCode, headers: response.headers, json: JSON.parse(response.body) };
}

try {
  process.env.COMMERCE_MODE = 'disabled';
  process.env.RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED = 'false';
  delete process.env.CRON_SECRET;
  delete process.env[LEARNING_OFFER_MODE_KEY];

  const legacyDefault = await invokeCommerce();
  assert.equal(legacyDefault.status, 503);
  assert.equal(legacyDefault.json.code, 'COMMERCE_DISABLED');
  assert.match(legacyDefault.headers['cache-control'], /no-store/);

  process.env[LEARNING_OFFER_MODE_KEY] = 'legacy';
  const explicitLegacy = await invokeCommerce();
  assert.equal(explicitLegacy.status, legacyDefault.status);
  assert.equal(explicitLegacy.json.code, legacyDefault.json.code);

  // A response from the normal Research route must be identical across offer
  // modes. It is intentionally disabled in this fixture, so no provider is
  // touched and the test does not validate live subscription behavior.
  const legacyResearch = await invokeCommerce({ action: 'research-membership-checkout' });
  assert.equal(legacyResearch.status, 503);
  assert.equal(legacyResearch.json.code, 'RESEARCH_WEBHOOK_DISABLED');
  const legacyWebhook = await invokeCommerce({ action: 'webhook' });
  assert.equal(legacyWebhook.json.code, 'COMMERCE_DISABLED');
  const legacyReconcile = await invokeCommerce({ action: 'reconcile', method: 'GET' });
  assert.equal(legacyReconcile.status, 401);
  assert.equal(legacyReconcile.json.code, 'CRON_AUTHORIZATION_REQUIRED');
  const originalReadiness = await invokeReadiness({});
  assert.equal(originalReadiness.status, 200);
  assert.equal(originalReadiness.json.ok, true);
  assert.equal(originalReadiness.json.commerce.checkoutEnabled, false);

  for (const mode of ['free', ' FREE ', 'paid', 'paid-pending', 'invalid', ' ', 'true']) {
    process.env[LEARNING_OFFER_MODE_KEY] = mode;

    const blocked = await invokeCommerce();
    assert.equal(blocked.status, 503, mode);
    assert.equal(blocked.json.code, 'LEARNING_LIBRARY_CHECKOUT_DISABLED', mode);
    assert.equal(blocked.json.ok, undefined, mode);
    assert.equal(blocked.json.checkoutUrl, undefined, mode);
    assert.match(blocked.headers['cache-control'], /no-store/, mode);
    assert.equal(blocked.headers['x-robots-tag'], 'noindex, nofollow');

    // Fail before trying to parse a body, read the session, or reach a payment provider.
    const badBody = await invokeCommerce({ body: '{' });
    assert.equal(badBody.json.code, 'LEARNING_LIBRARY_CHECKOUT_DISABLED', mode);
    const forgedKey = await invokeCommerce({
      body: '{"idempotencyKey":"forged-paid-conversion-87654","billingInterval":"annual"}',
    });
    assert.equal(forgedKey.json.code, 'LEARNING_LIBRARY_CHECKOUT_DISABLED', mode);

    // Preserve existing preliminary security errors in every offer mode.
    const getMethod = await invokeCommerce({ method: 'GET' });
    assert.equal(getMethod.status, 405, mode);
    assert.equal(getMethod.json.code, 'METHOD_NOT_ALLOWED', mode);
    assert.equal(getMethod.headers.allow, 'POST');
    const crossSite = await invokeCommerce({ site: 'cross-site' });
    assert.equal(crossSite.status, 403, mode);
    assert.equal(crossSite.json.code, 'CROSS_SITE_REQUEST', mode);
    const badType = await invokeCommerce({ type: 'text/plain' });
    assert.equal(badType.status, 415, mode);
    assert.equal(badType.json.code, 'INVALID_CONTENT_TYPE', mode);

    // Research, signed webhook and cron routes must never consult this policy.
    const research = await invokeCommerce({ action: 'research-membership-checkout' });
    assert.equal(research.status, legacyResearch.status, mode);
    assert.equal(research.json.code, legacyResearch.json.code, mode);
    const webhook = await invokeCommerce({ action: 'webhook' });
    assert.equal(webhook.status, legacyWebhook.status, mode);
    assert.equal(webhook.json.code, legacyWebhook.json.code, mode);
    const reconcile = await invokeCommerce({ action: 'reconcile', method: 'GET' });
    assert.equal(reconcile.status, legacyReconcile.status, mode);
    assert.equal(reconcile.json.code, legacyReconcile.json.code, mode);

    const readiness = await invokeReadiness({ [LEARNING_OFFER_MODE_KEY]: mode });
    assert.equal(readiness.status, 200, mode);
    assert.equal(readiness.json.ok, true, mode);
    assert.equal(readiness.json.commerce.state, 'blocked', mode);
    assert.equal(readiness.json.commerce.checkoutEnabled, false, mode);
    assert.match(readiness.json.commerce.message, /Library Pass checkout is not offered/, mode);
  }

  // Reversible in-process state regression. This tests no Production setting:
  // changing or removing the env value in a deployment requires its own audit.
  process.env[LEARNING_OFFER_MODE_KEY] = 'legacy';
  assert.equal((await invokeCommerce()).json.code, 'COMMERCE_DISABLED');
  delete process.env[LEARNING_OFFER_MODE_KEY];
  assert.equal((await invokeCommerce()).json.code, 'COMMERCE_DISABLED');
  assert.deepEqual((await invokeReadiness({})).json.commerce, originalReadiness.json.commerce);

  // merchant-hosted-checkout-source-scan (offline). Site-owned Library Pass
  // links must go through /checkout/ and server readiness, not through a
  // hardcoded provider buy URL that would bypass the free-first API guard.
  // Merchant-hosted links previously issued outside this repository remain
  // an independent approval gate; this source check cannot disable them.
  const publicEntrySurfaces = [
    '../src/components/BookPurchaseCTA.astro',
    '../src/components/HomeLibraryPassCTA.astro',
    '../src/components/LibraryPassAvailabilityCTA.astro',
    '../src/pages/checkout/index.astro',
    '../src/pages/account/index.astro',
    '../src/pages/research/index.astro',
    '../src/lib/checkout-client.js',
  ];
  const directProviderCheckout = /https?:\\/\\/(?:[a-z0-9-]+\\.)*lemonsqueezy\\.com\\/checkout(?:\\/|[?#"'])/i;
  const directHostedBuy = /https?:\\/\\/[^"'\\s<>]+\\/checkout\\/buy(?:\\/|[?#"'])/i;
  for (const relativePath of publicEntrySurfaces) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, directProviderCheckout, `${relativePath}: provider checkout URL bypasses server offer guard`);
    assert.doesNotMatch(source, directHostedBuy, `${relativePath}: hosted buy link bypasses server offer guard`);
  }
  for (const relativePath of [
    '../src/components/BookPurchaseCTA.astro',
    '../src/components/LibraryPassAvailabilityCTA.astro',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /href="\\/checkout\\/"/, `${relativePath} must use internal checkout`);
  }

  console.log('Learning-offer public-entrypoint source guard passed (no hardcoded hosted buy links).');
  console.log('Learning-offer direct-request negative matrix passed (offline, no provider access).');
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
