// Static regression for the Library sign-in context notice (P14). Source-level only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/pages/account/sign-in/index.astro', import.meta.url), 'utf8');

// 1. Notice markup: hidden by default, static copy, one genuine public-sample link, no purchase path.
const start = page.indexOf('<aside');
const end = page.indexOf('</aside>', start);
assert.ok(start !== -1 && end !== -1, 'library notice <aside> missing');
const notice = page.slice(start, end + '</aside>'.length);
assert.match(notice, /id="library-sign-in-context"/);
assert.match(notice, /aria-labelledby="library-sign-in-context-heading"/);
assert.match(notice, /^\s*hidden\s*$/m, 'notice must be hidden by default (no-JS and unrelated visitors see nothing)');
assert.match(notice, /<h2 id="library-sign-in-context-heading">Looking for the Guided Edition or media library\?<\/h2>/);
assert.match(notice, /available only to accounts with an eligible previous\s+Library Pass purchase/);
assert.match(notice, /New Library Pass purchases are currently unavailable\./);
const links = notice.match(/<a\b[^>]*>/g) ?? [];
assert.equal(links.length, 1, 'exactly one link in the notice');
assert.match(links[0], /^<a href="\/book\/read-the-dollar-first\/preview">$/);
assert.doesNotMatch(notice, /\{|\}|<button|<form|checkout|buy now|USD\s*\d|\$\d|waitlist|subscribe|purchase link/i);
assert.doesNotMatch(notice, /every account|all accounts|automatically/i, 'must not promise access to every account');

// 2. Script: reveals only via the sanitized next path and an exact /guided-edition segment match; never renders query text.
assert.match(page, /const libraryContext = document\.getElementById\('library-sign-in-context'\);/);
assert.match(page, /new URL\(safeNextPath\(new URLSearchParams\(window\.location\.search\)\.get\('next'\)\), window\.location\.origin\)\.pathname/);
assert.match(page, /nextPathname === '\/guided-edition' \|\| nextPathname\.startsWith\('\/guided-edition\/'\)/);
assert.match(page, /libraryContext\.hidden = !fromLibrary;/);
assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|document\.write|outerHTML/);

// 3. Existing sign-in behaviour preserved: safeNextPath body unchanged, next wiring and auth controls present.
const safeStart = page.indexOf('const safeNextPath = (value) => {');
const safeEnd = page.indexOf('};', safeStart);
const safeBody = page.slice(safeStart, safeEnd + 2).replace(/\s+/g, ' ');
// Whitespace-normalized SHA256 of the unmodified safeNextPath on main 41cc61aa.
assert.equal(
  createHash('sha256').update(safeBody).digest('hex'),
  '51d0ca458f2c05f666a29fb899bd43e802086d581f8ab18d8890e99dbc69cf0f',
  'safeNextPath changed; open-redirect guard needs security review',
);
for (const text of [
  "nextInput.value = safeNextPath(requestedNext);",
  'id="passkey-sign-in-button"',
  'id="email-sign-in-alternative"',
  'id="account-next" type="hidden" value="/account/"',
  "window.location.replace(safeNextPath(verifyBody.redirect || nextInput?.value || '/account/'));",
  "window.location.replace(safeNextPath(body.redirect || nextInput?.value || '/account/'));",
  'id="sign-in-status" class="account-status" role="status" aria-live="polite"',
]) assert.ok(page.includes(text), `existing sign-in behaviour missing: ${text}`);
assert.equal((page.match(/<h1\b/g) ?? []).length, 1, 'still exactly one H1');

console.log('Account sign-in Library context regressions passed.');
