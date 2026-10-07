import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

assert.match(baseLayout, /<html lang="en">/);
assert.match(baseLayout, /alternateLocaleHref/);
assert.match(baseLayout, /hreflang="en"/);
assert.match(baseLayout, /hreflang="es"/);
assert.match(baseLayout, /hreflang="x-default"/);
assert.match(baseLayout, />Español<\/a>/);
assert.match(englishContentRoute, /SPANISH_ALTERNATE_BY_ENGLISH_SLUG/);
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

assert.match(spanishPreviewLayout, /<html lang="es">/);
assert.doesNotMatch(spanishPreviewLayout, /noindex, nofollow, noarchive/);
assert.match(
  spanishPreviewLayout,
  /class="nav-toggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="site-navigation"[\s\S]*<span>Menú<\/span>/,
);
assert.match(
  spanishPreviewLayout,
  /<nav id="site-navigation" class="nav" aria-label="Navegación principal en español" data-open="false">/,
);
assert.match(spanishPreviewLayout, /navigationToggle\?\.addEventListener\("click"/);
assert.match(spanishPreviewLayout, /event\.key !== "Escape"/);
assert.match(spanishPreviewLayout, /navigation\?\.querySelectorAll\("a"\)/);
assert.doesNotMatch(spanishPreviewLayout, /data-open="true"/);
assert.match(spanishPreviewLayout, /<style is:global>/);
assert.match(spanishPreviewLayout, /\.page-content table \{[\s\S]*width: 100%;[\s\S]*border-collapse: collapse;/);
assert.match(spanishPreviewLayout, /@media \(max-width: 760px\)[\s\S]*overflow-x: auto;/);
assert.match(spanishPreviewLayout, /-webkit-overflow-scrolling: touch;/);
assert.match(spanishPreviewLayout, /min-width: 9rem;/);
assert.doesNotMatch(spanishPreviewLayout, /revisión en Preview/);
assert.match(spanishPreviewLayout, /rel="canonical"/);
assert.match(spanishPreviewLayout, /hreflang="es"/);
assert.match(spanishPreviewLayout, /hreflang="en"/);
assert.match(spanishPreviewLayout, /hreflang="x-default"/);
assert.match(spanishPreviewLayout, />English<\/a>/);
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
assert.match(spanishThreeDialVisual, /DIRECCIÓN DEL USD/);
assert.match(spanishThreeDialVisual, /TASAS REALES/);
assert.match(spanishThreeDialVisual, /ESTRÉS DE LIQUIDEZ/);
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
