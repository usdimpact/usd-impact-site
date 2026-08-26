import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REGISTERED_COMMERCE_ADAPTERS } from '../src/lib/commerce-adapters.js';

const [
  vercelSource,
  packageSource,
  checkoutSource,
  productSource,
  accountSource,
  handlerSource,
  contractSource,
  disclosureSource,
  commerceFunctionSource,
  lemonRuntimeSource,
  lemonAdapterSource,
  commerceReconciliationMigrationSource,
] = await Promise.all([
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/products/book-read-the-dollar-first.md', import.meta.url), 'utf8'),
  readFile(new URL('../api/account.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/commerce-readiness-handler.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/commerce-provider.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/commerce-public-disclosure.js', import.meta.url), 'utf8'),
  readFile(new URL('../api/commerce.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/lemon-squeezy-commerce-runtime.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/lemon-squeezy-adapter-scaffold.js', import.meta.url), 'utf8'),
  readFile(new URL('../../../supabase/migrations/20260826170000_commerce_reconciliation_runtime.sql', import.meta.url), 'utf8'),
]);

const vercel = JSON.parse(vercelSource);
const commerceRewrite = vercel.rewrites.find((item) => item.source === '/api/commerce-readiness');
assert.deepEqual(commerceRewrite, {
  source: '/api/commerce-readiness',
  destination: '/api/account?action=commerce-readiness',
});

// The selected-provider sandbox runtime now has an isolated Vercel function, but it must
// not be promoted into a public rewrite or scheduled Production cron before later gates.
assert.match(packageSource, /node --check api\/commerce\.js/);
assert.match(packageSource, /test-lemon-squeezy-commerce-function\.mjs/);
assert.match(packageSource, /test-lemon-squeezy-commerce-runtime\.mjs/);
assert.match(packageSource, /test-commerce-reconciliation-migration\.mjs/);
assert.match(packageSource, /commerce-readiness-handler\.js/);
assert.equal(
  vercel.rewrites.some((item) => item.source === '/api/commerce' || String(item.destination || '').startsWith('/api/commerce?')),
  false,
  'The sandbox commerce function must not have a public rewrite before activation gates pass.',
);
assert.equal(
  vercel.crons.some((item) => item.path === '/api/commerce' || String(item.path || '').startsWith('/api/commerce?')),
  false,
  'Commerce reconciliation must not be scheduled in Production before sandbox proof and registration review.',
);

