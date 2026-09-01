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
const availabilityCta = await readFile(path.join(webRoot, 'src/components/LibraryPassAvailabilityCTA.astro'), 'utf8');
const productCta = await readFile(path.join(webRoot, 'src/components/ProductCTA.astro'), 'utf8');
const contentRoute = await readFile(path.join(webRoot, 'src/pages/[...slug].astro'), 'utf8');
const homepage = await readFile(path.join(webRoot, 'src/pages/index.astro'), 'utf8');
const layout = await readFile(path.join(webRoot, 'src/layouts/BaseLayout.astro'), 'utf8');
const acquisitionContent = await Promise.all([
  'src/content/pages/start-here.md',
  'src/content/frameworks/framework-three-dial-dashboard.md',
  'src/content/frameworks/framework-dollar-transmission-chain.md',
  'src/content/lead-magnets/lead-magnet-weekly-dollar-regime-checklist.md',
].map((relativePath) => readFile(path.join(webRoot, relativePath), 'utf8')));

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
  'Check Library Pass availability',
  "const neutralCheckoutUrl = '/checkout/'",
  'href={neutralCheckoutUrl}',
  '/api/commerce-readiness',
  "credentials: 'same-origin'",
  "cache: 'no-store'",
  'bookPurchasePresentation(body.commerce)',
  'checkoutHrefWithCampaign',
  'window.location.search',
  'primary.href = presentation.available',
  ': waitlistUrl',
  "container.dataset.homeCheckoutReadiness = 'error'",
  'Checkout availability could not be verified. The book waitlist remains available.',
]) {
  assert.ok(homeCta.includes(required), `Homepage Library Pass CTA is missing: ${required}`);
}
assert.match(
  homeCta,
  /data-home-library-pass-primary[\s\S]*href=\{neutralCheckoutUrl\}[\s\S]*>Check Library Pass availability<\/a>/,
  'Homepage CTA must render a neutral checkout destination before readiness settles.',
);

for (const required of [
  'data-library-pass-availability-cta',
  'data-library-pass-checkout-readiness="checking"',
  'href="/checkout/"',
  'Check Library Pass availability',
  '/api/commerce-readiness',
  "credentials: 'same-origin'",
  "cache: 'no-store'",
  'return bookPurchasePresentation(body.commerce)',
  'checkoutHrefWithCampaign',
  'candidate.href = campaignCheckoutUrl()',
  'if (!presentation.available) continue',
  'candidate.textContent = presentation.primaryLabel',
  'candidate.href = checkoutHrefWithCampaign(',
  "candidate.dataset.libraryPassCheckoutReadiness = 'error'",
]) {
  assert.ok(availabilityCta.includes(required), `Neutral Library Pass CTA is missing: ${required}`);
}
for (const forbidden of [
  '/api/commerce?action=checkout',
  "method: 'POST'",
  'window.location.assign',
  'lemonsqueezy.com',
  'localStorage',
  'sessionStorage',
  'document.cookie',
]) {
  assert.ok(!availabilityCta.includes(forbidden), `Neutral Library Pass CTA crosses its boundary: ${forbidden}`);
}

assert.match(productCta, /import LibraryPassAvailabilityCTA from '.\/LibraryPassAvailabilityCTA\.astro';/);
assert.match(productCta, /libraryPassAvailability = false/);
assert.match(productCta, /libraryPassAvailability \? \(\s*<LibraryPassAvailabilityCTA className="button primary" \/>/);
assert.match(contentRoute, /const isLibraryPassAcquisition = requestedPrimary === 'Get the book'[\s\S]*requestedPrimary === 'Explore the book';/);
assert.match(contentRoute, /const primaryLabel = isLibraryPassAcquisition[\s\S]*'Check Library Pass availability'/);
assert.match(contentRoute, /const primaryHref = isLibraryPassAcquisition[\s\S]*'\/checkout\/'/);
assert.match(contentRoute, /libraryPassAvailability=\{isLibraryPassAcquisition\}/);
for (const source of acquisitionContent) {
  assert.match(source, /ctaPrimary:\s*"(?:Get the book|Explore the book)"/);
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

console.log('Library Pass launch announcement and acquisition CTA contract passed.');
