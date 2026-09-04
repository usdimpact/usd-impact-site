import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  layout,
  globalCss,
  videoCss,
  homePage,
  dynamicPage,
  audiobookPage,
  videoPage,
  signInPage,
  waitlistForm,
  bookPurchaseCta,
  bookProduct,
  packageJson,
  prepareFonts,
  iconComponent,
  legalLayout,
  aboutPage,
  accountPage,
  checkoutPage,
  compliancePage,
  contactPage,
  accessibilityPage,
] = await Promise.all([
  read('../src/layouts/BaseLayout.astro'),
  read('../src/styles/global.css'),
  read('../public/assets/video-library.css'),
  read('../src/pages/index.astro'),
  read('../src/pages/[...slug].astro'),
  read('../src/pages/audiobook/read-the-dollar-first.astro'),
  read('../src/pages/video-library/index.astro'),
  read('../src/pages/account/sign-in/index.astro'),
  read('../src/components/WaitlistForm.astro'),
  read('../src/components/BookPurchaseCTA.astro'),
  read('../src/content/products/book-read-the-dollar-first.md'),
  read('../package.json'),
  read('./prepare-font-assets.mjs'),
  read('../src/components/Icon.astro'),
  read('../src/layouts/LegalLayout.astro'),
  read('../src/pages/about.astro'),
  read('../src/pages/account/index.astro'),
  read('../src/pages/checkout/index.astro'),
  read('../src/pages/compliance.md'),
  read('../src/pages/contact.md'),
  read('../src/pages/accessibility.md'),
]);

