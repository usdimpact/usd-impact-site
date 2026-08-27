# Lemon Squeezy provider-compliant Live evidence — 2026-08-27

Status: **Code-only release-contract correction. Production and public checkout remain disabled.**

This record replaces the earlier plan to make a merchant-controlled Live purchase and refund. It does not authorize a payment, refund, database mutation, Production migration, Production secret, Production webhook, checkout activation, or either Live approval flag.

## Provider instruction and binding decision

Lemon Squeezy's written approval instructed USD Impact to use **Test Mode** for test purchases and not to use a real card. The provider's published Test Mode guidance likewise says payment testing must use test cards because real-card payment testing may be interpreted as fraudulent activity and may result in suspension.

Authoritative provider references:

- https://docs.lemonsqueezy.com/help/getting-started/test-mode
- https://docs.lemonsqueezy.com/guides/developer-guide/testing-going-live
- https://docs.lemonsqueezy.com/help/webhooks/simulate-webhook-events
- https://docs.lemonsqueezy.com/help/webhooks/signing-requests

USD Impact therefore adopts these non-negotiable rules:

1. payment and refund testing remains in Lemon Squeezy Test Mode;
2. no owner, employee, contractor, QA account or related party uses a real card to create a test sale;
3. no Live refund is manufactured merely to prove refund handling;
4. controlled-Live and Production readiness cannot require circular merchant self-purchases;
5. a real refund is processed only for a genuine buyer request or another legitimate operational reason under the published Refund Policy.

## Evidence model before public activation

`COMMERCE_CONTROLLED_LIVE_VERIFIED=true` may be considered only after one reviewed evidence packet proves all of the following without a Live transaction:

1. the complete Test Mode checkout, signed `order_created`, duplicate delivery, authoritative Order re-read, entitlement, full-refund, reconciliation, forgery, substitution and negative matrix remains green;
2. the isolated controlled-Live Preview is pinned to the reviewed commit, non-Production Vercel, canonical Development Supabase and the dedicated controlled-Live QA email;
3. read-only Live API inspection confirms the trusted Store, Product `1319591`, Launch Variant `2062957`, Standard Variant `2062958`, USD currency, fixed base subtotals and `test_mode=false` isolation without creating a checkout;
4. the Preview-specific Live webhook accepts only the approved event set and uses an environment-scoped signing secret;
5. an invalid-signature request reaches the exact Preview webhook handler and is rejected before parsing, durable receipt creation, purchase lookup or entitlement mutation;
6. exact-head readiness remains `ready_for_controlled_live_test` with `checkoutEnabled=false`, the checkout page exposes no payment action, and runtime-error review is clean;
7. the evidence packet contains no credential value, bypass value, customer data, payment instrument or private provider payload.

Read-only catalog inspection is configuration evidence, not payment authority. A provider dashboard, API response, email, browser redirect or screenshot never grants entitlement.

## Production preparation without a rehearsal transaction

Production preparation remains separately approved and ordered:

1. treat #343 as optional post-launch assurance, not a candidate-freeze or activation prerequisite; no external testing is authorized by this record;
2. back up and verify Production database recovery;
3. separately approve and apply the reviewed commerce migrations to canonical Production;
4. separately configure Production Live credentials and the minimum `order_created` / `order_refunded` webhook while `COMMERCE_MODE=disabled` and public checkout remains unavailable;
5. verify exact-deployment readiness, disclosure, signature, route-protection, rollback and observability evidence without creating a checkout or transaction;
6. set approval flags and enable public checkout only in the explicitly approved launch window after all Phase A and Phase B gates are green.

No Production purchase/refund rehearsal is required or permitted by this contract.

## First legitimate Live order

The first Live order must originate from an independent genuine buyer after approved public activation. It is monitored as real commerce, not described or treated as a test:

- verify the provider Order, trusted commercial terms, signed webhook receipt, authoritative API re-read, purchase intent and entitlement transition;
- confirm the buyer receives the provider financial receipt and USD Impact access-ready communication through the approved ownership split;
- keep the order intact unless the buyer legitimately requests a refund or another valid operational reason exists;
- if any invariant fails, immediately disable commerce, preserve evidence and follow the rollback and incident procedures.

## Rollback and evidence retention

Rollback remains configuration-first: set `COMMERCE_MODE=disabled`, remove provider activation flags as required, redeploy the reviewed code, verify readiness and checkout fail closed, and preserve audit evidence. Do not delete durable commercial records or fabricate a refund to restore a test state.

This document changes governance and regression expectations only. It performs no external action and does not itself satisfy `COMMERCE_CONTROLLED_LIVE_VERIFIED` or `COMMERCE_LIVE_APPROVED`.
