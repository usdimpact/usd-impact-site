import assert from 'node:assert/strict';
import { PUBLIC_CANONICAL_ORIGIN, canonicalUrlForRequest } from '../src/lib/canonical-url.js';

assert.equal(PUBLIC_CANONICAL_ORIGIN, 'https://www.usd-impact.com');

const cases = [
  ['root', 'https://preview.example/?utm_source=qa#fragment', 'https://www.usd-impact.com/'],
  ['trailing slash', 'https://www.usd-impact.com/learn/real-yield/', 'https://www.usd-impact.com/learn/real-yield'],
  ['query and fragment', 'https://www.usd-impact.com/learn/real-yield/?utm_source=qa#main-content', 'https://www.usd-impact.com/learn/real-yield'],
  ['apex host replacement', 'https://usd-impact.com/learn/usd/', 'https://www.usd-impact.com/learn/usd'],
  ['preview host replacement', 'https://usd-impact-site-example.vercel.app/news/2026-09-10/?x=1', 'https://www.usd-impact.com/news/2026-09-10'],
  ['encoded path preservation', 'https://preview.example/learn/%E2%82%AC%2Fgold/', 'https://www.usd-impact.com/learn/%E2%82%AC%2Fgold'],
  ['language path preservation', 'https://preview.example/es/learn/usd/?lang=es', 'https://www.usd-impact.com/es/learn/usd'],
  ['multiple trailing slashes', 'https://preview.example/research/sample///?ref=qa', 'https://www.usd-impact.com/research/sample'],
  ['double slash inside path', 'https://preview.example/learn//usd/', 'https://www.usd-impact.com/learn//usd'],
];

for (const [name, input, expected] of cases) {
  assert.equal(canonicalUrlForRequest(new URL(input)), expected, name);
}

for (const invalid of [null, undefined, '', 'https://www.usd-impact.com/', {}, { pathname: '/learn' }]) {
  assert.throws(() => canonicalUrlForRequest(invalid), TypeError);
}
assert.throws(() => canonicalUrlForRequest(new URL('data:text/plain,hello')), TypeError);

console.log(`Canonical URL policy: ${cases.length + 7} regression cases passed`);
