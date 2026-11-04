# Research O1/O4 Stage G: provider-paid-evidence review (DRAFT / HOLD)

**Do not merge, install, deploy, or import this code into an app.** This child is stacked on Stage F #1139, which is itself review-only. All Stage G code lives in `docs/operations/research-ordering-stage-g/` plus an isolated GitHub Actions workflow. No edits to `apps/web`, `supabase/migrations`, merchant settings, live credentials, subscriptions, customers, or Library Pass are authorized.

## Purpose

The Stage F witness binds the entire intended access change and local DB version, but its verifier identity was synthetic. Stage G documents and tests the *source-evidence screening* that a future verifier must perform before even proposing a witness. It deliberately stops short of authorizing a paid entitlement:

- Verify Lemon Squeezy HMAC-SHA256 `X-Signature` over the **exact raw webhook bytes** before parsing JSON. Verify `X-Event-Name` against `meta.event_name` and only treat `subscription_payment_success` / `subscription_payment_recovered` **invoice** objects as candidates to grant or extend a paid period.
- Treat `meta.custom_data` as provider-carried, user-supplied checkout metadata, not internal account authority. An account/store/order/customer/product/variant/subscription binding must have been loaded from a durable internal checkout intent or previously accepted membership record. The Stage G test receives a synthetic `trustedBinding`, but **does not prove** that it came from the database.
- Using a separately owned provider API credential, require successful GETs of the exact invoice and subscription IDs from the fixed `https://api.lemonsqueezy.com` host, `Accept: application/vnd.api+json`, `redirect: error`, `cache: no-store`, no alternate URLs. In this test, `fetchImpl` is a **mock** and performs no network access.
- Check the invoice's current `paid` / unrefunded state, nonzero positive cents, USD currency, initial/renewal billing reason and binding to the same store/customer/subscription. Reject partial refunds, refunded invoices, invoice updates/proration and unverified zero-value grants without an independently approved policy.
- Check the subscription's current identity, order/product/variant and test mode; only `active` / `cancelled` grace-period statuses are allowed *candidates*, using `renews_at` / `ends_at` respectively. Never compute a paid period start or a new entitlement solely from an invoice GET.
- Preserve exact microsecond precision in UTC timestamps, reject a provider invoice older than the signed delivery, and reject a paid horizon shorter than the stored prior period.
- Emit a deterministic replay key plus raw-body SHA-256 to be checked by a **future durable journal**, and an immutable, redacted **candidate for further review**. ALL results explicitly have `canMutate: false`.

## Evidence limitations and counterexamples

1. **HMAC != payment settlement**. It proves the body was signed using the configured webhook secret, not that the account is uniquely bound or the invoice remains paid.
2. **Injected GET != authenticated live API call**. This offline test can verify URL/headers, JSON shape and negative behavior, but cannot establish real TLS trust, bearer-key custody, response authenticity, or provider settlement.
3. **Provider GET != atomic remote version**. The subscription can change *after* GET and *before* a local database commit. `providerSubscriptionVersion` is simply the provider's `updated_at` string; Lemon Squeezy's retrieval docs do not establish an atomic conditional mutation or snapshot token for this purpose. Stage F's local DB version fence does not solve this external race.
4. **Invoice paid != paid-cycle mapping**. The invoice and subscription documents do not, by themselves, authenticate which exact cycle start corresponds to the current `renews_at`/`ends_at`. A separate provider-authoritative period/account/settlement witness is required for final entitlement mutation.
5. **Versioned events can replay**. `eventKey + signedDeliveryHash` are suggestions for a future durable journal, not a store; a signed duplicated body is expected and must not grant access twice. A changed body on the same event key must be escalated as a conflict.
6. **Not a complete negative-state reconciler**. Failed payments, refunds, expired subscriptions and customer cancellations are quarantined for the separate O1/O4 reconciliation design. No automatic revocation from a single event.
7. **Other P1s remain**. Legacy 16-argument RPC, broad `service_role`, TRUNCATE and mixed-product account-deletion pathways remain independently blocked in Issue #1103. The Stage E/F synthetic guards must not be installed before a coordinated migration of the live Research webhook/binder.

## Local and CI tests

```bash
node --check docs/operations/research-ordering-stage-g/provider_paid_evidence_review.mjs
node --check docs/operations/research-ordering-stage-g/test_provider_paid_evidence.mjs
node docs/operations/research-ordering-stage-g/test_provider_paid_evidence.mjs
```

The offline fixture uses only synthetic bearer/HMAC strings and fake numeric IDs. It intentionally overrides `globalThis.fetch` to reject any actual network attempt. It tests 72 cases against a deliberately injected test double. The **positive outcome is only `candidate_for_external_atomic_reconciliation` with `canMutate=false`**.

## Primary source specifications (verified 2026-11-05)

- Lemon Squeezy, signing webhooks: https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- Lemon Squeezy, event types: https://docs.lemonsqueezy.com/help/webhooks/event-types
- Lemon Squeezy, subscription GET: https://docs.lemonsqueezy.com/api/subscriptions/retrieve-subscription
- Lemon Squeezy, subscription object fields: https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
- Lemon Squeezy, invoice GET: https://docs.lemonsqueezy.com/api/subscription-invoices/retrieve-subscription-invoice
- Lemon Squeezy, invoice attributes: https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object

## Release gates: all HOLD

Independent security review at exact PR head; actual provider account/merchant/checkout-intent authority; credential/TLS custody; period-start and settled-invoice mapping; remote GET-to-local-commit race policy and sustained reconciliation; Stage F full-effect binding; Stage E/D cross-role cutover; D2-B/C; real Library Pass/Paddle/deletion/TRUNCATE regression; Production/Development parity; owner-authorized Development rehearsal; main-targeted exact-head CI; final owner release authorization. Do **not** merge, migrate, provision roles, change any keys, touch merchant settings, or activate the B-5 replacement. The separately active October 28 Research checkout remains untouched.
