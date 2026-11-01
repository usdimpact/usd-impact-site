import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  audiobookProgressStorageKey,
  isLocalePublicationEnabled,
  isPreviewLocaleImplementationEnabled,
  isUnpublishedLocalePath,
  normalizeLocale,
  resolveSupportedLocale,
} from '../src/lib/localization-policy.js';

import { SITE_NAVIGATION, SPANISH_GROUPED_NAVIGATION } from '../src/lib/site-navigation.js';
import {
  SPANISH_PUBLIC_REVIEW_SECTIONS,
  SPANISH_PUBLIC_REVIEW_PATHS,
  SPANISH_PUBLIC_REVIEW_PAIRS,
  spanishPublicReviewEnabled,
  isSpanishPublicReviewPath,
} from '../src/lib/spanish-public-review-policy.js';

assert.equal(SPANISH_GROUPED_NAVIGATION.length, SITE_NAVIGATION.length, 'Spanish uses the same three navigation groups');
assert.deepEqual(SPANISH_GROUPED_NAVIGATION.map(({ label }) => label), ['Aprender', 'Actualizaciones', 'Biblioteca']);
assert.deepEqual(
  SPANISH_GROUPED_NAVIGATION.map(({ links }) => links.length),
  SITE_NAVIGATION.map(({ links }) => links.length),
  'Spanish uses exactly the same navigation hierarchy',
);
assert.deepEqual(
  SPANISH_GROUPED_NAVIGATION.flatMap(({ links }) => links.map(({ englishHref }) => englishHref)),
  SITE_NAVIGATION.flatMap(({ links }) => links.map(({ href }) => href)),
  'Spanish must map each menu position to its exact English destination, not an adjacent article',
);
assert.equal(
  SPANISH_GROUPED_NAVIGATION[0].links[1].href,
  '/es/framework/dollar-transmission-chain/',
  'Framework must resolve to the translated version of the linked English Framework page',
);
assert.ok(SPANISH_GROUPED_NAVIGATION.flatMap(({ links }) => links)
  .filter(({ contentLocale }) => contentLocale === 'en')
  .every(({ href, englishHref }) => href === englishHref),
  'English-only fallback destinations must not change paths when locale is Spanish',
);
const publicEsLinks = new Set(['/es/start-here/', '/es/framework/dollar-transmission-chain/']);
const englishFallbacks = SPANISH_GROUPED_NAVIGATION.flatMap(({ links }) => links)
  .filter(({ contentLocale }) => contentLocale === 'en');
assert.ok(englishFallbacks.length > 0);
assert.ok(englishFallbacks.every(({ href }) => !href.startsWith('/es/')), 'unpublished ES paths must never be fabricated');
assert.ok(SPANISH_GROUPED_NAVIGATION.flatMap(({ links }) => links)
  .filter(({ contentLocale }) => contentLocale === 'es')
  .every(({ href }) => publicEsLinks.has(href)), 'only reviewed ES destinations in the grouped nav');


import { videos, collections } from '../src/data/video-library.js';
import { spanishVideoMetadata, spanishVideoCollections } from '../src/data/es-video-catalog-draft.js';

assert.deepEqual([...SPANISH_PUBLIC_REVIEW_SECTIONS], ['news','score','reports','video-library']);
assert.deepEqual([...SPANISH_PUBLIC_REVIEW_PATHS], ['/es/news','/es/score','/es/reports','/es/video-library']);
assert.deepEqual(
  SPANISH_PUBLIC_REVIEW_PAIRS,
  {'/news':'/es/news/','/score':'/es/score/','/reports':'/es/reports/','/video-library':'/es/video-library/'},
);
assert.equal(spanishPublicReviewEnabled('preview'), true);
assert.equal(spanishPublicReviewEnabled('production'), false);
assert.equal(spanishPublicReviewEnabled(undefined), false);
assert.equal(isSpanishPublicReviewPath('/es/news/'), true);
assert.equal(isSpanishPublicReviewPath('/es/score'), true);
assert.equal(isSpanishPublicReviewPath('/es/invalid'), false);
assert.equal(isSpanishPublicReviewPath('/es/start-here'), false, 'existing reviewed Spanish public pages are not UI-40 previews');

