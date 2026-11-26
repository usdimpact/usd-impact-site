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
  'checkoutHrefWithCampaign',
  "const announcementCta = document.querySelector('.library-pass-launch-announcement__cta')",
  "announcementCta.href = checkoutHrefWithCampaign('/checkout/', window.location.search)",
  '@media (max-width: 760px)',
]) {
  assert.ok(component.includes(required), `Launch announcement is missing: ${required}`);
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
  assert.ok(!component.includes(forbidden), `Launch announcement must not initiate checkout or persist attribution: ${forbidden}`);
}

assert.doesNotMatch(
  layout,
  /LibraryPassLaunchAnnouncement/,
  'Global Library Pass launch announcement must remain disabled.',
);

for (const required of [
  'data-home-free-learning-cta',
  'href="/start-here/"',
  'Start learning for free',
  'Download the weekly checklist',
]) {
  assert.ok(homeCta.includes(required), `Homepage free-learning CTA is missing: ${required}`);
}
assert.doesNotMatch(homeCta, /\/checkout\/|\/api\/commerce-readiness|checkoutHrefWithCampaign|Check Library Pass availability/);

for (const required of [
  'data-public-book-sample-cta',
  'href="/book/read-the-dollar-first/preview/"',
  'Read the public book sample',
]) {
  assert.ok(availabilityCta.includes(required), `Public book sample CTA is missing: ${required}`);
}
assert.doesNotMatch(availabilityCta, /\/checkout\/|\/api\/commerce-readiness|bookPurchasePresentation|Check Library Pass availability/);

assert.match(productCta, /import LibraryPassAvailabilityCTA from '\.\/LibraryPassAvailabilityCTA\.astro';/);
assert.match(productCta, /libraryPassAvailability = false/);
assert.match(productCta, /libraryPassAvailability \? \(\s*<LibraryPassAvailabilityCTA className="button primary" \/>/);
assert.ok(contentRoute.includes("const isLegacyBookAcquisition = requestedPrimary === 'Get the book'"));
assert.ok(contentRoute.includes("? 'Read the public book sample'"));
assert.ok(contentRoute.includes("? '/book/read-the-dollar-first/preview/'"));
assert.ok(contentRoute.includes('libraryPassAvailability={isLegacyBookAcquisition}'));
assert.match(acquisitionContent[0], /ctaPrimary:\s*"Explore the free dollar framework"/);
assert.match(acquisitionContent[0], /ctaPrimaryHref:\s*"\/dollar-framework\/"/);
for (const source of acquisitionContent.slice(1)) {
  assert.match(source, /ctaPrimary:\s*"(?:Get the book|Explore the book)"/);
}
assert.match(homepage, /import HomeLibraryPassCTA from '\.\.\/components\/HomeLibraryPassCTA\.astro';/);
assert.match(homepage, /<HomeLibraryPassCTA \/>/);
assert.doesNotMatch(homepage, /<ProductCTA \/>/);

console.log('Global Library Pass announcement disabled; public CTAs lead only to approved free learning.');

