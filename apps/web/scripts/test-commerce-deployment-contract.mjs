import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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
] = await Promise.all([
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/products/book-read-the-dollar-first.md', import.meta.url), 'utf8'),
  readFile(new URL('../api/account.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/commerce-readiness-handler.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/commerce-provider.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/commerce-public-disclosure.js', import.meta.url), 'utf8'),
]);

const vercel = JSON.parse(vercelSource);
const commerceRewrite = vercel.rewrites.find((item) => item.source === '/api/commerce-readiness');
assert.deepEqual(commerceRewrite, {
  source: '/api/commerce-readiness',
  destination: '/api/account?action=commerce-readiness',
});

await assert.rejects(
  () => access(new URL('../api/commerce.js', import.meta.url)),
  (error) => error?.code === 'ENOENT',
  'Commerce readiness must reuse an existing Vercel function slot.',
);
assert.doesNotMatch(packageSource, /node --check api\/commerce\.js/);
assert.match(packageSource, /commerce-readiness-handler\.js/);
assert.match(accountSource, /handleCommerceReadinessRequest/);
assert.match(accountSource, /'commerce-readiness': handleCommerceReadinessRequest/);

assert.equal(REGISTERED_COMMERCE_ADAPTERS.length, 0);
assert.match(checkoutSource, /ready to connect\s+an approved payment provider/i);
assert.match(checkoutSource, /Public payment remains disabled/i);
assert.match(checkoutSource, /browser redirect alone never grants access/i);
assert.match(checkoutSource, /Before any payment can open/i);
assert.match(checkoutSource, /verified legal operator and geographic trader address/i);
assert.match(checkoutSource, /Merchant of Record, buyer terms, and provider privacy terms/i);
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
]) {
  assert.doesNotMatch(
    source,
    /PADDLE_API_KEY|PADDLE_WEBHOOK_SECRET|api\/paddle|paddle-webhook/i,
    `${name} must not depend on Paddle.`,
  );
}

assert.doesNotMatch(vercelSource, /api\/paddle|paddle-webhook/i);
console.log('Provider-neutral commerce deployment contract passed.');
