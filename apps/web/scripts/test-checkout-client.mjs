import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  approvedLaunchCheckoutUrl,
  bookPurchasePresentation,
  checkoutHrefWithCampaign,
  checkoutRequiresSignIn,
  checkoutSignInHrefWithCampaign,
  createCheckoutIdempotencyKey,
  publicCheckoutCanOpen,
  publicCheckoutPresentation,
} from '../src/lib/checkout-client.js';

const [
  checkoutPageSource,
  bookPurchaseCtaSource,
  homeLibraryPassCtaSource,
  sharedLibraryPassCtaSource,
] = await Promise.all([
  readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/BookPurchaseCTA.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/HomeLibraryPassCTA.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/LibraryPassAvailabilityCTA.astro', import.meta.url), 'utf8'),
]);
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
assert.match(
  checkoutPageSource,
  /window\.location\.assign\(checkoutSignInHrefWithCampaign\(window\.location\.search\)\)/,
  'Unauthenticated checkout must preserve only sanitized campaign context through the sign-in return path.',
);
assert.match(
  checkoutPageSource,
  /const body = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);[\s\S]*if \(checkoutRequiresSignIn\(response, body\)\)/,
  'Checkout must inspect the USD Impact response code before deciding to redirect to sign-in.',
);
assert.doesNotMatch(
  checkoutPageSource,
  /if \(response\.status === 401\)/,
  'Checkout must not redirect solely because an upstream response uses HTTP 401.',
);
assert.doesNotMatch(
  checkoutPageSource,
  /window\.location\.assign\(['"]\/account\/sign-in\/\?next=\/checkout\/['"]\)/,
  'Checkout must not discard campaign context with the legacy fixed sign-in return URL.',
);
assert.match(
  bookPurchaseCtaSource,
  /:global\(#book-waitlist\[hidden\]\)\s*\{\s*display:\s*none;\s*\}/,
  'The active product-page state must keep the waitlist visually hidden despite component display styles.',
);
assert.match(
  bookPurchaseCtaSource,
  /id="book-primary-cta"[\s\S]*href="\/checkout\/"[\s\S]*>Check Library Pass availability<\/a>/,
  'The product-page hero must render a neutral checkout destination before Live readiness settles.',
);
assert.doesNotMatch(
  bookPurchaseCtaSource,
  />Join the book waitlist<\/a>/,
  'The product-page hero must not render a stale waitlist CTA during its initial checking state.',
);

for (const [name, source] of [
  ['book', bookPurchaseCtaSource],
  ['home', homeLibraryPassCtaSource],
  ['shared', sharedLibraryPassCtaSource],
]) {
  assert.match(
    source,
    /checkoutHrefWithCampaign/,
    `${name} Library Pass CTA must use the shared campaign-continuity helper.`,
  );
  assert.match(
    source,
    /window\.location\.search/,
    `${name} Library Pass CTA must derive campaign context from the current page query only.`,
  );
  assert.doesNotMatch(
    source,
    /localStorage|sessionStorage|document\.cookie|method:\s*['"]POST['"]/,
    `${name} Library Pass CTA must not persist campaign context or create a commerce/telemetry POST.`,
  );
}

assert.equal(
  checkoutHrefWithCampaign(
    '/checkout/',
    '?utm_source=newsletter&utm_medium=email&utm_campaign=september_launch',
  ),
  '/checkout/?utm_source=newsletter&utm_medium=email&utm_campaign=september_launch',
);
assert.equal(
  checkoutHrefWithCampaign(
    '/checkout/',
    '?utm_campaign=library-pass&utm_source=linkedin&utm_medium=social&utm_content=hero&gclid=secret&email=buyer%40example.com&next=%2Faccount%2F',
  ),
  '/checkout/?utm_source=linkedin&utm_medium=social&utm_campaign=library-pass',
  'Only the three existing non-identifying campaign labels may cross into checkout.',
);
assert.equal(
  checkoutHrefWithCampaign(
    '/checkout/',
    `?utm_source=${'a'.repeat(65)}&utm_medium=paid%20social&utm_campaign=launch%2Ftest`,
  ),
  '/checkout/',
  'Overlong or character-invalid campaign labels must fail closed.',
);
assert.equal(
  checkoutHrefWithCampaign('/checkout/', '?utm_source=valid&utm_medium=&utm_campaign=valid_2'),
  '/checkout/?utm_source=valid&utm_campaign=valid_2',
);
assert.equal(checkoutHrefWithCampaign('/checkout/', ''), '/checkout/');
assert.equal(checkoutHrefWithCampaign('/checkout/', null), '/checkout/');
assert.equal(
  checkoutHrefWithCampaign('#book-waitlist', '?utm_source=newsletter'),
  '#book-waitlist',
  'Waitlist fallback destinations must not be rewritten.',
);
assert.equal(
  checkoutHrefWithCampaign('https://example.com/checkout/', '?utm_source=newsletter'),
  'https://example.com/checkout/',
  'External destinations must never be rewritten.',
);

const signInWithCampaign = new URL(
  checkoutSignInHrefWithCampaign(
    '?utm_source=newsletter&utm_medium=email&utm_campaign=september_launch',
  ),
  'https://usd-impact.invalid',
);
assert.equal(signInWithCampaign.pathname, '/account/sign-in/');
assert.deepEqual([...signInWithCampaign.searchParams.keys()], ['next']);
assert.equal(
  signInWithCampaign.searchParams.get('next'),
  '/checkout/?utm_source=newsletter&utm_medium=email&utm_campaign=september_launch',
  'The sign-in return path must retain the sanitized campaign labels inside one encoded same-origin next value.',
);

const signInWithMixedContext = new URL(
  checkoutSignInHrefWithCampaign(
    '?utm_campaign=library-pass&utm_source=linkedin&utm_medium=social&utm_content=hero&gclid=secret&email=buyer%40example.com&next=%2Faccount%2F',
  ),
  'https://usd-impact.invalid',
);
assert.deepEqual([...signInWithMixedContext.searchParams.keys()], ['next']);
assert.equal(
  signInWithMixedContext.searchParams.get('next'),
  '/checkout/?utm_source=linkedin&utm_medium=social&utm_campaign=library-pass',
  'Identity-shaped, click-ID, redirect, and unknown parameters must not cross the checkout sign-in boundary.',
);
assert.equal(
  new URL(checkoutSignInHrefWithCampaign(null), 'https://usd-impact.invalid').searchParams.get('next'),
  '/checkout/',
  'Missing campaign context must return to the plain checkout path.',
);
assert.equal(
  checkoutRequiresSignIn({ status: 401 }, { code: 'AUTHENTICATION_REQUIRED' }),
  true,
  'Only the USD Impact authentication-required response should request sign-in.',
);
for (const [response, payload] of [
  [{ status: 401 }, { code: 'LEMON_SQUEEZY_LIVE_API_REQUEST_FAILED' }],
  [{ status: 503 }, { code: 'LEMON_SQUEEZY_LIVE_API_REQUEST_FAILED' }],
  [{ status: 401 }, {}],
  [{ status: 403 }, { code: 'AUTHENTICATION_REQUIRED' }],
]) {
  assert.equal(
    checkoutRequiresSignIn(response, payload),
    false,
    'Provider and non-authentication errors must stay on checkout and fail closed.',
  );
}

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

assert.deepEqual(bookPurchasePresentation(activeCommerce), {
  available: true,
  verificationState: 'active',
  primaryLabel: 'Buy the Library Pass — USD 39',
  primaryHref: '/checkout/',
  message: 'The one-time USD 39 Library Pass checkout is open through Lemon Squeezy.',
});
assert.deepEqual(bookPurchasePresentation({
  ...activeCommerce,
  state: 'ready_for_provider_configuration',
  mode: 'disabled',
  provider: null,
  checkoutEnabled: false,
}), {
  available: false,
  verificationState: 'disabled',
  primaryLabel: 'Join the book waitlist',
  primaryHref: '#book-waitlist',
  message: 'Checkout is not currently open. Join the waitlist for an availability update.',
});
assert.deepEqual(bookPurchasePresentation({ ...activeCommerce, checkoutEnabled: false }), {
  available: false,
  verificationState: 'error',
  primaryLabel: 'Join the book waitlist',
  primaryHref: '#book-waitlist',
  message: 'Checkout cannot open because the current Live release state could not be verified. The waitlist remains available.',
});
assert.deepEqual(bookPurchasePresentation({ ...activeCommerce, disclosuresComplete: false }), {
  available: false,
  verificationState: 'error',
  primaryLabel: 'Join the book waitlist',
  primaryHref: '#book-waitlist',
  message: 'Checkout cannot open because the current Live release state could not be verified. The waitlist remains available.',
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
