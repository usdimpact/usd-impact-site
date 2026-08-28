import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { libraryPassLaunchAnnouncementCanOpen } from '../src/lib/library-pass-launch-announcement.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const component = await readFile(
  path.join(webRoot, 'src/components/LibraryPassLaunchAnnouncement.astro'),
  'utf8',
);
const homeCta = await readFile(path.join(webRoot, 'src/components/HomeLibraryPassCTA.astro'), 'utf8');
const homepage = await readFile(path.join(webRoot, 'src/pages/index.astro'), 'utf8');
const layout = await readFile(path.join(webRoot, 'src/layouts/BaseLayout.astro'), 'utf8');

const activePayload = {
  ok: true,
  commerce: {
    state: 'active',
    mode: 'live',
    provider: 'lemon-squeezy',
    providerConfigured: true,
    checkoutEnabled: true,
    disclosuresComplete: true,
  },
};

assert.equal(libraryPassLaunchAnnouncementCanOpen(activePayload), true);

for (const [label, payload] of [
  ['failed response', { ...activePayload, ok: false }],
  ['disabled state', { ...activePayload, commerce: { ...activePayload.commerce, state: 'disabled' } }],
  ['non-Live mode', { ...activePayload, commerce: { ...activePayload.commerce, mode: 'test' } }],
  ['wrong provider', { ...activePayload, commerce: { ...activePayload.commerce, provider: 'other' } }],
  ['unconfigured provider', { ...activePayload, commerce: { ...activePayload.commerce, providerConfigured: false } }],
  ['disabled checkout', { ...activePayload, commerce: { ...activePayload.commerce, checkoutEnabled: false } }],
  ['incomplete disclosures', { ...activePayload, commerce: { ...activePayload.commerce, disclosuresComplete: false } }],
  ['missing payload', null],
]) {
  assert.equal(libraryPassLaunchAnnouncementCanOpen(payload), false, `${label} must remain fail-closed`);
}

for (const required of [
  'data-library-pass-launch-announcement',
  'aria-live="polite"',
  'hidden',
  '/api/commerce-readiness',
  "credentials: 'same-origin'",
  "cache: 'no-store'",
  'announcement.hidden = false',
  'announcement.hidden = true',
  'Read the Dollar First is now available.',
  "</strong>{' '}",
  'one-time USD 39 Library Pass',
  'Read the Dollar First ya está disponible.',
  'un único pago de USD 39',
  'Open secure checkout / Abrir checkout seguro',
  'href="/checkout/"',
  '@media (max-width: 760px)',
]) {
  assert.ok(component.includes(required), `Launch announcement is missing: ${required}`);
}

for (const forbidden of [
  '/api/commerce?action=checkout',
  'window.location.assign',
  'lemonsqueezy.com',
]) {
  assert.ok(!component.includes(forbidden), `Launch announcement must not initiate checkout: ${forbidden}`);
}

assert.match(layout, /import LibraryPassLaunchAnnouncement from '..\/components\/LibraryPassLaunchAnnouncement\.astro';/);
assert.match(layout, /<\/header>\s*<LibraryPassLaunchAnnouncement \/>\s*<slot \/>/);

for (const required of [
  'data-home-library-pass-cta',
  'data-home-checkout-readiness="checking"',
  'aria-busy="true"',
  'data-home-library-pass-primary',
  'Join the book waitlist',
  '/book/read-the-dollar-first/#book-waitlist',
  '/api/commerce-readiness',
  "credentials: 'same-origin'",
  "cache: 'no-store'",
  'bookPurchasePresentation(body.commerce)',
  "primary.href = presentation.available ? presentation.primaryHref : waitlistUrl",
  "container.dataset.homeCheckoutReadiness = 'error'",
  'Checkout availability could not be verified. The book waitlist remains available.',
]) {
  assert.ok(homeCta.includes(required), `Homepage Library Pass CTA is missing: ${required}`);
}

for (const forbidden of [
  '/api/commerce?action=checkout',
  'window.location.assign',
  'lemonsqueezy.com',
]) {
  assert.ok(!homeCta.includes(forbidden), `Homepage CTA must not initiate checkout: ${forbidden}`);
}

assert.match(homepage, /import HomeLibraryPassCTA from '..\/components\/HomeLibraryPassCTA\.astro';/);
assert.match(homepage, /<HomeLibraryPassCTA \/>/);
assert.doesNotMatch(homepage, /<ProductCTA \/>/);

console.log('Library Pass launch announcement contract passed.');
