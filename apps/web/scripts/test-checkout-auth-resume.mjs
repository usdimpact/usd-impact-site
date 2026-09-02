import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browserHelper = await readFile(new URL('../public/assets/passkey-browser.js', import.meta.url), 'utf8');
const signInPage = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');
const checkoutPage = await readFile(new URL('../src/pages/checkout/index.astro', import.meta.url), 'utf8');

assert.match(
  checkoutPage,
  /href="\/account\/sign-in\/\?next=\/checkout\/"/,
  'Checkout must identify /checkout/ as the requested destination before sign-in.',
);
assert.match(
  signInPage,
  /const requestedNext = new URLSearchParams\(window\.location\.search\)\.get\('next'\)/,
  'Sign-in must still honor an explicit safe next destination.',
);
assert.match(
  browserHelper,
  /restoreCheckoutReturnFromReferrer/,
  'The browser auth helper must recover checkout context when an intermediary strips the next query.',
);
assert.match(
  browserHelper,
  /referrer\.origin !== window\.location\.origin \|\| referrer\.pathname !== '\/checkout\/'/,
  'Checkout recovery must require an exact same-origin /checkout/ referrer.',
);
assert.match(
  browserHelper,
  /requestedNext && requestedNext !== '\/account\/'/,
  'Checkout recovery must not override an explicit non-default destination.',
);
assert.match(
  browserHelper,
  /nextInput\.value = `\$\{referrer\.pathname\}\$\{referrer\.search\}`/,
  'Recovered checkout context must preserve the same-origin checkout query only.',
);
assert.match(
  browserHelper,
  /return to checkout automatically/,
  'Checkout-origin sign-in should clearly tell the buyer what will happen next.',
);
assert.doesNotMatch(
  browserHelper,
  /localStorage|sessionStorage|document\.cookie/,
  'Checkout auth recovery must remain ephemeral and must not persist browser identity or campaign state.',
);

console.log('Checkout authentication resume contract passed.');
