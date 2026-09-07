import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const [landing, sample, account, accessRequired, previewGate, tradingViewRunbook, apiFiles] = await Promise.all([
  readFile(new URL('../src/pages/research/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/sample/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/account/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/access-required/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/research-preview-route.js', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/research-membership-tradingview-access-runbook.md', import.meta.url), 'utf8'),
  readdir(new URL('../api/', import.meta.url)),
]);

assert.match(landing, /USD 290\/year/);
assert.match(landing, /Best Value — save USD 58/);
assert.match(landing, /USD 29\/month/);
assert.match(landing, /No free trial and no introductory discount/);
assert.match(landing, /href="\/research\/sample\/"/);
assert.match(landing, /href="\/research\/account\/"/);
assert.match(landing, /checkout is not yet open/i);
assert.match(landing, /Library Pass resources remain a separate permanent product/);
assert.doesNotMatch(landing, /research-membership-checkout/);
assert.doesNotMatch(landing, /\/api\/commerce/);

assert.match(sample, /PUBLIC_SAMPLE_DATE = '2026-08-07'/);
assert.match(sample, /PUBLIC_SAMPLE_MIN_AGE_DAYS = 30/);
assert.match(sample, /getCollection\('weeklyReports'\)/);
assert.match(sample, /complete historical Weekly Report/i);
assert.match(sample, /contains no\s+private TradingView source or invite link/i);
assert.doesNotMatch(sample, /href="\/score\//);
assert.doesNotMatch(sample, /research-membership-checkout/);
assert.doesNotMatch(sample, /\/api\/commerce/);

assert.match(account, /Research checkout is not open yet/);
assert.match(account, /No live Research Membership purchase is expected/);
assert.match(account, /https:\/\/app\.lemonsqueezy\.com\/my-orders/);
assert.match(account, /Research Membership billing is independent from Library Pass/);
assert.match(account, /Canceling prevents the next renewal/);
assert.doesNotMatch(account, /fetch\(/);
assert.doesNotMatch(account, /research-membership-checkout/);
assert.doesNotMatch(account, /\/api\/commerce/);

assert.match(accessRequired, /Research access required/);
assert.match(accessRequired, /href="\/research\/sample\/"/);
assert.match(accessRequired, /href="\/research\/account\/"/);
assert.match(accessRequired, /Library Pass remains separate and permanent/);

assert.match(previewGate, /\/research\/access-required\//);
assert.doesNotMatch(previewGate, /\/account\/access-required\//);
assert.match(previewGate, /RESEARCH_MEMBERSHIP_PRODUCT_ID/);

assert.match(tradingViewRunbook, /Grant procedure/);
assert.match(tradingViewRunbook, /Revocation procedure/);
assert.match(tradingViewRunbook, /source code.*never|never expose source code/is);
assert.match(tradingViewRunbook, /Library Pass.*never/is);

const vercelFunctionSources = apiFiles.filter((name) => name.endsWith('.js'));
assert.ok(vercelFunctionSources.length <= 12, `Vercel function-source count is ${vercelFunctionSources.length}; limit is 12.`);
assert.ok(!vercelFunctionSources.includes('research-account.js'));

console.log('Research Membership launch-surface regressions passed.');