assert.equal(videos.length, 51, 'source video catalogue should remain the same 51 approved entries');
assert.equal(Object.keys(spanishVideoMetadata).length, 51, 'every source film requires Spanish metadata');
assert.deepEqual(
  [...Object.keys(spanishVideoMetadata)].sort(),
  videos.map(({ slug }) => slug).sort(),
  'Spanish metadata must map exactly the 51 source slugs without omissions or additions',
);
assert.deepEqual(
  Object.keys(spanishVideoCollections).sort(),
  collections.map(({ id }) => id).sort(),
  'all five source collections must have Spanish names and descriptions',
);
for (const film of videos) {
  const es = spanishVideoMetadata[film.slug];
  assert.ok(es.title && es.description, 'missing Spanish title/description for ' + film.slug);
}
const spanishPreview = await readFile(new URL('../src/pages/es/[section].astro', import.meta.url), 'utf8');
assert.match(spanishPreview, /if \(!spanishPublicReviewEnabled\(process\.env\.VERCEL_ENV\)\) return \[\]/);
assert.match(spanishPreview, /return SPANISH_PUBLIC_REVIEW_SECTIONS\.map/);
assert.match(spanishPreview, /\bnoindex\b/);
const astroSiteMapConfig = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');
assert.match(astroSiteMapConfig, /!isSpanishPublicReviewPath\(pathname\)/);
const canonicalVerifier = await readFile(new URL('./verify-canonical-build.mjs', import.meta.url), 'utf8');
assert.match(canonicalVerifier, /Preview-only Spanish route generated outside Preview/);
assert.match(canonicalVerifier, /Preview-only Spanish route is in sitemap/);
assert.match(canonicalVerifier, /Spanish Preview-only route missing noindex/);
assert.match(canonicalVerifier, /Spanish Preview-only route has canonical/);
assert.match(spanishPreview, /status === 'published'/);
assert.match(spanishPreview, /monthlyEligibility\(weekly, monthly\)/);
assert.match(spanishPreview, /<span lang="en">\{r\.data\.title\}<\/span>/);
assert.match(spanishPreview, /subtítulos en español/i);
assert.match(spanishPreview, /no se ha publicado una pista de narración alternativa en español/);
assert.doesNotMatch(spanishPreview, /<video|<audio|autoplay|publicBucket|setContentLanguagePreference/);

// Historical source-paired Daily translation: editorial draft only, never
// import this Markdown into Astro's published news collections.
const dailyEnglishBytes = await readFile(new URL('../src/content/news/2026-10-30.md', import.meta.url));
const dailyEnglish = dailyEnglishBytes.toString('utf8');
const expectedDailySourceSha = 'f8881e383adba66eb801a3fbbcb4d1507de32917';
const computedGitBlobSha = createHash('sha1')
  .update('blob ' + String(dailyEnglishBytes.length) + '\0')
  .update(dailyEnglishBytes)
  .digest('hex');
