import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  LOCALIZATION_MANIFEST_SCHEMA_VERSION,
  localizationManifest,
  localizationRecordByContentId,
  spanishPublicWebPaths,
} from '../src/data/localization-manifest.js';
import { videos } from '../src/data/video-library.js';
import {
  DEFAULT_LOCALE,
  LOCALE_POLICY,
  SUPPORTED_LOCALES,
} from '../src/lib/localization-policy.js';

const expectedSchemaVersion = '1.0.0';
const webRoot = new URL('../', import.meta.url);

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function gitBlobSha(content) {
  const bytes = Buffer.from(content, 'utf8');
  const prefix = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(prefix).update(bytes).digest('hex');
}

async function readRepoText(repoPath) {
  assert.match(repoPath, /^apps\/web\//, `Manifest repo path must remain inside apps/web: ${repoPath}`);
  return readFile(new URL(repoPath.slice('apps/web/'.length), webRoot), 'utf8');
}

assert.equal(LOCALIZATION_MANIFEST_SCHEMA_VERSION, expectedSchemaVersion);
assert.equal(localizationManifest.schemaVersion, expectedSchemaVersion);
assert.equal(DEFAULT_LOCALE, 'en');
assert.deepEqual([...SUPPORTED_LOCALES], ['en', 'es']);
assert.deepEqual(sorted(Object.keys(localizationManifest.locales)), sorted(SUPPORTED_LOCALES));

const defaultLocales = Object.values(localizationManifest.locales)
  .filter((locale) => locale.default)
  .map((locale) => locale.locale);
assert.deepEqual(defaultLocales, ['en']);
assert.equal(localizationManifest.principles.canonicalSourceLocale, 'en');
assert.equal(localizationManifest.principles.fallbackLocale, 'en');
assert.equal(localizationManifest.principles.localizationDoesNotCreateEntitlementVariants, true);
assert.equal(localizationManifest.principles.explicitPreferenceOverridesBrowserLanguage, true);
assert.equal(localizationManifest.principles.browserLanguageIsPreferenceHintOnly, true);
assert.equal(localizationManifest.locales.en.analyticsEnabled, true);
assert.equal(
  localizationManifest.locales.es.analyticsEnabled,
  false,
  'Spanish analytics must remain disabled until localized consent/privacy copy is approved.',
);

for (const locale of SUPPORTED_LOCALES) {
  assert.equal(localizationManifest.locales[locale].locale, locale);
  assert.equal(
    localizationManifest.locales[locale].publicWeb,
    LOCALE_POLICY[locale].publicationEnabled,
    `Manifest publicWeb must match LOCALE_POLICY for ${locale}`,
  );
}

const statusValues = localizationManifest.statusValues;
const translationStatuses = new Set(statusValues.translationStatus);
const reviewStatuses = new Set(statusValues.reviewStatus);
const releaseStatuses = new Set(statusValues.releaseStatus);

const allContentIds = [];
const web = localizationManifest.surfaces.web.records;
assert.equal(web.length, 5, 'Phase 1 manifest must register the five currently published Spanish web counterparts.');
assert.deepEqual(spanishPublicWebPaths, web.map((record) => record.localizedUrl));

for (const record of web) {
  allContentIds.push(record.contentId);
  assert.equal(record.sourceLocale, 'en');
  assert.equal(record.targetLocale, 'es');
  assert.ok(translationStatuses.has(record.translationStatus));
  assert.ok(reviewStatuses.has(record.financialReviewStatus));
  assert.ok(reviewStatuses.has(record.languageReviewStatus));
  assert.ok(releaseStatuses.has(record.releaseStatus));
  assert.equal(record.translationStatus, 'verified_current');
  assert.equal(record.financialReviewStatus, 'pass');
  assert.equal(record.languageReviewStatus, 'pass');
  assert.equal(record.releaseStatus, 'published');

  const [sourceContent, translationContent] = await Promise.all([
    readRepoText(record.sourcePath),
    readRepoText(record.localizedPath),
  ]);
  const sourceBlobSha = gitBlobSha(sourceContent);
  const translationBlobSha = gitBlobSha(translationContent);

  assert.equal(
    sourceBlobSha,
    record.sourceBlobSha,
    `[review_required] English source drift detected for ${record.contentId}; review the Spanish counterpart before updating the manifest.`,
  );
  assert.equal(
    translationBlobSha,
    record.translationBlobSha,
    `Spanish translation drift detected for ${record.contentId}; update review/version state deliberately.`,
  );
  assert.equal(record.sourceVersion, `git-blob:${record.sourceBlobSha}`);
  assert.equal(record.translationVersion, `git-blob:${record.translationBlobSha}`);
  assert.equal(localizationRecordByContentId(record.contentId), record);
}

assert.equal(new Set(web.map((record) => record.sourceUrl)).size, web.length);
assert.equal(new Set(web.map((record) => record.localizedUrl)).size, web.length);

const spanishRoute = await readRepoText('apps/web/src/pages/es/[...slug].astro');
const allowlistMatch = spanishRoute.match(
  /const AUTHORIZED_SPANISH_PUBLIC_SLUGS = Object\.freeze\(\[([\s\S]*?)\]\);/,
);
assert.ok(allowlistMatch, 'Spanish public route allowlist must remain explicit and fail-closed.');
const routePaths = [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(
  sorted(routePaths),
  sorted(web.map((record) => record.localizedUrl)),
  'Spanish public route allowlist and localization manifest must match exactly.',
);

const captions = localizationManifest.surfaces.videoCaptions;
const librarySlugs = videos.map((video) => video.slug);
const manifestVideoSlugs = captions.records.map((record) => record.providerAssetKey);
assert.equal(librarySlugs.length, 51);
assert.equal(captions.records.length, 51);
assert.deepEqual(
  sorted(manifestVideoSlugs),
  sorted(librarySlugs),
  'Every current Video Library asset must have exactly one Spanish localization status record.',
);

const sourceInventory = await readRepoText('apps/web/../../docs/localization/SPANISH_VIDEO_LIVE_SOURCE_INVENTORY.md');
const sourceInventorySlugs = [...sourceInventory.matchAll(/^- \`([^\`]+)\` — \d+ cues$/gm)]
  .map((match) => match[1]);
assert.deepEqual(
  sorted(sourceInventorySlugs),
  sorted(librarySlugs),
  'Live English caption inventory must match the current Video Library exactly.',
);

const sourceEvidenceSha = gitBlobSha(sourceInventory);
assert.equal(
  sourceEvidenceSha,
  captions.sourceAuthority.evidenceBlobSha,
  'English caption source-evidence record drifted; re-review before updating the manifest.',
);
const finalQa = await readRepoText('apps/web/../../docs/localization/SPANISH_VIDEO_FINAL_HOLD_QA.md');
const finalQaSha = gitBlobSha(finalQa);
assert.equal(
  finalQaSha,
  captions.targetAuthority.evidenceBlobSha,
  'Spanish caption final-QA evidence drifted; re-review before updating the manifest.',
);
assert.match(finalQa, /51 \/ 51 PROVIDER \+ POST-UPLOAD QA PASS/);
assert.equal(captions.sourceAuthority.locale, 'en');
assert.equal(captions.targetAuthority.locale, 'es');
assert.equal(captions.targetAuthority.defaultTrack, false);

for (const record of captions.records) {
  allContentIds.push(record.contentId);
  assert.equal(record.sourceLocale, 'en');
  assert.equal(record.targetLocale, 'es');
  assert.equal(record.translationStatus, 'verified_current');
  assert.equal(record.financialReviewStatus, 'pass');
  assert.equal(record.languageReviewStatus, 'pass');
  assert.equal(record.releaseStatus, 'provider_non_default');
  assert.equal(record.sourceChecksum, null);
  assert.equal(record.translationChecksum, null);
  assert.equal(record.checksumState, 'exact-provider-readback-verified');
  assert.equal(localizationRecordByContentId(record.contentId), record);
}

const book = localizationManifest.surfaces.book;
allContentIds.push(book.contentId);
assert.equal(book.sourceLocale, 'en');
assert.equal(book.targetLocale, 'es');
assert.match(book.source.sha256, /^[a-f0-9]{64}$/);
assert.ok(book.source.driveFileId);
assert.ok(book.translation.driveFileId);
assert.ok(book.translation.revision);
assert.equal(book.translationStatus, 'verified_current');
assert.equal(book.financialReviewStatus, 'pass');
assert.equal(book.languageReviewStatus, 'pass');
assert.equal(book.releaseStatus, 'private_hold');
assert.equal(localizationManifest.locales.es.bookMemberDelivery, false);
assert.equal(localizationRecordByContentId(book.contentId), book);

const audiobook = localizationManifest.surfaces.audiobook;
allContentIds.push(audiobook.contentId);
assert.equal(audiobook.sourceContentId, book.contentId);
assert.equal(audiobook.sourceLocale, 'es');
assert.equal(audiobook.targetLocale, 'es');
assert.equal(audiobook.translationStatus, 'in_progress');
assert.equal(audiobook.releaseStatus, 'private_hold');
assert.equal(localizationManifest.locales.es.audiobookMemberDelivery, false);
assert.match(audiobook.workingBranch, /^feat\/spanish-audiobook-/);
assert.match(audiobook.checkpointCommit, /^[a-f0-9]{40}$/);
assert.equal(localizationRecordByContentId(audiobook.contentId), audiobook);

const privacyConsent = localizationManifest.surfaces.privacyConsent;
allContentIds.push(privacyConsent.contentId);
assert.equal(privacyConsent.sourceLocale, 'en');
assert.equal(privacyConsent.targetLocale, 'es');
assert.equal(privacyConsent.translationStatus, 'in_progress');
assert.equal(privacyConsent.privacyLegalReviewStatus, 'required_before_release');
assert.equal(privacyConsent.languageReviewStatus, 'required_before_release');
assert.equal(privacyConsent.releaseStatus, 'private_hold');
assert.equal(privacyConsent.spanishAnalyticsEnabled, false);
assert.equal(privacyConsent.publicSpanishPrivacyRoute, null);
assert.equal(localizationManifest.locales.es.analyticsEnabled, false);
assert.equal(localizationRecordByContentId(privacyConsent.contentId), privacyConsent);

const [privacySource, privacyDraft, consentCopy, reviewLayout, astroConfig] = await Promise.all([
  readRepoText(privacyConsent.source.privacyPath),
  readRepoText(privacyConsent.draft.privacyReviewPath),
  readRepoText(privacyConsent.draft.consentCopyPath),
  readRepoText('apps/web/src/layouts/SpanishPrivacyReviewLayout.astro'),
  readRepoText('apps/web/astro.config.mjs'),
]);
assert.equal(
  gitBlobSha(privacySource),
  privacyConsent.source.privacyBlobSha,
  '[review_required] English privacy notice changed; Spanish privacy/consent review must be refreshed before release.',
);
assert.equal(
  gitBlobSha(privacyDraft),
  privacyConsent.draft.privacyReviewBlobSha,
  'Spanish privacy review draft changed; update its review/version state deliberately.',
);
assert.equal(
  gitBlobSha(consentCopy),
  privacyConsent.draft.consentCopyBlobSha,
  'Locale consent copy changed; update the Spanish privacy/consent review state deliberately.',
);
assert.match(reviewLayout, /noindex/);
assert.match(reviewLayout, /<ConsentClient locale="es"/);
assert.match(reviewLayout, /La analítica de <code>\/es<\/code> continúa deshabilitada/);
assert.ok(astroConfig.includes("'/internal/localization/spanish-privacy-review'"));
assert.ok(privacyDraft.includes('REVISIÓN INTERNA') || privacyDraft.includes('revisión interna'));
assert.ok(privacyDraft.includes('No es todavía el aviso público de privacidad en español.'));
assert.ok(consentCopy.includes("bannerTitle: 'Opciones de privacidad'"));
assert.ok(consentCopy.includes("reject: 'Rechazar analítica'"));
assert.ok(consentCopy.includes("accept: 'Aceptar analítica'"));

const email = localizationManifest.surfaces.email;
assert.deepEqual(email.enabledLocales, ['en']);
assert.deepEqual(email.blockedLocales, ['es']);
assert.equal(email.spanishStatus, 'not_enabled');
assert.equal(email.releaseStatus, 'not_enabled');
assert.equal(localizationManifest.locales.es.marketingEmail, false);

const knowledge = localizationManifest.surfaces.knowledge;
assert.deepEqual(sorted(knowledge.queryContractLocales), ['en', 'es']);
assert.equal(localizationManifest.locales.es.knowledgeQuery, true);

assert.equal(
  new Set(allContentIds).size,
  allContentIds.length,
  'Localization content IDs must be globally unique.',
);

console.log(
  `Localization manifest PASS: ${web.length} web pairs, ${captions.records.length} video caption pairs, book + private audiobook state locked.`,
);
