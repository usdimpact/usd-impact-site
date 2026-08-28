import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  approvedLaunchCheckoutUrl,
  createCheckoutIdempotencyKey,
  publicCheckoutCanOpen,
} from '../src/lib/checkout-client.js';

const checkoutPageSource = await readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8');
assert.match(
  checkoutPageSource,
  /#checkout-button\[hidden\],\s*#waitlist-link\[hidden\]\s*\{\s*display:\s*none;\s*\}/,
  'Hidden checkout controls must remain visually hidden when global button styles are applied.',
);

const activeCommerce = {
  state: 'active',
  mode: 'live',
  provider: 'lemon-squeezy',
  checkoutEnabled: true,
  disclosuresComplete: true,
};

assert.equal(publicCheckoutCanOpen(activeCommerce, true), true);
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
