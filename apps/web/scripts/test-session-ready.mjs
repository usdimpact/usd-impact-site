import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const accountRouter = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
const passkeyHandler = await readFile(new URL('../src/lib/passkey-handler.js', import.meta.url), 'utf8');
const supabaseAuth = await readFile(new URL('../src/lib/supabase-auth.js', import.meta.url), 'utf8');
const sessionReadyPage = await readFile(
  new URL('../src/pages/auth/session-ready/index.astro', import.meta.url),
  'utf8',
);

assert.match(accountRouter, /sessionReadyLocation\(next\)/);
assert.match(accountRouter, /sessionReadyLocation,/);
assert.doesNotMatch(accountRouter, /return redirect\(response, next\);/);
assert.match(passkeyHandler, /redirect: sessionReadyLocation\(payload\.next\)/);
assert.match(supabaseAuth, /new URL\('\/auth\/session-ready\/'/);

assert.match(sessionReadyPage, /new URLSearchParams\(window\.location\.search\)/);
assert.match(sessionReadyPage, /window\.history\.replaceState\(null, '', '\/auth\/session-ready\/'\)/);
assert.match(sessionReadyPage, /fetch\('\/api\/account-access'/);
assert.match(sessionReadyPage, /credentials: 'same-origin'/);
assert.match(sessionReadyPage, /if \(response\.ok\)/);
assert.match(sessionReadyPage, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
assert.match(sessionReadyPage, /window\.location\.replace\(destination\)/);
assert.match(sessionReadyPage, /window\.location\.replace\(`\$\{signIn\.pathname\}\$\{signIn\.search\}`\)/);
assert.match(sessionReadyPage, /parsed\.origin !== window\.location\.origin/);
assert.match(sessionReadyPage, /candidate\.startsWith\('\/\/'\)/);
assert.doesNotMatch(sessionReadyPage, /Astro\.url\.searchParams/);

console.log('Session-ready redirect bridge tests passed.');
