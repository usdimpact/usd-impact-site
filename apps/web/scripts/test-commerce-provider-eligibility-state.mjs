import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const paths = {
  update: new URL('docs/operations/commerce-provider-eligibility-update-2026-08-26.md', root),
  responsibility: new URL('docs/operations/commerce-provider-responsibility-matrix.md', root),
  technical: new URL('docs/operations/commerce-provider-technical-qualification-matrix-2026-08-25.md', root),
  historical: new URL('docs/operations/commerce-provider-candidate-evidence-2026-08-21.md', root),
  lemon: new URL('docs/operations/lemon-squeezy-store-application-packet-2026-08-25.md', root),
  selected: new URL('docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md', root),
  sandbox: new URL('docs/operations/lemon-squeezy-sandbox-runtime-2026-08-26.md', root),
};

const [update, responsibility, technical, historical, lemon, selected, sandbox] = await Promise.all(
  Object.values(paths).map((path) => readFile(path, 'utf8')),
);

const rejectionCase = '#01856172';

assert.match(update, /Product eligibility: REJECTED \/ FAILED/);
assert.ok(update.includes(rejectionCase));
assert.match(update, /2026-08-25(?: at)? 22:33 UTC/);
assert.match(update, /REMOVED FROM ACTIVE PATH/);
assert.match(update, /DO NOT SEND/i);

assert.match(update, /Lemon Squeezy written approval and selection/);
assert.match(update, /2026-08-26 at 11:03 UTC/);
assert.match(update, /WRITTEN ELIGIBILITY APPROVED \/ PROVIDER SELECTED \/ MoR FINAL-STATE RECONCILIATION APPROVED/);
assert.match(update, /mor-final-state-reconciliation/);
assert.match(update, /provider=null/);
assert.match(update, /checkoutEnabled=false/);
assert.match(update, /REGISTERED_COMMERCE_ADAPTERS.*Lemon Squeezy/);
assert.match(update, /Draft PR #374/);

assert.match(responsibility, /Selected provider: \*\*Lemon Squeezy\*\*/);
assert.match(responsibility, /Lifecycle profile: \*\*`mor-final-state-reconciliation`\*\*/);
assert.match(responsibility, /Provider selection is therefore complete; \*\*activation is not\*\*/);
assert.match(responsibility, /partial_refund[\s\S]*review/i);
assert.match(responsibility, /payment\.revoked/);
assert.match(responsibility, /REGISTERED_COMMERCE_ADAPTERS.*Lemon Squeezy/);
assert.match(responsibility, /Arnab Bose[\s\S]{0,120}2026-08-27/);
assert.match(responsibility, /order_refunded[\s\S]{0,180}settle or prevent a chargeback/i);
assert.match(responsibility, /\$15 dispute fee/i);
assert.match(responsibility, /email, dashboard and payout reports/i);

assert.match(technical, /Lemon Squeezy: WRITTEN ELIGIBILITY APPROVED \/ SELECTED FOR ONE-TIME LIBRARY PASS/);
assert.match(technical, /NOT REQUIRED UNDER APPROVED MoR PROFILE/);
assert.match(technical, /Provider selection does not register an adapter/);
assert.match(technical, /Test Mode only/);
assert.match(technical, /No Production secret, public checkout, Live transaction, real-card test, or Production migration is authorized/);

assert.match(historical, /Historical snapshot — superseded for current provider status/);
assert.match(historical, /later written rejection/);
assert.match(historical, /current state is rejected\/closed/);

assert.match(lemon, /Current status — approved and selected 2026-08-26/);
assert.match(lemon, /affirmative written product\/company eligibility approval/i);
assert.match(lemon, /Tanay Khemka[\s\S]*2026-08-26 11:03 UTC/);
assert.match(lemon, /Test Mode/);
assert.match(lemon, /must \*\*not\*\* use a real card/);
assert.match(lemon, /Explicitly outside the current provider scope/);
assert.match(lemon, /Research Membership/);
assert.match(lemon, /APPROVED \/ SELECTED FOR ONE-TIME LIBRARY PASS \/ SANDBOX IMPLEMENTATION DRAFT \/ NOT LIVE/);

assert.match(selected, /\*\*Selected provider: Lemon Squeezy\.\*\*/);
assert.match(selected, /mor-final-state-reconciliation/);
assert.match(selected, /full refunds only/i);
assert.match(selected, /REGISTERED_COMMERCE_ADAPTERS.*Lemon Squeezy/);
assert.match(selected, /Arnab Bose[\s\S]{0,120}confirmed in writing/);
assert.match(selected, /order_refunded[\s\S]{0,180}settle or prevent a chargeback/i);
assert.match(selected, /operational\/accounting inputs/i);

assert.match(sandbox, /Status: \*\*Development\/Test proof complete\. Adapter registered in code only\. No Production activation\.\*\*/);
assert.match(sandbox, /VERCEL_ENV=production.*rejected/i);
assert.match(sandbox, /full refunds only/i);
assert.match(sandbox, /migration.*applied to canonical Development only.*not been applied to Production/i);

for (const text of [update, responsibility, technical, lemon, selected, sandbox]) {
  assert.doesNotMatch(text, /Lemon Squeezy[^\n]{0,140}(?:application under review|pending written eligibility|not yet selected)/i);
  assert.doesNotMatch(text, /FastSpring[^\n]{0,140}(?:awaiting written eligibility|awaiting response|pending Sales)/i);
}

console.log('Commerce provider eligibility-state contract passed.');
