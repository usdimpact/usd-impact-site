import assert from 'node:assert/strict';
import fs from 'node:fs';

const account = fs.readFileSync(new URL('../api/account.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.doesNotMatch(account, /handleScoreEdge(?:Redeem|Validate)/);
assert.doesNotMatch(account, /score-edge-(?:redeem|validate)/);
assert.match(account, /'score-handoff': handleScoreHandoff/);

const rewriteSources = new Set((vercel.rewrites || []).map((entry) => entry.source));
assert.equal(rewriteSources.has('/api/score-edge-redeem'), false);
assert.equal(rewriteSources.has('/api/score-edge-validate'), false);
assert.equal(rewriteSources.has('/api/score-handoff'), true);

for (const path of [
  '../src/lib/score-edge-redeem-handler.js',
  '../src/lib/score-edge-validate-handler.js',
  './score-edge-private.test.js',
]) {
  assert.equal(fs.existsSync(new URL(path, import.meta.url)), false, `retired file must stay absent: ${path}`);
}

assert.match(pkg.scripts['validate:score-membership'], /test-score-edge-retirement\.mjs/);
assert.doesNotMatch(pkg.scripts['validate:score-membership'], /score-edge-private\.test\.js/);

console.log('Score Vercel edge retirement contract passed; ticket issuance remains routed.');
