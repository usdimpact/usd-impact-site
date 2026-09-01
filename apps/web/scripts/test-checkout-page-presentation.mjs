import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const checkoutSource = await readFile(
  new URL('../src/pages/checkout/index.astro', import.meta.url),
  'utf8',
);

assert.match(
  checkoutSource,
  /<button id="checkout-button"[^>]*\bhidden\b/,
  'The payment control must remain hidden until Live readiness verification succeeds.',
);
assert.match(
  checkoutSource,
  /<a id="waitlist-link"[^>]*\bhidden\b/,
  'The fallback waitlist control must not flash before Live readiness verification finishes.',
);
assert.match(
  checkoutSource,
  /No payment can be initiated until verification completes\./,
  'The initial checkout status must describe the verification boundary accurately.',
);
assert.match(
  checkoutSource,
  /This page cannot verify checkout availability without JavaScript\. No purchase control is shown until verification succeeds\./,
  'The no-script fallback must describe fail-closed verification without claiming that Live checkout is closed.',
);
assert.doesNotMatch(
  checkoutSource,
  /Checkout is not open yet\./,
  'The no-script fallback must not make a stale checkout-availability claim.',
);

for (const requiredSpacing of [
  "Trade Register number{' '}",
  "Registered business address:{' '}",
  "Support:{' '}",
  "invoice. Its{' '}",
  "</a>{' '}and{' '}",
  "</a>{' '}apply to the",
  "under its{' '}",
  "</a>{' '}·{' '}",
]) {
  assert.ok(
    checkoutSource.includes(requiredSpacing),
    `Checkout source is missing explicit inline spacing: ${requiredSpacing}`,
  );
}

assert.match(
  checkoutSource,
  /renderCheckoutAvailability\(commerce, disclosureRendered\)/,
  'The verified readiness result must continue to control which checkout fallback is displayed.',
);
assert.match(
  checkoutSource,
  /waitlistLink\.hidden = presentation\.available/,
  'The waitlist fallback must still appear after verification when checkout is unavailable.',
);

const builtCheckoutPath = path.resolve('dist/checkout/index.html');
if (fs.existsSync(builtCheckoutPath)) {
  const builtHtml = await readFile(builtCheckoutPath, 'utf8');
  const requiredBuiltPatterns = [
    {
      pattern: /id="waitlist-link"[^>]*\bhidden\b/,
      label: 'initial waitlist fallback remains hidden',
    },
    {
      pattern: /Trade Register number\s+<strong>J38\/820\/2020<\/strong>/,
      label: 'Trade Register label and value remain separated',
    },
    {
      pattern: /Registered business address:\s+<strong>Str\. Doctor Hacman nr\. 28/,
      label: 'registered-address label and value remain separated',
    },
    {
      pattern: /Support:\s+<a href="mailto:support@usd-impact\.com">support@usd-impact\.com<\/a>/,
      label: 'support label and email remain separated',
    },
    {
      pattern: /invoice\. Its\s+<a href="https:\/\/www\.lemonsqueezy\.com\/buyer-terms"[^>]*>Buyer Terms<\/a>\s+and\s+<a href="https:\/\/www\.lemonsqueezy\.com\/privacy"[^>]*>Privacy Policy<\/a>\s+apply to the payment transaction\./,
      label: 'Merchant-of-Record terms sentence remains readable',
    },
    {
      pattern: /under its\s+<a href="\/refund-policy\/">14-day Refund Policy<\/a>/,
      label: 'refund-policy sentence remains readable',
    },
    {
      pattern: /Merchant-of-Record buyer terms<\/a>\s+·\s+<a id="seller-provider-privacy"/,
      label: 'dynamic legal links retain a readable separator',
    },
  ];

  for (const { pattern, label } of requiredBuiltPatterns) {
    assert.match(
      builtHtml,
      pattern,
      `Built checkout presentation failed: ${label}.`,
    );
  }
}

console.log(
  fs.existsSync(builtCheckoutPath)
    ? 'Checkout source and built presentation regression passed.'
    : 'Checkout source presentation regression passed.',
);
