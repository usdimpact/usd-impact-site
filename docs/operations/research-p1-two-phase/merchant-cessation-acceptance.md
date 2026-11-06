# Research P1 — Lemon Squeezy merchant-cessation acceptance packet

**Status:** DRAFT REVIEW PROCEDURE; NO live merchant evidence; NO customer operation; NO billing cancellation authority.  
**Canonical:** PR #1164 / Issue #1103 / approved conservative interim owner policy in [Issue comment 6663787630](https://github.com/usdimpact/usd-impact-site/issues/1103#issuecomment-6663787630).  
**Who:** accountable owner, independently checked for release. An auditor must inspect an *authenticated* Lemon Squeezy dashboard or read-only merchant API response; app-local rows and signed webhook history are insufficient by themselves.

## 1. Financial identity and coverage

1. Start from one *verified* USD Impact account and canonical Research product; resolve all signed provider subscription IDs, checkout keys, checkout IDs, customer IDs, store/product/variant IDs, order IDs, and any previously refused paid binding. Store PII only in the controlled merchant/support system, **never GitHub, CI, or public trackers**.
2. From the authoritative Lemon Squeezy store, enumerate **all pages** of [subscriptions](https://docs.lemonsqueezy.com/api/subscriptions/list-all-subscriptions). Use supported `filter[store_id]`, `filter[order_id]`, `filter[product_id]`, `filter[variant_id]`, and `filter[user_email]` as complementary queries. An email-only search is not proof that no matching subscription exists. Follow JSON:API `links.next` or `meta.page.lastPage`, and cross-check candidate IDs against canonical purchase/checkout identity. Explicitly record the scope, total pages, count, and time of each enumeration.
3. Read every related `GET /v1/subscriptions/:id` and [subscription invoice list](https://docs.lemonsqueezy.com/api/subscription-invoices/list-all-subscription-invoices), including all pages and any `filter[subscription_id]` and `filter[store_id]` required to reconcile historical/ongoing financial activity. Check orders/refunds/disputes and late or pending invoices. Missing provider data, unmatched subscription/order/customer IDs, unexpected counts or failed API requests always mean **HOLD**.
4. Read each issued `GET /v1/checkouts/:id` and all pages of [store checkouts](https://docs.lemonsqueezy.com/api/checkouts/list-all-checkouts) when necessary to detect unrelated/unmatched checkout IDs. A checkout `expires_at=null` is perpetual, and an expired URL does **not** establish that a charge already in progress settled or that a delayed signed event was received. A local `hold_until` is never merchant cessation evidence.
5. Check local custody after the authoritative snapshot: issued/attached/refused checkout attempts, subscription/entitlement state, signed paid-binding quarantine (including **all distinct observed claimed account IDs and checkout keys** for each provider subscription), all subscription/invoice effects, and timestamps. Contradictory signed claims require investigating BOTH claimed identities and checkout owners. New signed redelivery reopens an earlier resolved quarantine and invalidates its old clearance; any later financial mutation requires a new provider observation.

## 2. Subscription state is NOT proof of cessation

| Observed merchant state | Billing-risk decision | Required evidence before deletion |
| --- | --- | --- |
| `on_trial`, `active`, `paused` | **HOLD** | Independent stop/renewal/checkout-path confirmation; pause is reversible |
| `past_due` | **HOLD** | Pending retry and invoice reconciliation; provider may retry four times over two weeks |
| `unpaid` | **HOLD** | Inspect optional dunning/retries; nonpayment is not terminal cancellation |
| `cancelled` / cancel scheduled | **HOLD pending verification** | Future collection cancellation is not final expiry; paid grace period and resume path can remain |
| `expired` | **REVIEW**, not automatic CLEAR | Ensure this is the correct product/customer, no other subscriptions, no unsettled invoices, checkout or delayed paid events |
| Missing or malformed status, API outage | **HOLD** | Requery authoritative provider or escalate to provider support |

Sources: [subscription states](https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object), [management/grace](https://docs.lemonsqueezy.com/guides/developer-guide/managing-subscriptions), [checkout expiry](https://docs.lemonsqueezy.com/api/checkouts/the-checkout-object), [paginated API](https://docs.lemonsqueezy.com/api/getting-started/requests).

## 3. Acceptable minimal custody receipt (internal only)

For each account review, record all of: an opaque case ID; canonical USD Impact account reference kept only in restricted case storage; provider store and Research product scope; number of subscriptions, checkouts, orders, invoices and pages checked; all matching provider IDs in protected storage; verification **UTC observed_at**; authenticated source (provider API / dashboard / provider support) and reference; reviewer's owner identity; explicitly checked resumption, renewals, retries, chargebacks and pending settlement; most recent local signed event observed_at / updated_at; outcome and the next check/escalation deadline.

Do not copy API tokens, provider-signed customer portal links, personal addresses, names, full merchant JSON payloads or payment details to GitHub, PRs, CI logs or broadly shared trackers. The existing owner-only `record_research_billing_clearance` accepts an opaque reference and verification timestamp; that row certifies the owner's attestation, **not** that the database independently contacted Lemon Squeezy. Ensure the provider snapshot is later than every relevant local financial mutation; revalidate after new signed evidence.

## 4. Decision and recovery paths

* **CLEAR FOR PROPOSED PHASE A (technical candidate only):** all provider pages and related objects reconciled, owner verifies no remaining charge/retry/resumption pathways, historical/pending amounts and disputes are resolved or explicitly lawfully retained, all checkout exposure closed, no unresolved signed payment quarantine, matching account binding and fresh provider observation; then separately pass SQL billing/readiness and security gates. This is **not** Production release approval.
* **HOLD_MERCHANT_UNVERIFIED:** missing provider proof, 401/403/429/5xx, pagination gap, missing checkout/provider object, mismatched identities, cancellation grace/resume, unknown retries, pending invoice, perpetually open checkout. No Auth deletion, account finalization, completion email or unapproved refund/cancel API call.
* **HOLD_LATE_PAID:** any paid event after clearance or after DB Phase A. Preserve signed financial evidence, require owner financial reconciliation and customer remediation assessment; no automatic regrant of deleted benefits or false privacy completion.
* **ESCALATE_PRIVACY:** record the deletion request, protect access according to existing policy, notify accountable privacy/support owner, and set a legally reviewed maximum SLA and customer communication plan. Never use an indefinite silent hold as an assumed privacy-law exemption.
* **RETRY:** verification may retry under explicit bounded support queue controls; only independently authenticated evidence can clear. Deduplicate by account + provider subscription/checkout + signed event; never silently discard conflicting IDs.

## 5. Open release gates

1. **No authenticated USD Impact Lemon Squeezy merchant readback exists in this packet.** No confirmed provider session or scoped API response supports account-specific financial cessation claims. Do not substitute browser-profile names, checkout expiry or local subscription rows for merchant evidence.
2. Owner must approve the **maximum privacy hold/deadline**, permitted merchant cessation evidence, customer notice, refund/chargeback handling, and post-deletion payment incident procedure.
3. Independent reviewer must reproduce cross-service, legacy RPC and shared email outbox tests at the final PR SHA. Site runtime cutover, Development/Production migration compatibility and owner-specific deployment/rollback GO remain separate.

**No Production or Development SQL, Auth Admin, merchant subscription API or customer actions are authorized by this document.**
