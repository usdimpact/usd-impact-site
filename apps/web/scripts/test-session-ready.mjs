import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const accountRouter = await readFile(new URL('../api/account.js', import.meta.url), 'utf8');
const sessionReadyPage = await readFile(
  new URL('../src/pages/auth/session-ready/index.astro', import.meta.url),
  'utf8',
);

assert.match(accountRouter, /sessionReadyLocation\(next\)/);
assert.match(accountRouter, /new URL\('\/auth\/session-ready\/'/);
assert.doesNotMatch(accountRouter, /return redirect\(response, next\);/);

assert.match(sessionReadyPage, /new URLSearchParams\(window\.location\.search\)/);
assert.match(sessionReadyPage, /window\.history\.replaceState\(null, '', '\/auth\/session-ready\/'\)/);
assert.match(sessionReadyPage, /window\.location\.replace\(destination\)/);
assert.match(sessionReadyPage, /parsed\.origin !== window\.location\.origin/);
assert.match(sessionReadyPage, /candidate\.startsWith\('\/\/'\)/);
assert.doesNotMatch(sessionReadyPage, /Astro\.url\.searchParams/);

console.log('Session-ready redirect bridge tests passed.');
