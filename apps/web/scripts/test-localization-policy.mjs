import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  audiobookProgressStorageKey,
  isLocalePublicationEnabled,
  isUnpublishedLocalePath,
  normalizeLocale,
  resolveSupportedLocale,
} from '../src/lib/localization-policy.js';

assert.equal(DEFAULT_LOCALE, 'en');
assert.deepEqual([...SUPPORTED_LOCALES], ['en', 'es']);
assert.equal(resolveSupportedLocale('en'), 'en');
assert.equal(resolveSupportedLocale('ES'), 'es');
assert.equal(resolveSupportedLocale('fr'), null);
assert.equal(normalizeLocale(undefined), 'en');

assert.equal(isLocalePublicationEnabled('en'), true);
assert.equal(isLocalePublicationEnabled('es'), false);
assert.equal(isLocalePublicationEnabled('fr'), false);

assert.equal(isUnpublishedLocalePath('/es'), true);
assert.equal(isUnpublishedLocalePath('/es/'), true);
assert.equal(isUnpublishedLocalePath('/es/start-here/'), true);
assert.equal(isUnpublishedLocalePath('/estimated/'), false);
assert.equal(isUnpublishedLocalePath('/'), false);

assert.equal(
  audiobookProgressStorageKey('en'),
  'usd-impact-library-pass-audiobook-progress',
);
assert.equal(
  audiobookProgressStorageKey('es'),
  'usd-impact-library-pass-audiobook-progress:es',
);
assert.notEqual(audiobookProgressStorageKey('en'), audiobookProgressStorageKey('es'));
assert.throws(() => audiobookProgressStorageKey('fr'), /Unsupported locale/);

const [
  baseLayout,
  audiobookHandler,
  videoLibraryPage,
  marketingOptInHandler,
  marketingOptInReadiness,
  weeklyNewsletterEmail,
  progressEmail,
  astroConfig,
] = await Promise.all([
  readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/audiobook-handler.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/video-library-page.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/marketing-opt-in-handler.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/marketing-opt-in-readiness.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/weekly-newsletter-email.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/progress-email-email.js', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
]);

assert.match(baseLayout, /<html lang="en">/);
assert.match(
  audiobookHandler,
  /data-key="usd-impact-library-pass-audiobook-progress"/,
);
assert.match(videoLibraryPage, /defaultTextTrack:\s*'en'/);
assert.match(videoLibraryPage, /<strong>EN<\/strong> captions/);
assert.match(
  marketingOptInHandler,
  /\(payload\.locale \?\? 'en'\) !== 'en'/,
);
assert.match(marketingOptInHandler, /UNAPPROVED_OPT_IN_LOCALE/);
assert.match(marketingOptInReadiness, /locale !== 'en'/);
assert.match(weeklyNewsletterEmail, /payload\.locale !== 'en'/);
assert.match(progressEmail, /payload\.locale !== 'en'/);
assert.match(astroConfig, /isUnpublishedLocalePath/);
assert.match(astroConfig, /!isUnpublishedLocalePath\(pathname\)/);

console.log('localization policy and English regression boundaries: PASS');
