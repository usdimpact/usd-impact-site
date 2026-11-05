import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const [landing, sample, account, accessRequired, previewGate, tradingViewRunbook, apiFiles, middleware] = await Promise.all([
  readFile(new URL('../src/pages/research/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/sample/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/account/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/access-required/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/research-preview-route.js', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/research-membership-tradingview-access-runbook.md', import.meta.url), 'utf8'),
  readdir(new URL('../api/', import.meta.url)),
  readFile(new URL('../middleware.js', import.meta.url), 'utf8'),
]);

assert.match(landing, /USD 290\/year/);
assert.match(landing, /Annual reference price/);
assert.match(landing, /USD 29\/month/);
assert.match(landing, /No free trial and no introductory discount/);
assert.match(landing, /href="\/research\/sample\/"/);
assert.match(landing, /href="\/research\/account\/"/);
assert.match(landing, /New Research Membership subscriptions are temporarily paused/);
assert.doesNotMatch(landing, /<button[^>]*research-checkout-button/);
assert.doesNotMatch(landing, /Best Value — save USD 58/);
assert.equal((landing.match(/Planned — not yet confirmed as available or included/g) || []).length, 5);
assert.match(landing, /Library Pass resources remain a separate permanent product/);
assert.match(landing, /On the roadmap:/);
assert.match(landing, /Private TradingView indicator access is planned as a future Research Membership\s+enhancement/i);
assert.match(landing, /not included at initial launch, and no availability date is promised/i);
assert.match(landing, /pricing implications will be announced separately before release/i);
assert.doesNotMatch(landing, /private invite-only TradingView indicator access/i);
assert.match(landing, /research-membership-checkout/);
assert.match(landing, /\/api\/commerce\?action=research-membership-checkout/);

assert.match(sample, /PUBLIC_SAMPLE_DATE = '2026-08-07'/);
assert.match(sample, /PUBLIC_SAMPLE_MIN_AGE_DAYS = 30/);
assert.match(sample, /getCollection\('weeklyReports'\)/);
assert.match(sample, /complete historical Weekly Report/i);
assert.match(sample, /contains no\s+private Pine source or provider access link/i);
assert.doesNotMatch(sample, /href="\/score\//);
assert.doesNotMatch(sample, /research-membership-checkout/);
assert.doesNotMatch(sample, /\/api\/commerce/);

assert.match(account, /New Research subscriptions are temporarily paused/);
assert.doesNotMatch(account, /Checkout is created only after authenticated account verification/i);
assert.ok(account.includes('href="https://app.lemonsqueezy.com/my-orders"'));
assert.match(account, /Research Membership billing is independent from Library Pass/);
assert.match(account, /Canceling prevents the next renewal/);
assert.doesNotMatch(account, /fetch\(/);
assert.doesNotMatch(account, /research-membership-checkout/);
assert.doesNotMatch(account, /\/api\/commerce/);

assert.match(accessRequired, /Research access required/);
assert.match(accessRequired, /href="\/research\/sample\/"/);
assert.match(accessRequired, /href="\/research\/account\/"/);
assert.match(accessRequired, /Library Pass remains separate and permanent/);

assert.match(sample, /Other complete historical reports are also public/);
assert.doesNotMatch(sample, /behind current member research/);
assert.match(previewGate, /\/research\/access-required\//);
assert.doesNotMatch(previewGate, /\/account\/access-required\//);
assert.match(previewGate, /RESEARCH_MEMBERSHIP_PRODUCT_ID/);

assert.match(tradingViewRunbook, /Status: deferred/);
assert.match(tradingViewRunbook, /not an initial-launch benefit or launch gate/i);
assert.match(tradingViewRunbook, /Grant procedure/);
assert.match(tradingViewRunbook, /Revocation procedure/);
assert.match(tradingViewRunbook, /Future re-entry gate/);
assert.match(tradingViewRunbook, /source code.*never|never expose source code/is);
assert.match(tradingViewRunbook, /Library Pass.*never/is);
assert.doesNotMatch(tradingViewRunbook, /Private TradingView Weekly Score access is a Research Membership benefit/);

assert.match(middleware, /'\/research-membership\/:path\*'/);
assert.match(middleware, /normalizePath\(url\.pathname\) === '\/research-membership'/);
assert.match(middleware, /url\.pathname = '\/research\/';\s*return Response\.redirect\(url, 301\);/s);

const vercelFunctionSources = apiFiles.filter((name) => name.endsWith('.js'));
assert.ok(vercelFunctionSources.length <= 12, `Vercel function-source count is ${vercelFunctionSources.length}; limit is 12.`);
assert.ok(!vercelFunctionSources.includes('research-account.js'));

// --- D1-A sales-pause regression protections (P4). Source-level only: they do not prove the
// Production checkout flag value, provider state, rights clearance or release approval. ---

// Payment controls must not reappear in any form while new sales are paused.
// Targeted (not a blanket <button> ban) so unrelated accessible controls (e.g. disclosure toggles) stay possible.
const purchaseButton = /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?\b(billing|subscribe|subscription|checkout|pay|payment|buy|purchase|join|annual|monthly)\b(?:(?!<\/button>)[\s\S])*?<\/button>/i;
assert.doesNotMatch(landing, /<button\b[^>]*research-checkout-button/, 'paused landing must not render checkout buttons');
assert.doesNotMatch(landing, purchaseButton, 'paused landing must not render any purchase-labelled button');
assert.doesNotMatch(landing, /href="[^"]*(lemonsqueezy\.com\/(checkout|buy)|\/checkout\/)/i, 'paused landing must not link to a checkout');
assert.doesNotMatch(landing, /data-billing-interval=/);
assert.doesNotMatch(landing, /Choose (annual|monthly) billing/i);
for (const [name, page] of [['landing', landing], ['account', account]]) {
  assert.doesNotMatch(page, /checkout is open/i, `${name}: open-checkout claim`);
  assert.doesNotMatch(page, /now available on monthly or annual billing/i, `${name}: availability claim`);
  assert.doesNotMatch(page, /Included at launch/i, `${name}: included-at-launch claim`);
}
assert.match(landing, /New subscriptions are paused\. This page cannot start a payment\./);

// The five planned benefits stay individually tagged as not confirmed.
const plannedScope = landing.split('<h3>Planned Research Membership scope</h3>')[1]?.split('</ul>')[0] ?? '';
const plannedItems = plannedScope.match(/<li>[\s\S]*?<\/li>/g) ?? [];
assert.equal(plannedItems.length, 5, 'exactly five planned benefits');
for (const item of plannedItems) {
  assert.match(item, /<em>Planned — not yet confirmed as available or included\.<\/em><\/li>$/);
}
assert.match(landing, /None of the following five items is currently confirmed as available or included/);

// Published amounts and disclosures are informational and unchanged.
for (const text of [
  '<h3>USD 290/year</h3>',
  '<h3>USD 29/month</h3>',
  'No free trial and no introductory discount.',
  'Applicable taxes may be added by the merchant of record',
  'Cancellation prevents the next renewal and takes effect at the end of the current paid billing period.',
  'does not add a separate blanket refund guarantee at launch.',
  'href="/terms/"',
  'href="/refund-policy/"',
]) assert.ok(landing.includes(text), `landing missing: ${text}`);
assert.doesNotMatch(landing, /USD (?!29\b|290\b)\d+/, 'no other price figures');

// The pre-existing checkout script is unchanged (inert without buttons); no automatic network call on load.
// Pinned on whitespace-normalized tokens: tolerant of reindentation/reformatting, strict on any code change.
// (Byte-exact SHA256 of the original block at bf16f25 was 4267271f0b88ddd5096417a7c14aff8bab9f6c584c346e524e1be1ce33833e35.)
const CHECKOUT_SCRIPT_NORMALIZED_SHA256 = 'b2cec3becd0ba1bcadb36caba74adabf61b63824bf568c467c59079b8e151843';
const checkoutScriptBody = landing.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
assert.equal(
  createHash('sha256').update(checkoutScriptBody.replace(/\s+/g, ' ').trim()).digest('hex'),
  CHECKOUT_SCRIPT_NORMALIZED_SHA256,
  'existing Research checkout script changed; any change needs commerce/security review and a deliberate hash update',
);
// Semantic guards that stay meaningful even if the pin is ever deliberately updated.
assert.match(checkoutScriptBody, /document\.querySelectorAll\('\.research-checkout-button'\)/);
assert.match(checkoutScriptBody, /hostname !== 'lemonsqueezy\.com' && !hostname\.endsWith\('\.lemonsqueezy\.com'\)/);
assert.match(checkoutScriptBody, /url\.protocol !== 'https:'/);
assert.equal((landing.match(/<script\b/g) ?? []).length, 1);
assert.ok(landing.indexOf('/api/commerce') > landing.indexOf("button.addEventListener('click'"), 'commerce call only inside click handler');
assert.doesNotMatch(landing, /DOMContentLoaded|window\.onload|setTimeout\(/);
for (const [name, page] of [['landing', landing], ['account', account], ['sample', sample]]) {
  const frontmatter = page.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  assert.doesNotMatch(frontmatter, /fetch\(|commerce|lemon|checkout|supabase|research-membership/i, `${name}: build-time commerce code`);
}

// Existing subscribers keep account management, cancellation and Library Pass independence.
assert.match(account, /Lemon Squeezy My Orders/);
assert.match(account, /never removes permanent Library Pass access/);
assert.doesNotMatch(account, /\/api\/commerce|<script|research-checkout-button|data-billing-interval/);
assert.doesNotMatch(account, purchaseButton, 'account page must not render any purchase-labelled button');
assert.match(landing, /never removes permanent access obtained\s+through a separate Library Pass purchase/);

// Public sample: designated date and 30-day rule unchanged.
assert.match(sample, /^const PUBLIC_SAMPLE_DATE = '2026-08-07';$/m);
assert.match(sample, /^const PUBLIC_SAMPLE_MIN_AGE_DAYS = 30;$/m);
assert.match(sample, /sampleAgeDays < PUBLIC_SAMPLE_MIN_AGE_DAYS/);

// The 16 historical public report SOURCES are byte-identical to the Draft #924 baseline (exact 40-hex git blob
// SHA-1). Provenance at #924 head 29e46037: disposition fixture blob 87f682f24fe08c43510044dfe2f37be21cf6b887
// -> baselineGitBlobSha d74c32623d8d29260afe1b29644f77faae34d244 (= baseline fixture blob); both list these 16.
// Source integrity only: not a rights receipt, and says nothing about built HTML or CDN copies.
const HISTORICAL_REPORT_BLOBS = Object.freeze({
  'weekly-reports/2026-07-31.md': 'a0408dac3a6c207bd8a68271402a3c6b5bc0ce03',
  'weekly-reports/2026-08-07.md': 'dba79c60373100983f00a8ddf165d6df8fe0881b',
  'weekly-reports/2026-08-14.md': '3edeae0459a473fcb4c47c69de73011f8f4a73ad',
  'weekly-reports/2026-08-21.md': '4ebd2fced4ed5bee1139b2d842712b68852d59b6',
  'weekly-reports/2026-08-28.md': '7a45c5c1ef1d5ade074fe0a1207e1411f80f5de7',
  'weekly-reports/2026-09-04.md': '8aa9f4cd35d7d4c21ed286b94e6a1b2c8bdeb9e5',
  'weekly-reports/2026-09-11.md': '7e726996607fc21930c905d2f299223f69b922a5',
  'weekly-reports/2026-09-18.md': '4be7f920022e12b0a0508c288d262318984bd6dc',
  'weekly-reports/2026-09-25.md': '05220e98e75b987ba41e7d1a0c1d754bcf893502',
  'weekly-reports/2026-10-02.md': 'f2877e928aad25b462db51ef9881afc77db5dd8a',
  'weekly-reports/2026-10-09.md': '3633189c3ede9b2a2ef92006bcfda7127693f193',
  'weekly-reports/2026-10-16.md': 'e0458f38d2b4394879acfcea731c20785256bfae',
  'weekly-reports/2026-10-23.md': '9bd65af82fb98e71fafd6bd98870c72be1fe2390',
  'monthly-reports/2026-08-21.md': 'dca65e8b67f054a61e6aa50336fced5f9771a442',
  'monthly-reports/2026-09-18.md': 'aa965257421244bc1e72cb89576615f365faa116',
  'monthly-reports/2026-10-16.md': '6c49bfbecfc8c40cd4dd558023d8ac566e28cb3c',
});
const reportEntries = Object.entries(HISTORICAL_REPORT_BLOBS);
assert.equal(reportEntries.length, 16);
assert.equal(new Set(reportEntries.map(([, sha]) => sha)).size, 16);
for (const [file, expected] of reportEntries) {
  assert.match(expected, /^[0-9a-f]{40}$/);
  const bytes = await readFile(new URL(`../src/content/${file}`, import.meta.url));
  const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(actual, expected, `${file} differs from the #924 baseline`);
  assert.match(bytes.toString('utf8'), /^status: "published"$/m, `${file} must remain published`);
}

// No Spanish Research route.
const spanishCatchAll = await readFile(new URL('../src/pages/es/[...slug].astro', import.meta.url), 'utf8');
assert.doesNotMatch(spanishCatchAll, /\/es\/research/);
const spanishPages = await readdir(new URL('../src/pages/es/', import.meta.url));
assert.ok(!spanishPages.includes('research') && !spanishPages.includes('research.astro'), 'no /es/research page');
assert.doesNotMatch(landing, /alternateLocaleHref/);

console.log('Research Membership launch-surface regressions passed.');
