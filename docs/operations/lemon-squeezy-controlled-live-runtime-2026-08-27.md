# Lemon Squeezy controlled-Live and Live runtime preparation — 2026-08-27

Status: **Code-only Draft preparation. No environment activation. Production remains disabled.**

This record defines the mode-isolated runtime added after the public-facing fail-closed release from PR #374. It does not authorize a controlled Live payment, Production migration, secret, webhook, refund, public checkout, or Production configuration change.

## Safety boundary

The runtime now supports three explicitly separated provider modes while retaining `COMMERCE_MODE=disabled` as the Production baseline:

| Mode | Provider namespace | Vercel environment | Supabase project | Account access | Provider `test_mode` |
| --- | --- | --- | --- | --- | --- |
| `sandbox` | `LEMON_SQUEEZY_TEST_*` only | non-Production | canonical Development | configured sandbox QA email only | exactly `true` |
| `live-test` | `LEMON_SQUEEZY_LIVE_*` only | non-Production | canonical Development | configured controlled-Live QA email only | exactly `false` |
| `live` | `LEMON_SQUEEZY_LIVE_*` only | Production | canonical Production | verified signed-in customer | exactly `false` |

No mode falls back from one namespace to the other. The presence of any Test provider field blocks `live-test` and `live`; the presence of any Live provider field blocks `sandbox`.

## Live provider configuration contract

Live-mode configuration uses these names only:

- `LEMON_SQUEEZY_LIVE_API_KEY`;
- `LEMON_SQUEEZY_LIVE_WEBHOOK_SECRET`;
- `LEMON_SQUEEZY_LIVE_STORE_ID`;
- `LEMON_SQUEEZY_LIVE_PRODUCT_ID`;
- `LEMON_SQUEEZY_LIVE_LAUNCH_VARIANT_ID`;
- `LEMON_SQUEEZY_LIVE_STANDARD_VARIANT_ID`;
- `LEMON_SQUEEZY_LIVE_REDIRECT_URL`.

The API key and webhook secret are never committed. Their values must be supplied later through an explicitly authorized, environment-scoped secret-management step.

The code pins the reviewed public Live catalog:

- Product `1319591`;
- Launch Variant `2062957` — USD 39 fixed base subtotal;
- Standard Variant `2062958` — USD 49 fixed base subtotal.

The Store ID remains environment-managed but is checked against every authoritative Order. Product, Variant, one-item, quantity-one, USD currency, zero-discount, and base-subtotal invariants all fail closed before entitlement mutation.

## Controlled Live-test gate

`COMMERCE_MODE=live-test` is accepted only when all of the following are true:

1. `COMMERCE_PROVIDER=lemon-squeezy`;
2. `VERCEL_ENV` is not Production;
3. `COMMERCE_SANDBOX_VERIFIED=true`;
4. the complete approved buyer-disclosure bundle is present and `COMMERCE_SELLER_DISCLOSURE_APPROVED=true`;
5. every required `LEMON_SQUEEZY_LIVE_*` field is present and no `LEMON_SQUEEZY_TEST_*` field is present;
6. `COMMERCE_RECONCILIATION_ENABLED=true`;
7. `COMMERCE_CONTROLLED_LIVE_QA_EMAIL` is a valid dedicated QA account;
8. Supabase is the canonical Development project;
9. checkout and authoritative Order state both report `test_mode=false`.

The runtime rejects every other account before reserving a purchase intent or calling Lemon Squeezy. This code does not set any of these values and does not create a Live webhook or transaction.

## Production Live gate

`COMMERCE_MODE=live` remains additionally dependent on the provider-neutral release contract:

- `COMMERCE_SANDBOX_VERIFIED=true`;
- `COMMERCE_CONTROLLED_LIVE_VERIFIED=true`;
- `COMMERCE_LIVE_APPROVED=true`;
- complete approved buyer disclosures;
- `VERCEL_ENV=production`;
- canonical Production Supabase configuration;
- complete isolated `LEMON_SQUEEZY_LIVE_*` configuration;
- reconciliation explicitly enabled;
- approved USD Impact Production redirect hostname.

If any prerequisite is absent or contradictory, readiness is blocked and the commerce API returns a fail-closed response. A browser redirect, dashboard observation, receipt, email, or customer-supplied identifier never grants access.

## Webhook and reconciliation compatibility

The existing security model is preserved for Live data:

1. verify the exact raw request bytes with the mode-specific webhook secret;
2. load the trusted durable purchase intent;
3. require the expected provider mode, Store, Product, Variant, amount, currency, discount, item-count, quantity, account, and intent values;
4. create or resume the durable SHA-256 webhook receipt;
5. re-read the authoritative Order and Order Items with the same mode-specific API key;
6. mutate entitlement state only from the compatible authoritative final state;
7. reconcile paid/refunded/fraudulent/partial-refund states under the already-reviewed full-refund-only policy.

Test and Live webhook secrets cannot substitute for one another. A signed payload whose `test_mode` value does not match the configured mode is rejected before entitlement mutation.

## Negative verification matrix

Automated tests cover:

- Test credentials present in a Live mode;
- Live credentials present in sandbox mode;
- missing Live fields with Test fields available;
- wrong Live Product or Variant IDs;
- controlled Live-test in Production;
- controlled Live-test without sandbox proof or approved disclosures;
- controlled Live-test with reconciliation disabled;
- controlled Live-test against Production Supabase;
- non-QA account use in controlled Live-test;
- Production Live outside Vercel Production;
- Production Live against Development Supabase;
- unapproved Production redirect hostname;
- provider checkout/order `test_mode` mismatch;
- existing Store/Product/Variant/subtotal/discount/currency/item/quantity, replay, signature, authoritative re-read, refund, fraud, and reconciliation failures.

## Later activation sequence

The next operational stages require separate approvals and must remain ordered:

1. merge this code-only preparation only after exact-head CI and Preview verification pass;
2. keep Production `COMMERCE_MODE=disabled` and provider unset after merge;
3. authorize an isolated controlled-Live Preview configuration separately;
4. add only Preview-scoped Live credentials and the dedicated QA allowlist;
5. create a Preview-specific Live webhook only after the exact endpoint and event set are approved;
6. run one separately approved controlled Live purchase and full refund, then verify durable state and cleanup/reconciliation evidence;
7. complete the independent commerce-enabled security assessment and required retest;
8. back up and verify Production database recovery, then separately approve and apply the reviewed commerce migrations to Production;
9. separately authorize Production secrets, Production Live webhook, final configuration, exact launch window, and one Production controlled purchase/refund rehearsal;
10. enable public checkout only through a final explicit approval after all Phase A/Phase B gates are green.

## Rollback

The immediate stop procedure remains:

1. set `COMMERCE_MODE=disabled`;
2. unset `COMMERCE_PROVIDER` and all activation-evidence flags required by disabled mode;
3. redeploy the reviewed code;
4. verify `/api/commerce-readiness` reports `mode=disabled`, `provider=null`, and `checkoutEnabled=false`;
5. verify `/checkout` has no payment action;
6. preserve provider, purchase, refund, reconciliation, webhook-receipt, and entitlement audit evidence for review.

Do not delete durable transaction evidence as a rollback mechanism. Do not attempt a database rollback after real commerce without a separately reviewed data-preservation plan.

## Current disposition

This Draft is credential-independent preparation only. Production configuration, secrets, migrations, Live webhook, payments, refunds, and public checkout remain unchanged and unauthorized by this document.