assert.equal(computedGitBlobSha, expectedDailySourceSha, 'source Daily updated: re-review Spanish candidate before release');
const spanishDailyCandidate = await readFile(
  new URL('../../../docs/localization/drafts/DAILY_2026-10-30_ES_CANDIDATE_2026-11-02.md', import.meta.url), 'utf8',
);
for (const required of [
  'language: es', 'publicationAuthorized: false', 'releaseStatus: private_draft',
  'sourcePublishedDate: 2026-10-30', 'originalPublicUrl: /news/2026-10-30',
  'sourceBlobSha: ' + expectedDailySourceSha,
  '## Resumen ejecutivo', '## Titulares verificados y sus implicaciones',
  '## Qué cambió', '## Qué importa para la lista de seguimiento de USD Impact',
  '## Qué vigilar después', '## Error habitual', '## Conclusión clave',
  '## Fuentes verificadas y límites de la edición',
  '30 de octubre', '0,8 %', '0,9 %', '3,4 %', '3,6 %',
  '3,75 %', '4,00 %', '10 a 2', 'antes de la publicación del ECI',
]) {
  assert.ok(spanishDailyCandidate.includes(required), 'Spanish Daily editorial draft missing ' + required);
}
const dailySourceIds = [...dailyEnglish.matchAll(/^  - id: "([^"]+)"$/gm)].map(([, id]) => id);
assert.equal(dailySourceIds.length, 7, 'expected seven original primary source IDs');
assert.equal(new Set(dailySourceIds).size, 7);
for (const sourceId of dailySourceIds) {
  assert.ok(spanishDailyCandidate.includes(String.fromCharCode(96) + sourceId + String.fromCharCode(96)), 'Spanish Daily draft lost primary source ID ' + sourceId);
}
assert.ok(!spanishPreview.includes('/es/news/2026-10-30'), 'unreviewed translated dated Daily must have no Preview route');

// Historical Weekly source-paired translation: no new Score calculation,
// date-of-report change or rights activation is permitted by the draft.
const weeklyEnglishBytes = await readFile(new URL('../src/content/weekly-reports/2026-10-23.md', import.meta.url));
const weeklyEnglish = weeklyEnglishBytes.toString('utf8');
const expectedWeeklySourceSha = '9bd65af82fb98e71fafd6bd98870c72be1fe2390';
const actualWeeklyGitBlobSha = createHash('sha1')
  .update('blob ' + String(weeklyEnglishBytes.length) + '\0')
  .update(weeklyEnglishBytes)
  .digest('hex');
assert.equal(actualWeeklyGitBlobSha, expectedWeeklySourceSha, 'source Weekly updated: re-review Spanish candidate before release');
const spanishWeeklyCandidate = await readFile(
  new URL('../../../docs/localization/drafts/WEEKLY_2026-10-23_ES_CANDIDATE_2026-11-02.md', import.meta.url), 'utf8',
);
for (const required of [
  'language: es', 'publicationAuthorized: false', 'releaseStatus: private_draft',
  'sourcePeriodStart: 2026-10-19', 'sourcePeriodEnd: 2026-10-23',
  'originalPublicUrl: /reports/weekly/2026-10-23',
  'sourceBlobSha: ' + expectedWeeklySourceSha,
  '## Resumen ejecutivo de la semana', '## Temas de la semana',
  '## Cómo encajan las noticias y el Score', '## Qué vigilar después',
  '## Nota metodológica y procedencia',
  '−0,5037263731481794', '−0,021022170432771492',
  '+0,0548985187261295', 'SPX −0,296', 'WTI −0,273', 'GOLD −0,267',
  'Soft dollar regime', '−0,30', '1.232', '4,2 %', '1,5 %',
]) {
  assert.ok(spanishWeeklyCandidate.includes(required), 'Spanish Weekly editorial draft missing ' + required);
}
const weeklySourceEditionPaths = [...weeklyEnglish.matchAll(/^    url: "(\/news\/2026-10-\d{2})"$/gm)].map(([, path]) => path);
assert.equal(weeklySourceEditionPaths.length, 5, 'Weekly source must contain five Daily edition links');
for (const url of weeklySourceEditionPaths) {
  assert.ok(spanishWeeklyCandidate.includes('](' + url + ')'), 'Spanish Weekly draft lost original Daily link ' + url);
}
const weeklyOriginalCatalysts = [...weeklyEnglish.matchAll(/^  - date: "(2026-10-\d{2})"$/gm)].map(([, date]) => date);
assert.deepEqual(weeklyOriginalCatalysts, ['2026-10-28', '2026-10-30']);
assert.ok(spanishWeeklyCandidate.includes('https://score.usd-impact.com/archive/2026-10-23/weekly_input.json'));
assert.ok(!spanishPreview.includes('/es/reports/weekly/2026-10-23'), 'unreviewed translated Weekly must have no Preview route');

