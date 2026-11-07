import assert from 'node:assert/strict';
import fs from 'node:fs';

const account = fs.readFileSync(new URL('../api/account.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const scorePage = fs.readFileSync(new URL('../src/pages/score.astro', import.meta.url), 'utf8');
const memberHandler = fs.readFileSync(new URL('../src/lib/score-member-handler.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.doesNotMatch(account, /handleScoreEdge/);
assert.doesNotMatch(account, /['"]score-edge['"]/);
assert.doesNotMatch(account, /handleScoreHandoff/);
assert.doesNotMatch(account, /['"]score-handoff['"]/);
assert.doesNotMatch(account, /handleScoreMemberRedeem/);
assert.doesNotMatch(account, /['"]score-member-redeem['"]/);
assert.match(account, /'score-member-content': handleScoreMemberContent/);

const rewriteSources = new Set((vercel.rewrites || []).map((entry) => entry.source));
for (const retired of [
  '/api/score-edge-redeem',
  '/api/score-edge-validate',
  '/api/score-handoff',
  '/api/score-redeem',
]) {
  assert.equal(rewriteSources.has(retired), false, `retired route must stay absent: ${retired}`);
}
assert.equal(rewriteSources.has('/score/member/:path*'), true);

assert.match(memberHandler, /resolveSessionWithRefresh/);
assert.match(memberHandler, /readAccountAccessState/);
assert.doesNotMatch(memberHandler, /scoreSessionCookie|readScoreSessionCookie|redeemScoreHandoff|createScoreMembershipProviders/);

// Score freshness is editorial and fail-closed; this is not a provider publication gate.
assert.match(scorePage, /data-score-publishing-state="rights-hold"/);
assert.match(scorePage, /New weekly Score editions are paused/);
assert.match(scorePage, /<time datetime="2026-10-23">October 23, 2026<\/time>/);
assert.match(scorePage, /verified as of November 7, 2026/);
assert.match(scorePage, /Daily USD Impact and independent Macro Weekly articles are separate publications/);
assert.match(scorePage, /href="\/reports\/"/);
assert.doesNotMatch(scorePage, /View the latest score|>Live dashboard<|updated by the USD Impact data pipeline/);

assert.match(scorePage, /href="\/score\/member\/en\/"/);
assert.match(scorePage, /href="\/score\/member\/archive\/en\/"/);
assert.doesNotMatch(scorePage, /requestScoreHandoff|score-handoff-form|name="ticket"|\/api\/score-redeem/);

assert.match(pkg.scripts['validate:score-membership'], /test-score-edge-retirement\.mjs/);
assert.doesNotMatch(pkg.scripts['validate:score-membership'], /score-handoff\.test\.js|test-score-handoff-browser\.mjs|score-redemption\.test\.js/);

console.log('Cloudflare and ticket authorization retired; Vercel uses the site Supabase session for Score member content.');
