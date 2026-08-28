import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REGISTERED_COMMERCE_ADAPTERS } from '../src/lib/commerce-adapters.js';
import { resolveCommerceReadiness } from '../src/lib/commerce-provider.js';

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
  controlledLiveRunbookSource,
  providerCompliantLiveEvidenceSource,
  selectedProviderContractSource,
  providerResponsibilityMatrixSource,
  providerReadinessSource,
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
  readFile(new URL('../../../docs/operations/lemon-squeezy-controlled-live-runtime-2026-08-27.md', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/lemon-squeezy-provider-compliant-live-evidence-2026-08-27.md', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/commerce-provider-responsibility-matrix.md', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/commerce-provider-readiness.md', import.meta.url), 'utf8'),
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
assert.match(packageSource, /test-lemon-squeezy-controlled-live-runtime\.mjs/);
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
assert.match(lemonRuntimeSource, /COMMERCE_MODES\.LIVE_TEST/);
assert.match(lemonRuntimeSource, /COMMERCE_MODES\.LIVE/);
assert.match(lemonRuntimeSource, /COMMERCE_PROVIDER/);
assert.match(lemonRuntimeSource, /VERCEL_ENV/);
assert.match(lemonRuntimeSource, /=== 'production'/);
assert.match(lemonRuntimeSource, /LEMON_SQUEEZY_TEST_MODE/);
assert.match(lemonRuntimeSource, /DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc'/);
assert.match(lemonRuntimeSource, /PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux'/);
assert.match(lemonRuntimeSource, /COMMERCE_SANDBOX_QA_EMAIL/);
assert.match(lemonRuntimeSource, /COMMERCE_CONTROLLED_LIVE_QA_EMAIL/);
assert.match(lemonRuntimeSource, /LEMON_SQUEEZY_\$\{namespace\}_API_KEY/);
assert.match(lemonRuntimeSource, /expectedTestMode: config\.testMode/);
assert.match(lemonRuntimeSource, /verifyLemonSqueezyWebhookSignature/);
assert.match(lemonRuntimeSource, /retrieveAuthoritativeLemonSqueezyOrder/);
assert.match(lemonRuntimeSource, /discountTotal !== 0/);
assert.match(lemonRuntimeSource, /Order must contain exactly one item/);
assert.match(lemonRuntimeSource, /Order quantity must be exactly one/);
assert.match(lemonRuntimeSource, /partial_refund/);
assert.match(lemonRuntimeSource, /name:\s*'apply_commerce_reconciliation'/);
assert.match(lemonRuntimeSource, /p_provider_status:\s*commercial\.status/);
assert.match(controlledLiveRunbookSource, /Production remains disabled/i);
assert.match(controlledLiveRunbookSource, /LEMON_SQUEEZY_LIVE_API_KEY/);
assert.match(controlledLiveRunbookSource, /LEMON_SQUEEZY_TEST_\*/);
assert.match(controlledLiveRunbookSource, /test_mode=false/);
assert.match(controlledLiveRunbookSource, /COMMERCE_MODE=disabled/);
assert.match(controlledLiveRunbookSource, /Do not delete durable transaction evidence/i);
assert.match(controlledLiveRunbookSource, /Payment and refund testing remains in Lemon Squeezy Test Mode/i);
assert.match(controlledLiveRunbookSource, /provider-compliant-live-evidence-2026-08-27\.md/);
assert.doesNotMatch(controlledLiveRunbookSource, /controlled Live purchase and full refund/i);
assert.doesNotMatch(controlledLiveRunbookSource, /Production controlled purchase\/refund rehearsal/i);
assert.match(providerCompliantLiveEvidenceSource, /Code-only release-contract correction/i);
assert.match(providerCompliantLiveEvidenceSource, /must use test cards/i);
assert.match(providerCompliantLiveEvidenceSource, /no owner, employee, contractor, QA account or related party uses a real card/i);
assert.match(providerCompliantLiveEvidenceSource, /read-only Live API inspection/i);
assert.match(providerCompliantLiveEvidenceSource, /INVALID_COMMERCE_WEBHOOK_SIGNATURE|invalid-signature request/i);
assert.match(providerCompliantLiveEvidenceSource, /first Live order must originate from an independent genuine buyer/i);
assert.match(providerCompliantLiveEvidenceSource, /COMMERCE_MODE=disabled/);
assert.match(providerCompliantLiveEvidenceSource, /does not itself satisfy `COMMERCE_CONTROLLED_LIVE_VERIFIED` or `COMMERCE_LIVE_APPROVED`/i);
assert.doesNotMatch(providerCompliantLiveEvidenceSource, /merchant-controlled Live purchase and refund[^.]*authorize/i);
assert.match(selectedProviderContractSource, /#343 remains optional post-launch assurance/i);
assert.doesNotMatch(selectedProviderContractSource, /bypass of #343/i);
assert.match(providerResponsibilityMatrixSource, /#343 remains optional\/post-launch/i);
assert.match(providerResponsibilityMatrixSource, /Issue #343 — optional post-launch independent security assurance, not a launch gate/i);
assert.match(providerReadinessSource, /Treat #343 as optional post-launch assurance/i);
assert.doesNotMatch(providerReadinessSource, /Complete #343 against the commerce-enabled near-final candidate/i);
assert.match(controlledLiveRunbookSource, /treat #343 as optional post-launch assurance/i);
assert.doesNotMatch(controlledLiveRunbookSource, /complete the independent commerce-enabled security assessment and required retest/i);
assert.match(providerCompliantLiveEvidenceSource, /treat #343 as optional post-launch assurance/i);
assert.doesNotMatch(providerCompliantLiveEvidenceSource, /complete the independent commerce-enabled security assessment and required retest/i);
assert.match(
  lemonAdapterSource,
  /status === 'fraudulent'[\s\S]*CANONICAL_COMMERCE_EVENT_TYPES\.PAYMENT_REVOKED/,
);
assert.match(commerceReconciliationMigrationSource, /p_provider_status = 'fraudulent'/);
assert.match(commerceReconciliationMigrationSource, /:payment\.revoked/);

assert.match(accountSource, /handleCommerceReadinessRequest/);
assert.match(accountSource, /'commerce-readiness': handleCommerceReadinessRequest/);

assert.equal(REGISTERED_COMMERCE_ADAPTERS.length, 1);
assert.equal(REGISTERED_COMMERCE_ADAPTERS[0].provider, 'lemon-squeezy');
assert.match(REGISTERED_COMMERCE_ADAPTERS[0].version, /controlled-live/);
assert.equal(REGISTERED_COMMERCE_ADAPTERS[0].assessConfiguration().ready, false);
assert.match(REGISTERED_COMMERCE_ADAPTERS[0].assessConfiguration().reason, /explicitly reviewed/i);

const productionCommerceHold = resolveCommerceReadiness({
  COMMERCE_MODE: 'disabled',
  VERCEL_ENV: 'production',
}, REGISTERED_COMMERCE_ADAPTERS);
assert.equal(productionCommerceHold.state, 'ready_for_provider_configuration');
assert.equal(productionCommerceHold.mode, 'disabled');
assert.equal(productionCommerceHold.provider, null);
assert.equal(productionCommerceHold.providerConfigured, false);
assert.equal(productionCommerceHold.checkoutEnabled, false);
assert.match(checkoutSource, /Lemon Squeezy is the selected Merchant of Record/i);
assert.match(checkoutSource, /verified in Test Mode/i);
assert.match(checkoutSource, /Public payment\s+remains disabled/i);
assert.match(checkoutSource, /browser redirect alone never grants access/i);
assert.match(checkoutSource, /Before any payment can open/i);
assert.match(checkoutSource, /verified legal operator and geographic trader address/i);
assert.match(checkoutSource, /Merchant of Record, buyer terms, and provider privacy terms/i);
assert.match(checkoutSource, /Approved seller disclosure/i);
assert.match(checkoutSource, /Str\. Doctor Hacman nr\. 28, bl\. 83, sc\. B, ap\. 9, 240232 Râmnicu Vâlcea, România/);
assert.match(checkoutSource, /Applicable indirect taxes are calculated, collected and remitted by Lemon Squeezy as Merchant of Record and shown before payment\./i);
assert.match(checkoutSource, /This exact public-facing disclosure bundle is approved for later commerce activation/i);
assert.ok(checkoutSource.includes('Link, LLC f/k/a Lemon Squeezy LLC'));
assert.match(checkoutSource, /Lemon Squeezy processes approved payment refunds/i);
assert.match(checkoutSource, /Production[\s\S]{0,120}Live checkout remain disabled/i);
assert.doesNotMatch(checkoutSource, /Current verified public operator identity/i);
assert.match(checkoutSource, /seller-disclosure-panel/);
assert.match(productSource, /Lemon Squeezy is the selected Merchant of Record/i);
assert.match(productSource, /Public checkout remains unavailable/i);
assert.match(productSource, /verified commercial event/i);
assert.doesNotMatch(productSource, /replacement (?:payment )?provider/i);
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
assert.match(disclosureSource, /KELA LEADS S.R.L./);
assert.match(disclosureSource, /CUI 40790448/);
assert.match(disclosureSource, /ROONRC.J38\/820\/2020/);
assert.match(disclosureSource, /support@usd-impact\.com/);

for (const [name, source] of [
  ['checkout page', checkoutSource],
  ['product page', productSource],
  ['account API', accountSource],
  ['commerce handler', handlerSource],
  ['commerce contract', contractSource],
  ['public disclosure contract', disclosureSource],
  ['commerce function', commerceFunctionSource],
  ['Lemon Squeezy mode-isolated runtime', lemonRuntimeSource],
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
    /LEMON_SQUEEZY_(?:TEST|LIVE)_API_KEY|LEMON_SQUEEZY_(?:TEST|LIVE)_WEBHOOK_SECRET|SUPABASE_SECRET_KEY/i,
    `${name} must not expose sandbox or database secrets.`,
  );
}

assert.doesNotMatch(vercelSource, /api\/paddle|paddle-webhook/i);
console.log('Provider-neutral commerce deployment contract passed.');
