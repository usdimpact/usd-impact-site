import assert from 'node:assert/strict';

const EXPECTED_DEV_REF = 'ycstrcvshdluovtuasjc';
const FORBIDDEN_PROD_REF = 'gjzetjugmnwanvjkchux';

const baseUrl = String(process.env.USDIMPACT_RLS_TEST_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = String(process.env.USDIMPACT_RLS_TEST_SUPABASE_PUBLISHABLE_KEY || '');
const authenticatedBearer = String(process.env.USDIMPACT_RLS_TEST_AUTH_BEARER || '');

if (!baseUrl || !publishableKey) {
  console.log('RLS live negative-access test skipped: isolated Development credentials are not configured.');
  process.exit(0);
}

const host = new URL(baseUrl).hostname;
assert.ok(host.includes(EXPECTED_DEV_REF), 'RLS live test may run only against the pinned usd-impact-development project.');
assert.ok(!host.includes(FORBIDDEN_PROD_REF), 'RLS live test refuses the Production project.');

const targets = [
  ['public','admin_audit_entries'],
  ['public','commerce_reconciliations'],
  ['public','daily_card_dispatches'],
  ['public','knowledge_chunks'],
  ['public','marketing_consent_events'],
  ['public','notification_outbox'],
  ['public','paddle_adjustments'],
  ['public','paddle_duplicate_purchases'],
  ['public','paddle_transaction_events'],
  ['public','product_offers'],
  ['public','push_subscriptions'],
  ['public','subscription_offers'],
  ['public','webhook_receipts'],
];

const denyStatuses = new Set([401, 403, 404, 406]);

async function assertDenied({ schema, table, bearer, role }) {
  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${bearer}`,
  };
  if (schema !== 'public') headers['Accept-Profile'] = schema;

  const response = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, { headers });
  assert.ok(
    denyStatuses.has(response.status),
    `${role} unexpectedly reached ${schema}.${table}: HTTP ${response.status}`,
  );
}

for (const [schema, table] of targets) {
  await assertDenied({ schema, table, bearer: publishableKey, role: 'anon' });
}

if (authenticatedBearer) {
  for (const [schema, table] of targets) {
    await assertDenied({ schema, table, bearer: authenticatedBearer, role: 'authenticated' });
  }
} else {
  console.log('Authenticated negative-access checks skipped: no synthetic Development bearer token configured.');
}

console.log('Development-only RLS negative-access checks passed for configured roles.');
