import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const paths = {
  update: new URL('docs/operations/commerce-provider-eligibility-update-2026-08-26.md', root),
  responsibility: new URL('docs/operations/commerce-provider-responsibility-matrix.md', root),
  technical: new URL('docs/operations/commerce-provider-technical-qualification-matrix-2026-08-25.md', root),
  historical: new URL('docs/operations/commerce-provider-candidate-evidence-2026-08-21.md', root),
  lemon: new URL('docs/operations/lemon-squeezy-store-application-packet-2026-08-25.md', root),
};

const [update, responsibility, technical, historical, lemon] = await Promise.all(
  Object.values(paths).map((path) => readFile(path, 'utf8')),
);

const rejectionCase = '#01856172';

assert.match(update, /Product eligibility: REJECTED \/ FAILED/);
assert.ok(update.includes(rejectionCase));
assert.match(update, /2026-08-25(?: at)? 22:33 UTC/);
assert.match(update, /REMOVED FROM ACTIVE PATH/);
assert.match(update, /do not send/i);
assert.match(update, /PENDING WRITTEN ELIGIBILITY \/ NOT SELECTED/);
assert.match(update, /PayPro Global[\s\S]*no PayPro Global reply/i);
assert.match(update, /provider=null/);
assert.match(update, /checkoutEnabled=false/);

assert.match(responsibility, /FastSpring is removed from the active release path/);
assert.match(responsibility, /written product-eligibility rejection/);
assert.match(responsibility, /FastSpring public technical evidence prefill — historical evidence only/);
assert.match(responsibility, /FastSpring closed-path record/);
assert.doesNotMatch(responsibility, /FastSpring is the current primary Merchant-of-Record candidate/);
assert.doesNotMatch(responsibility, /written Sales pre-clearance is pending/);

assert.match(technical, /FastSpring has failed the written product-eligibility gate/);
assert.match(technical, /REJECTED \/ INELIGIBLE/);
assert.match(technical, /REMOVED FROM ACTIVE PATH \/ NOT SELECTED/);
assert.match(technical, /FASTSPRING REMOVED; NO TECHNICAL WINNER; NO PROVIDER SELECTED/);
assert.doesNotMatch(technical, /FastSpring has the best current authenticity \+ broad-event balance/);
assert.doesNotMatch(technical, /FastSpring.*still lacks required lifecycle closure and written eligibility/);

assert.match(historical, /Historical snapshot — superseded for current provider status/);
assert.match(historical, /later written rejection/);
assert.match(historical, /current state is rejected\/closed/);

assert.match(lemon, /Current status — updated 2026-08-26/);
assert.match(lemon, /store provisioning is not approval/i);
assert.match(lemon, /FastSpring is no longer a competing primary candidate/);
assert.match(lemon, /REJECTED \/ removed from active path/);
assert.match(lemon, /Lemon Squeezy.*application under review[\s\S]*no written product\/company approval yet/i);
assert.doesNotMatch(lemon, /FastSpring:\*\* primary candidate/);

for (const text of [update, responsibility, technical, lemon]) {
  assert.doesNotMatch(text, /FastSpring[^\n]{0,120}(?:awaiting written eligibility|awaiting response|pending Sales)/i);
}

console.log('Commerce provider eligibility-state contract passed.');