assert.match(layout, /class="skip-link" href="#main-content"/);
assert.match(layout, /class="nav-toggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="site-navigation"/);
assert.match(layout, /<nav id="site-navigation" class="nav" aria-label="Main navigation" data-open="false">/);
for (const group of ['Learn', 'Updates', 'Library']) {
  assert.match(layout, new RegExp(`<summary[^>]*>${group}<\\/summary>`));
}
assert.match(layout, /aria-current=\{pageIsActive/);
assert.match(layout, /event\.key !== "Escape"/);
assert.match(layout, /openGroup\?\.querySelector\("summary"\)/);
assert.match(layout, /if \(summary instanceof HTMLElement\) summary\.focus\(\)/);
assert.match(layout, /if \(firstMain\.id === "main-content"\) firstMain\.tabIndex = -1/);
assert.match(layout, /aria-label="Footer navigation"/);
for (const group of ['Product', 'Learn', 'Research', 'Legal &amp; trust']) {
  assert.match(layout, new RegExp(`<p class="footer-heading">${group}<\\/p>`));
}
for (const path of ['/about/', '/contact/', '/privacy/', '/terms/', '/refund-policy/', '/accessibility/']) {
  assert.match(layout, new RegExp(`href="${path}"`));
}

assert.match(globalCss, /\.skip-link:focus\s*\{\s*transform:\s*translateY\(0\)/);
assert.match(globalCss, /\.logo img[\s\S]*height:\s*44px[\s\S]*filter:\s*brightness\(0\) invert\(1\)/);
assert.match(globalCss, /\.nav-summary:focus-visible[\s\S]*outline:\s*3px solid var\(--gold\)/);
assert.match(globalCss, /\.nav\[data-open="true"\]\s*\{\s*display:\s*flex/);
assert.match(globalCss, /\.audiobook-access-cover[\s\S]*width:\s*min\(100%, 320px\)/);
assert.match(globalCss, /\.audiobook-access-cover\s*\{\s*width:\s*min\(100%, 260px\)/);
assert.match(globalCss, /\.audiobook-public-chapters\s*\{\s*grid-template-columns:\s*1fr/);
assert.match(globalCss, /\.book-disclosure summary:focus-visible[\s\S]*outline:\s*3px solid/);
assert.match(globalCss, /\.book-offer\s*\{[\s\S]*grid-template-columns:\s*1fr/);
assert.match(globalCss, /:where\(a, button, input, select, textarea, summary\):focus-visible[\s\S]*outline:\s*3px solid currentColor/);
assert.match(globalCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition-duration:\s*\.01ms !important/);
for (const font of ['Inter Variable', 'Playfair Display Variable']) {
  assert.match(globalCss, new RegExp(`font-family: "${font}"`));
  assert.match(videoCss, new RegExp(`font-family:\\"${font}\\"`));
}
assert.match(globalCss, /--font-sans:/);
assert.match(globalCss, /--font-display:/);
assert.match(globalCss, /--space-1:\s*\.25rem/);
assert.match(globalCss, /--space-8:\s*4rem/);
assert.match(globalCss, /body\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
assert.match(globalCss, /h1, h2, h3\s*\{[^}]*font-family:\s*var\(--font-display\)/);
assert.match(videoCss, /\.vl-body\{[^}]*font-family:var\(--font-sans\)/);
assert.match(videoCss, /\.vl-hero h1,[^}]*font-family:var\(--font-display\)/);
assert.match(videoCss, /\.vl-eyebrow\{[^}]*color:#8a6518/);
assert.match(videoCss, /\.vl-collection-filter a:focus-visible\{[^}]*outline:3px solid currentColor/);
const fontCss = `${globalCss}${videoCss}`;
const fontReferences = [
  ...fontCss.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g),
  ...fontCss.matchAll(/@import\s+["']([^"']+)["']/g),
].map(([, value]) => new URL(value, 'https://usd-impact.invalid'));
const blockedFontHosts = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
for (const reference of fontReferences) {
  assert.equal(blockedFontHosts.has(reference.hostname), false);
}

const packageManifest = JSON.parse(packageJson);
assert.equal(packageManifest.dependencies['@fontsource-variable/inter'], '5.3.0');
assert.equal(packageManifest.dependencies['@fontsource-variable/playfair-display'], '5.3.0');
assert.match(packageManifest.scripts.build, /^npm run prepare:fonts && /);
assert.match(packageManifest.scripts.dev, /^npm run prepare:fonts && /);
assert.match(prepareFonts, /Font integrity mismatch/);
assert.match(prepareFonts, /inter-latin-ext-wght-normal\.woff2/);
assert.match(prepareFonts, /playfair-display-latin-ext-wght-normal\.woff2/);
assert.match(prepareFonts, /inter-OFL-1\.1\.txt/);
assert.match(prepareFonts, /playfair-display-OFL-1\.1\.txt/);

for (const [name, source] of [
  ['home', homePage],
  ['dynamic content', dynamicPage],
  ['audiobook', audiobookPage],
  ['video library', videoPage],
  ['sign-in', signInPage],
  ['about', aboutPage],
]) {
  assert.match(source, /<main id="main-content" class="main-with-hero">/, `${name} must expose the main landmark and skip target.`);
  const mainIndex = source.indexOf('<main id="main-content"');
  const h1Index = source.indexOf('<h1');
  assert.ok(mainIndex >= 0 && h1Index > mainIndex, `${name} H1 must be inside the main landmark.`);
}

assert.match(legalLayout, /<main id="main-content" class="container legal-page">/);
assert.match(accountPage, /<main id="main-content">[\s\S]*<section class="hero account-hero">[\s\S]*<h1>/);
assert.match(checkoutPage, /<main id="main-content" class="account-main">[\s\S]*<h1/);
assert.match(compliancePage, /^---\nlayout: \.\.\/layouts\/LegalLayout\.astro\n[\s\S]*description:/);
assert.match(compliancePage, /\n# Compliance & Methodology\n/);
assert.match(contactPage, /support@usd-impact\.com/);
assert.match(contactPage, /Do not email passwords, passkey details, sign-in codes/);
assert.match(accessibilityPage, /WCAG 2\.2 Level AA as the product target/);
assert.match(accessibilityPage, /not a claim of legal or complete WCAG conformance/);
assert.match(accessibilityPage, /protected book PDF has not been verified as a tagged PDF or as PDF\/UA conforming/);

assert.match(dynamicPage, /<WaitlistForm initiallyHidden \/>/);
assert.match(waitlistForm, /hidden=\{initiallyHidden\}/);
assert.match(bookPurchaseCta, /waitlist\.hidden = presentation\.available/);
assert.match(bookPurchaseCta, /No purchase control is shown without that verification/);
assert.match(bookPurchaseCta, /aria-label="Read the Dollar First Library Pass offer"/);
assert.match(bookPurchaseCta, /aria-describedby="book-purchase-message"/);
assert.match(bookPurchaseCta, /Already purchased\?[\s\S]*href="\/account\/sign-in\/\?next=\/account\/"/);
assert.match(bookPurchaseCta, /Complete English audiobook/);
assert.match(bookPurchaseCta, /51-film Video Library/);
assert.match(bookProduct, /<section class="book-disclosures" aria-labelledby="book-details-heading">/);
assert.equal(bookProduct.match(/<details class="book-disclosure">/g)?.length, 4);
for (const summary of ['How the method works', 'Who it is for — and what it is not', 'Price, checkout and delivery', 'Common questions']) {
  assert.match(bookProduct, new RegExp(`<summary>${summary}<\\/summary>`));
}

assert.match(signInPage, /EMAIL_RESEND_COOLDOWN_SECONDS = 35/);
assert.match(signInPage, /response\.status === 429/);
assert.match(signInPage, /Too many sign-in emails were requested/);
assert.match(signInPage, /<details id="email-sign-in-alternative"/);
assert.match(signInPage, /<summary>Use email instead<\/summary>/);
assert.match(signInPage, /<details id="email-code-sign-in"[\s\S]*hidden>/);
assert.match(signInPage, /<summary>Enter a code instead<\/summary>/);
assert.match(signInPage, /Continue with passkey/);

assert.match(iconComponent, /stroke-width="1\.8"/);
assert.match(iconComponent, /aria-hidden="true"/);
assert.match(layout, /USDImpact_Horizontal_Color_NoTagline_256\.png/);
assert.match(layout, /srcset="\/assets\/logo\/USDImpact_Horizontal_Color_NoTagline_256\.png 256w, \/assets\/logo\/USDImpact_Horizontal_Color_NoTagline_512\.png 512w"/);
assert.doesNotMatch(layout, /Horizontal_Color_NoTagline_2048\.png/);
assert.match(audiobookPage, /ThumbnailFocused_320x480\.png 320w/);
assert.match(audiobookPage, /ThumbnailFocused_640x960\.png 640w/);

assert.doesNotMatch(videoCss, /Georgia|Times New Roman/);

console.log('UX and accessibility source contracts passed.');
