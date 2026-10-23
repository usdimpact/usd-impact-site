import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(
  fs.readFileSync(new URL('../../../docs/operations/hardening-rls-intentional-deny-manifest-2026-10-23.json', import.meta.url), 'utf8'),
);

const expected = [
  'public.admin_audit_entries',
  'public.commerce_reconciliations',
  'public.daily_card_dispatches',
  'public.knowledge_chunks',
  'public.marketing_consent_events',
  'public.notification_outbox',
  'public.paddle_adjustments',
  'public.paddle_duplicate_purchases',
  'public.paddle_transaction_events',
  'public.product_offers',
  'public.push_subscriptions',
  'public.subscription_offers',
  'public.webhook_receipts',
  'sed_newsletter.newsletter_consent_events',
  'sed_newsletter.newsletter_erasure_log',
  'sed_newsletter.newsletter_issue_deliveries',
  'sed_newsletter.newsletter_subscribers',
];

assert.equal(manifest.version, 1);
assert.equal(manifest.classification, 'intentional-deny');
assert.equal(manifest.invariants.production_mutation_authorized, false);
assert.equal(manifest.invariants.add_permissive_policy_to_clear_advisor, false);
assert.equal(manifest.invariants.add_browser_grant_to_clear_advisor, false);

const actual = manifest.tables.map((entry) => `${entry.schema}.${entry.table}`).sort();
assert.deepEqual(actual, [...expected].sort(), 'Intentional-deny table inventory drifted');

for (const entry of manifest.tables) {
  assert.equal(entry.rls_enabled, true, `${entry.schema}.${entry.table}: RLS baseline must remain enabled`);
  assert.equal(entry.policy_count, 0, `${entry.schema}.${entry.table}: advisor baseline expects no policies`);
  assert.deepEqual(entry.anon_table_privileges, [], `${entry.schema}.${entry.table}: anon privileges must remain empty`);
  assert.deepEqual(entry.authenticated_table_privileges, [], `${entry.schema}.${entry.table}: authenticated privileges must remain empty`);
  assert.equal(entry.browser_access_expected, false);
  assert.equal(entry.advisor_classification, 'intentional-deny');

  if (entry.schema === 'sed_newsletter') {
    assert.deepEqual(entry.schema_usage_expected, { anon: false, authenticated: false });
  }
}

console.log('RLS intentional-deny manifest contract passed.');