assert.equal(DEFAULT_LOCALE, 'en');
assert.deepEqual([...SUPPORTED_LOCALES], ['en', 'es']);
assert.equal(resolveSupportedLocale('en'), 'en');
assert.equal(resolveSupportedLocale('ES'), 'es');
assert.equal(resolveSupportedLocale('fr'), null);
assert.equal(normalizeLocale(undefined), 'en');

assert.equal(isLocalePublicationEnabled('en'), true);
assert.equal(isLocalePublicationEnabled('es'), true);
assert.equal(isLocalePublicationEnabled('fr'), false);

assert.equal(isPreviewLocaleImplementationEnabled('es', 'preview'), false);
assert.equal(isPreviewLocaleImplementationEnabled('es', 'production'), false);
assert.equal(isPreviewLocaleImplementationEnabled('es', ''), false);
assert.equal(isPreviewLocaleImplementationEnabled('en', 'preview'), false);
assert.equal(isPreviewLocaleImplementationEnabled('fr', 'preview'), false);

assert.equal(isUnpublishedLocalePath('/es'), false);
assert.equal(isUnpublishedLocalePath('/es/'), false);
assert.equal(isUnpublishedLocalePath('/es/start-here/'), false);
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
  spanishPreviewLayout,
  spanishPreviewRoute,
  spanishHome,
  spanishStartHere,
  spanishDollarFramework,
  spanishTransmissionChain,
  spanishThreeDialDashboard,
  spanishTransmissionVisual,
  spanishThreeDialVisual,
  englishContentRoute,
  englishHome,
] = await Promise.all([
  readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/audiobook-handler.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/video-library-page.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/marketing-opt-in-handler.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/marketing-opt-in-readiness.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/weekly-newsletter-email.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/progress-email-email.js', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/layouts/SpanishPreviewLayout.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/es/[...slug].astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/pages/es/home.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/pages/es/start-here.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/frameworks/es/dollar-framework.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/frameworks/es/framework-dollar-transmission-chain.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/frameworks/es/framework-three-dial-dashboard.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/SpanishPreviewDollarTransmissionVisual.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/SpanishPreviewThreeDialVisual.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/[...slug].astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
]);

