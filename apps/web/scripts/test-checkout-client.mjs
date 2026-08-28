import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  approvedLaunchCheckoutUrl,
  createCheckoutIdempotencyKey,
  publicCheckoutCanOpen,
  publicCheckoutPresentation,
} from '../src/lib/checkout-client.js';

const checkoutPageSource = await readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8');
assert.match(
  checkoutPageSource,
  /#checkout-button\[hidden\],\s*#waitlist-link\[hidden\]\s*\{\s*display:\s*none;\s*\}/,
  'Hidden checkout controls must remain visually hidden when global button styles are applied.',
);
assert.match(
  checkoutPageSource,
  /data-checkout-readiness="checking"/,
  'Checkout verification must expose an explicit checking state before the readiness request settles.',
);
assert.match(
  checkoutPageSource,
  /checkoutStatusPanel\.dataset\.checkoutReadiness = presentation\.verificationState/,
  'Checkout verification must publish its settled presentation state for browser checks.',
);

const activeCommerce = {
  state: 'active',
  mode: 'live',
  provider: 'lemon-squeezy',
  checkoutEnabled: true,
  disclosuresComplete: true,
};

assert.equal(publicCheckoutCanOpen(activeCommerce, true), true);
assert.deepEqual(publicCheckoutPresentation(activeCommerce, true), {
  available: true,
  verificationState: 'active',
  title: 'Library Pass checkout is open.',
  introduction: 'Purchase the Read the Dollar First Library Pass for a one-time USD 39 payment. Sign in with the USD Impact account that should receive access, review the disclosures below, then continue to Lemon Squeezy’s secure hosted checkout.',
});
for (const override of [
  { state: 'blocked' },
  { mode: 'disabled' },
  { provider: null },
  { checkoutEnabled: false },
  { disclosuresComplete: false },
]) {
  assert.equal(publicCheckoutCanOpen({ ...activeCommerce, ...override }, true), false);
}
assert.equal(publicCheckoutCanOpen(activeCommerce, false), false);
assert.equal(publicCheckoutPresentation(activeCommerce, false).verificationState, 'error');
assert.deepEqual(publicCheckoutPresentation({
  ...activeCommerce,
  state: 'ready_for_provider_configuration',
  mode: 'disabled',
  provider: null,
  checkoutEnabled: false,
}, true), {
  available: false,
  verificationState: 'disabled',
  title: 'Checkout is not open yet.',
  introduction: 'Lemon Squeezy is the selected Merchant of Record for the one-time Library Pass. Public payment remains disabled until every Live release gate is complete and explicitly approved.',
});

const approvedResponse = {
  ok: true,
  testMode: false,
  checkoutUrl: 'https://usd-impact.lemonsqueezy.com/checkout/buy/example',
  purchaseIntent: {
    priceTier: 'launch',
    amountCents: 3900,
    currency: 'USD',
  },
};
assert.equal(
  approvedLaunchCheckoutUrl(approvedResponse),
  'https://usd-impact.lemonsqueezy.com/checkout/buy/example',
);
for (const response of [
  { ...approvedResponse, testMode: true },
  { ...approvedResponse, checkoutUrl: 'https://example.com/checkout/buy/example' },
  { ...approvedResponse, checkoutUrl: 'https://lemonsqueezy.com.example/checkout/buy/example' },
  { ...approvedResponse, checkoutUrl: 'https://usd-impact.lemonsqueezy.com/not-a-payment-path' },
  { ...approvedResponse, purchaseIntent: { ...approvedResponse.purchaseIntent, priceTier: 'standard' } },
  { ...approvedResponse, purchaseIntent: { ...approvedResponse.purchaseIntent, amountCents: 4900 } },
  { ...approvedResponse, purchaseIntent: { ...approvedResponse.purchaseIntent, currency: 'EUR' } },
]) {
  assert.equal(approvedLaunchCheckoutUrl(response), null);
}

const uuid = '123e4567-e89b-42d3-a456-426614174000';
assert.equal(createCheckoutIdempotencyKey(() => uuid), `library-pass:${uuid}`);
assert.equal(createCheckoutIdempotencyKey(() => 'not-a-uuid'), null);
assert.equal(createCheckoutIdempotencyKey(null), null);

console.log('Checkout client fail-closed tests passed.');
