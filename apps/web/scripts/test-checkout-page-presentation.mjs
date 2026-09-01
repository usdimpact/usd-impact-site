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
  assert.match(
    builtHtml,
    /id="waitlist-link"[^>]*\bhidden\b/,
    'The built checkout page must keep the waitlist fallback hidden during the initial checking state.',
  );

  const normalizedText = builtHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  for (const requiredText of [
    'Trade Register number J38/820/2020',
    'Registered business address: Str. Doctor Hacman nr. 28',
    'Support: support@usd-impact.com',
    'Its Buyer Terms and Privacy Policy apply to the payment transaction.',
    'under its 14-day Refund Policy',
    'Merchant-of-Record buyer terms · Payment-provider privacy terms',
  ]) {
    assert.ok(
      normalizedText.includes(requiredText),
      `Built checkout disclosure is missing readable inline spacing: ${requiredText}`,
    );
  }
}

console.log(
  fs.existsSync(builtCheckoutPath)
    ? 'Checkout source and built presentation regression passed.'
    : 'Checkout source presentation regression passed.',
);