assert.match(commerceFunctionSource, /bodyParser:\s*false/);
assert.match(commerceFunctionSource, /requestedAction === 'checkout'/);
assert.match(commerceFunctionSource, /requestedAction === 'webhook'/);
assert.match(commerceFunctionSource, /requestedAction === 'reconcile'/);
assert.match(commerceFunctionSource, /validCronAuthorization/);
assert.match(commerceFunctionSource, /readSessionAccessToken/);
assert.match(commerceFunctionSource, /requestHeader\(request, 'x-signature'\)/);
assert.match(commerceFunctionSource, /Cache-Control', 'private, no-store'/);
assert.match(commerceFunctionSource, /X-Robots-Tag', 'noindex, nofollow'/);

assert.match(lemonRuntimeSource, /COMMERCE_MODE/);
assert.match(lemonRuntimeSource, /mode !== 'sandbox'/);
assert.match(lemonRuntimeSource, /COMMERCE_PROVIDER/);
assert.match(lemonRuntimeSource, /VERCEL_ENV/);
assert.match(lemonRuntimeSource, /=== 'production'/);
assert.match(lemonRuntimeSource, /LEMON_SQUEEZY_TEST_MODE/);
assert.match(lemonRuntimeSource, /DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc'/);
assert.match(lemonRuntimeSource, /COMMERCE_SANDBOX_QA_EMAIL/);
assert.match(lemonRuntimeSource, /verifyLemonSqueezyWebhookSignature/);
assert.match(lemonRuntimeSource, /retrieveAuthoritativeLemonSqueezyOrder/);
assert.match(lemonRuntimeSource, /discountTotal !== 0/);
assert.match(lemonRuntimeSource, /Order must contain exactly one item/);
assert.match(lemonRuntimeSource, /Order quantity must be exactly one/);
assert.match(lemonRuntimeSource, /partial_refund/);
assert.match(lemonRuntimeSource, /name:\s*'apply_commerce_reconciliation'/);
assert.match(lemonRuntimeSource, /p_provider_status:\s*commercial\.status/);
assert.match(
  lemonAdapterSource,
  /status === 'fraudulent'[\s\S]*CANONICAL_COMMERCE_EVENT_TYPES\.PAYMENT_REVOKED/,
);
assert.match(commerceReconciliationMigrationSource, /p_provider_status = 'fraudulent'/);
assert.match(commerceReconciliationMigrationSource, /:payment\.revoked/);

assert.match(accountSource, /handleCommerceReadinessRequest/);
assert.match(accountSource, /'commerce-readiness': handleCommerceReadinessRequest/);

assert.equal(REGISTERED_COMMERCE_ADAPTERS.length, 0);
assert.match(checkoutSource, /ready to connect\s+an approved payment provider/i);
assert.match(checkoutSource, /Public payment remains disabled/i);
assert.match(checkoutSource, /browser redirect alone never grants access/i);
assert.match(checkoutSource, /Before any payment can open/i);
assert.match(checkoutSource, /verified legal operator and geographic trader address/i);
assert.match(checkoutSource, /Merchant of Record, buyer terms, and provider privacy terms/i);
assert.match(checkoutSource, /Current first-party public operator disclosure/i);
assert.doesNotMatch(checkoutSource, /Current verified public operator identity/i);
assert.match(checkoutSource, /A street address or provider identity is not guessed/i);
assert.match(checkoutSource, /seller-disclosure-panel/);
assert.match(productSource, /replacement provider is selected, integrated, tested, and approved for Live use/i);
assert.match(productSource, /verified commercial event/i);
assert.doesNotMatch(productSource, /payment-provider review/i);
assert.match(handlerSource, /publicCommerceReadiness/);
assert.match(handlerSource, /sellerDisclosure: null/);
assert.match(contractSource, /ready_for_provider_configuration/);
assert.match(contractSource, /ready_for_controlled_live_test/);
assert.match(contractSource, /COMMERCE_SANDBOX_VERIFIED/);
assert.match(contractSource, /COMMERCE_CONTROLLED_LIVE_VERIFIED/);
assert.match(contractSource, /COMMERCE_LIVE_APPROVED/);
assert.match(contractSource, /buyer-facing seller disclosures/i);
assert.match(contractSource, /resolveCommercePublicDisclosure/);
assert.match(contractSource, /verifyWebhookSignature/);

for (const field of [
  'COMMERCE_TRADER_ADDRESS_PUBLIC',
  'COMMERCE_TAX_STATUS_PUBLIC',
  'COMMERCE_MERCHANT_OF_RECORD_NAME',
  'COMMERCE_MERCHANT_OF_RECORD_TERMS_URL',
  'COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL',
  'COMMERCE_TAX_CHECKOUT_PUBLIC',
  'COMMERCE_REFUND_SUPPORT_PUBLIC',
  'COMMERCE_SELLER_DISCLOSURE_APPROVED',
]) {
  assert.match(disclosureSource, new RegExp(field));
}
assert.match(disclosureSource, /https:/);
assert.match(disclosureSource, /publicDisclosure: ready/);
assert.match(disclosureSource, /SC Kela Leads SRL/);
assert.match(disclosureSource, /CUI 40790448/);
assert.match(disclosureSource, /support@usd-impact\.com/);

for (const [name, source] of [
  ['checkout page', checkoutSource],
  ['product page', productSource],
  ['account API', accountSource],
  ['commerce handler', handlerSource],
  ['commerce contract', contractSource],
  ['public disclosure contract', disclosureSource],
  ['sandbox commerce function', commerceFunctionSource],
  ['Lemon Squeezy sandbox runtime', lemonRuntimeSource],
]) {
  assert.doesNotMatch(
    source,
    /PADDLE_API_KEY|PADDLE_WEBHOOK_SECRET|api\/paddle|paddle-webhook/i,
    `${name} must not depend on Paddle.`,
  );
}

for (const [name, source] of [
  ['checkout page', checkoutSource],
  ['product page', productSource],
  ['public disclosure contract', disclosureSource],
]) {
  assert.doesNotMatch(
    source,
    /LEMON_SQUEEZY_TEST_API_KEY|LEMON_SQUEEZY_TEST_WEBHOOK_SECRET|SUPABASE_SECRET_KEY/i,
    `${name} must not expose sandbox or database secrets.`,
  );
}

assert.doesNotMatch(vercelSource, /api\/paddle|paddle-webhook/i);
console.log('Provider-neutral commerce deployment contract passed.');