assert.match(baseLayout, /<html lang=\{locale\}>/);
assert.match(baseLayout, /requestedLocale = 'en'/);
assert.match(baseLayout, /siteShellCopyForLocale\(locale\)/);
assert.match(baseLayout, /SPANISH_PUBLIC_NAVIGATION/);
assert.match(baseLayout, /SPANISH_GROUPED_NAVIGATION\.map/);
assert.match(baseLayout, /data-site-language-choice=\{languageSwitchTarget\}/);
assert.match(baseLayout, /data-public-alternate-href=\{effectivePublicAlternate \|\| undefined\}/);
assert.match(baseLayout, /spanishPublicReviewEnabled\(process\.env\.VERCEL_ENV\)/);
assert.match(baseLayout, /previewSpanishLandingByEnglish = SPANISH_PUBLIC_REVIEW_PAIRS/);
assert.match(baseLayout, /spanishGroupedNavigation\.map/);
assert.match(baseLayout, /localStorage\.setItem\(languagePreferenceKey, requested\)/);
assert.match(baseLayout, /localStorage\.getItem\(languagePreferenceKey\)/);
assert.match(baseLayout, /approvedAlternate\?\.startsWith\('\/'\)/);
assert.match(baseLayout, /!approvedAlternate\.startsWith\('\/\/'\)/);
assert.match(baseLayout, /window\.location\.replace\(approvedAlternate\)/);
assert.match(baseLayout, /Contenido disponible en inglés/);
assert.match(baseLayout, /aria-label=\{link\.contentLocale === 'en'/);
assert.match(baseLayout, /\{link\.label\}\{link\.contentLocale === 'en' && <span lang="en" aria-hidden="true">/);
assert.match(baseLayout, /Cuenta \(disponible en inglés\)/);
assert.doesNotMatch(baseLayout, /^\s+lang=\{link\.contentLocale === 'en' \? 'en'/m);

assert.match(baseLayout, /alternateLocaleHref/);
assert.match(baseLayout, /englishLocaleUrl/);
assert.match(baseLayout, /spanishLocaleUrl/);
assert.match(baseLayout, /hreflang="en"/);
assert.match(baseLayout, /hreflang="es"/);
assert.match(baseLayout, /hreflang="x-default"/);
assert.match(baseLayout, /analyticsEnabled/);
assert.match(baseLayout, /localizationManifest\.locales\[locale\]\?\.analyticsEnabled === true/);
assert.match(baseLayout, /<ConsentClient\s+locale=\{locale\}[\s\S]*privacyHref=\{locale === 'es'/);
assert.match(baseLayout, /analyticsEnabled=\{analyticsEnabled\}/);
assert.doesNotMatch(baseLayout, /\{analyticsEnabled && \(\s*<ConsentClient/);
assert.match(baseLayout, /<button id="privacy-settings-button" class="footer-privacy-settings" type="button">Opciones de privacidad<\/button>/);
assert.match(baseLayout, /\{analyticsEnabled && <GoogleAnalyticsClient \/>\}/);
assert.match(baseLayout, /\{analyticsEnabled && <TelemetryClient \/>\}/);
assert.match(baseLayout, /\{locale === 'en' && <PwaClient \/>\}/);
assert.match(baseLayout, /locale === 'en' && <script is:inline src="\/assets\/session-entry\.js" defer><\/script>/);
assert.match(englishContentRoute, /SPANISH_ALTERNATE_BY_ENGLISH_SLUG/);
assert.match(englishContentRoute, /!entry\.data\.slug\.startsWith\('\/es'\)/);
assert.match(englishContentRoute, /'\/start-here': '\/es\/start-here\/'/);
assert.match(englishContentRoute, /'\/dollar-framework': '\/es\/dollar-framework\/'/);
assert.match(englishContentRoute, /'\/framework\/dollar-transmission-chain': '\/es\/framework\/dollar-transmission-chain\/'/);
assert.match(englishContentRoute, /'\/framework\/three-dial-dashboard': '\/es\/framework\/three-dial-dashboard\/'/);
assert.match(englishContentRoute, /alternateLocaleHref=\{spanishAlternateHref\}/);
assert.match(englishHome, /alternateLocaleHref="\/es\/"/);
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
assert.match(spanishPreviewRoute, /SPANISH_TO_ENGLISH_PATH/);

assert.match(spanishPreviewLayout, /import BaseLayout from '\.\/BaseLayout\.astro'/);
assert.match(spanishPreviewLayout, /locale="es"/);
assert.match(spanishPreviewLayout, /alternateLocaleHref=\{englishPath\}/);
assert.match(spanishPreviewLayout, /currentPath=\{currentPath\}/);
assert.match(spanishPreviewLayout, /responsiveTables/);
assert.doesNotMatch(spanishPreviewLayout, /<!doctype html>/);
assert.doesNotMatch(spanishPreviewLayout, /<header class="site-header">/);
assert.doesNotMatch(spanishPreviewLayout, /<footer class="footer">/);
assert.doesNotMatch(spanishPreviewLayout, /noindex, nofollow, noarchive/);
assert.match(baseLayout, /class="nav-toggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="site-navigation"/);
assert.match(baseLayout, /navigationToggle\?\.addEventListener\("click"/);
assert.match(baseLayout, /event\.key !== "Escape"/);
assert.match(baseLayout, /navigation\?\.querySelectorAll\("a"\)/);
assert.match(baseLayout, /responsiveTables[\s\S]*<style is:global>/);
assert.match(baseLayout, /\.page-content table \{[\s\S]*width: 100%;[\s\S]*border-collapse: collapse;/);
assert.match(baseLayout, /@media \(max-width: 760px\)[\s\S]*overflow-x: auto;/);
assert.match(baseLayout, /-webkit-overflow-scrolling: touch;/);
assert.match(baseLayout, /min-width: 9rem;/);
assert.match(baseLayout, /aria-label=\{shellCopy\.navigationLabel\}/);
assert.match(baseLayout, /hreflang=\{shellCopy\.localeSwitchLanguage\}/);
assert.match(spanishPreviewRoute, /isLocalePublicationEnabled\('es'\)/);
assert.match(spanishPreviewRoute, /entry\.data\.status === 'published'/);
assert.match(spanishPreviewRoute, /AUTHORIZED_SPANISH_PUBLIC_SLUGS/);
const allowlistMatch = spanishPreviewRoute.match(
  /const AUTHORIZED_SPANISH_PUBLIC_SLUGS = Object\.freeze\(\[([\s\S]*?)\]\);/,
);
assert.ok(allowlistMatch, 'Spanish public allowlist must be declared inside getStaticPaths');
const actualSpanishPublicSlugs = [...allowlistMatch[1].matchAll(/'([^']+)'/g)]
  .map((match) => match[1]);
assert.deepEqual(actualSpanishPublicSlugs, [
  '/es',
  '/es/start-here',
  '/es/dollar-framework',
  '/es/framework/dollar-transmission-chain',
  '/es/framework/three-dial-dashboard',
]);
assert.match(spanishPreviewRoute, /AUTHORIZED_SPANISH_PUBLIC_SLUGS\.includes\(entry\.data\.slug\)/);
assert.doesNotMatch(spanishPreviewRoute, /entry\.data\.slug\.startsWith\('\/es\/'\)/);
assert.match(spanishPreviewRoute, /aria-label="Nota de cumplimiento"/);
assert.ok(spanishPreviewRoute.includes('<strong>Nota de cumplimiento:</strong>'));
assert.doesNotMatch(spanishPreviewRoute, /ComplianceNote/);
assert.match(spanishPreviewRoute, /SpanishPreviewDollarTransmissionVisual/);
assert.match(spanishPreviewRoute, /SpanishPreviewThreeDialVisual/);
assert.match(spanishPreviewRoute, /frameworkVisual === 'transmission'/);
assert.match(spanishPreviewRoute, /frameworkVisual === 'three-dial'/);

assert.match(spanishTransmissionVisual, /Cadena de Transmisión del Dólar/);
assert.match(spanishTransmissionVisual, /class="spanish-preview-transmission-figure"/);
assert.match(spanishTransmissionVisual, /class="visual spanish-preview-transmission-visual"/);
assert.match(spanishTransmissionVisual, /\.spanish-preview-transmission-figure \{[\s\S]*margin: 2rem 0;[\s\S]*overflow: hidden;/);
assert.match(spanishTransmissionVisual, /\.spanish-preview-transmission-visual \{[\s\S]*display: block;[\s\S]*width: 100%;[\s\S]*height: auto;/);
assert.match(spanishTransmissionVisual, /POLÍTICA/);
assert.match(spanishTransmissionVisual, /TASAS/);
assert.match(spanishTransmissionVisual, /LIQUIDEZ/);
assert.match(spanishTransmissionVisual, /APETITO/);
assert.match(spanishTransmissionVisual, /ACTIVOS/);
assert.doesNotMatch(spanishTransmissionVisual, /Dollar Transmission Chain|U\.S\. RATES|LIQUIDITY|RISK APPETITE|ASSETS/);

assert.match(spanishThreeDialVisual, /Panel Macro de 3 Diales/);
assert.match(spanishThreeDialVisual, /DÓLAR AMPLIO/);
assert.match(spanishThreeDialVisual, /TASAS REALES/);
assert.match(spanishThreeDialVisual, /PRESIÓN DE FINANCIACIÓN/);
assert.doesNotMatch(spanishThreeDialVisual, /Three-Dial Macro Dashboard|USD DIRECTION|REAL RATES|LIQUIDITY STRESS/);

assert.match(spanishStartHere, /## Ejemplo práctico — el mismo dólar más fuerte puede significar cosas distintas/);
assert.doesNotMatch(spanishStartHere, /Broad Dollar Index/);
assert.doesNotMatch(spanishDollarFramework, /Broad Dollar Index/);
assert.match(spanishStartHere, /índice de dólar amplio/);
assert.match(spanishDollarFramework, /índice de dólar amplio/);
assert.doesNotMatch(spanishDollarFramework, /tasa de descuento/);
assert.match(spanishDollarFramework, /rentabilidad mínima exigida/);
assert.match(spanishStartHere, /## Confusiones frecuentes/);
assert.match(spanishDollarFramework, /## Ejemplo práctico — misma dirección del dólar, distinta causa/);
assert.match(spanishDollarFramework, /## Señales de seguimiento semanal/);
assert.match(spanishTransmissionChain, /### Por qué importa la distinción/);
assert.match(spanishTransmissionChain, /## Qué no demuestra la cadena/);
assert.match(spanishTransmissionChain, /El marco no demuestra causalidad/);
assert.match(spanishThreeDialDashboard, /## Ejemplo práctico/);
assert.match(spanishThreeDialDashboard, /## Qué representa y qué no representa el panel/);
assert.match(spanishThreeDialDashboard, /no asumas que ambas miden exactamente lo mismo/);

const extractMarkdownReferenceUrls = (content) => {
  const urls = [];
  for (const line of content.split('\n')) {
    if (!line.startsWith('- [')) continue;
    const openParen = line.lastIndexOf('(');
    const closeParen = line.lastIndexOf(')');
    assert.ok(openParen > 0 && closeParen > openParen);
    urls.push(new URL(line.slice(openParen + 1, closeParen)).href);
  }
  return new Set(urls);
};

const federalReserveH10Url = new URL('https://www.federalreserve.gov/releases/h10/current/').href;
const fredRealRateUrl = new URL('https://fred.stlouisfed.org/series/DFII10').href;
const treasuryYieldCurveUrl = new URL('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve').href;
const bisGlobalLiquidityUrl = new URL('https://data.bis.org/topics/GLI/tables-and-dashboards').href;
const cboeVixUrl = new URL('https://www.cboe.com/tradable-products/vix').href;

for (const content of [
  spanishHome,
  spanishStartHere,
  spanishDollarFramework,
  spanishTransmissionChain,
  spanishThreeDialDashboard,
]) {
  assert.ok(content.includes('## Fuentes verificadas / referencias'));
  const references = extractMarkdownReferenceUrls(content);
  assert.ok(references.has(federalReserveH10Url));
  assert.ok(references.has(fredRealRateUrl));
  assert.ok(references.has(treasuryYieldCurveUrl));
}
assert.ok(extractMarkdownReferenceUrls(spanishHome).has(bisGlobalLiquidityUrl));
assert.ok(extractMarkdownReferenceUrls(spanishStartHere).has(bisGlobalLiquidityUrl));
assert.ok(extractMarkdownReferenceUrls(spanishDollarFramework).has(bisGlobalLiquidityUrl));
assert.ok(extractMarkdownReferenceUrls(spanishTransmissionChain).has(bisGlobalLiquidityUrl));
assert.ok(extractMarkdownReferenceUrls(spanishDollarFramework).has(cboeVixUrl));
assert.ok(extractMarkdownReferenceUrls(spanishThreeDialDashboard).has(cboeVixUrl));

for (const content of [
  spanishHome,
  spanishStartHere,
  spanishDollarFramework,
  spanishTransmissionChain,
  spanishThreeDialDashboard,
]) {
  assert.match(content, /status: "published"/);
  assert.match(content, /slug: "\/es(?:\/|")/);
  assert.doesNotMatch(content, /status: "review"/);
  assert.doesNotMatch(content, /vista previa/i);
  assert.doesNotMatch(content, /\bPreview\b|\bcheckout\b|\baudiobook\b|\bemail\b|\brepricing\b/);
  assert.doesNotMatch(content, /^visual:/m);
}

console.log('localization policy and English regression boundaries: PASS');
