# DRAFT HOLD — Research D5 direct-share checkout and paid-without-binding recovery contract

Prepared: 2026-11-04
Owner workstream: UI-29 / Issue #1103
Document type: architecture and operator decision packet ONLY
Status: D5 share-link presence YES; authenticated checkout identity NOT proved; no D3/D4/D6/D7 authorization
Reference source: protected main bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea

## 1. Confirmed evidence, without overclaiming

The owner-supplied Lemon Squeezy Share Product screenshots, recorded in Issue #1103 comment 6635251803, show a Live Research Membership product with Monthly USD 29 and Annual USD 290 variants and a direct hosted/overlay Share checkout URL. No USD Impact checkout custom-binding parameters are visible in the standard Share URL. This is evidence that the provider creates a shareable checkout independent of a USD Impact login step in its Share interface. It is NOT a verified external incognito checkout, completed payment, webhook delivery, exploit, customer loss, or confirmed sale without access. Do not publish a full variant token or buyer information.

Lemon Squeezy documentation verifies that Share checkout URLs open a checkout, that custom data may be supplied through user-controllable checkout URL query parameters or an API checkout_data.custom object, and that such fields return as meta.custom_data in webhooks:
- https://docs.lemonsqueezy.com/help/products/sharing-products
- https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments

Provider documentation also states that failed/non-200 webhook deliveries are retried up to THREE additional times, then not automatically retried. It recommends durable local receipt/storage and indicates manual resend is possible for recent webhook deliveries:
- https://docs.lemonsqueezy.com/help/webhooks/webhook-requests
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks

Thus a non-200 response alone is NOT durable paid-event preservation. Returning 200 without a committed, independently auditable receipt is also unsafe.

## 2. Exact protected-main code boundary (not a Production exploit assertion)

- apps/web/src/lib/research-membership-first-purchase.js:211-244 builds an authenticated app-created checkout and places usd_impact_account_id, product, interval and checkout_key into checkout_data.custom.
- The same file:337-405 verifies the provider HMAC and catalog, then reads meta.custom_data and accepts the account ID plus checkout key as the proposed binding.
- The same file:438-453 attempts recurring processing, then only on RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND invokes first-purchase inspection, the binding RPC and processing again.
- supabase/migrations/20260907154500_research_membership_first_purchase_binding.sql:49-98 locks an active profile and rejects an existing current Research subscription; lines 100-133 create a pending subscription. In this function there is no lookup of an authenticated, separately persisted checkout-intent reservation or verification that the signed checkout key was issued to this account before the provider checkout.
- apps/web/src/lib/research-membership-webhook-handler.js:287-358 handles subscription/webhook processing, including known event identity but with current-main lifecycle-order limitations separately tracked under #1103.
- docs/operations/research-membership-first-genuine-subscriber-runbook.md requires verified authenticated account binding, but operational documentation does not by itself enforce it.

A provider webhook signature authenticates the provider delivery and signed event body. It does NOT independently establish that URL-supplied checkout custom_data originally came from the authenticated USD Impact account owner. Any proposed automatic binding should compare the signed provider result to a server-created checkout-intent record tied to an authenticated account, approved product/variant, limited lifetime, server-side nonce and idempotency key. It must not authorize an account from a customer email, claimed UUID, browser redirect, checkout screenshot or raw custom_data alone.

These are code-boundary and threat-model findings; no real signed-out paid transaction or authorization bypass has been demonstrated.

## 3. Minimum fail-closed decision matrix for future design

| Condition observed | Proposed decision BEFORE any entitlement write | Required durable result |
| --- | --- | --- |
| Invalid HMAC or nonmatching Live/Store/Product/Variant | Reject; no grant; do not call it a verified paid event | Minimal security telemetry under approved policy only |
| Signed valid paid provider event, no trusted account custom binding | Quarantine, no grant and no automatic local account assignment | Independently committed private signed-paid observation plus unresolved case status |
| Signed paid event with custom account ID but no server-side checkout-intent match | Treat as unbound pending investigation, not authenticated account consent | Same append-only pending-paid observation; no entitlement |
| Same provider event ID with changed signed business hash/version | Fail closed and record a semantic/version conflict | Immutable conflict observation, no silent overwrite |
| Two paid provider subscriptions compete for one active account | At most one permitted active binding; preserve BOTH provider-paid facts | Independent paid observation for loser, append-only duplicate-paid conflict, no silent discard |
| Same event replay after observation committed | No repeated entitlement action or duplicate payable event | Stable idempotent receipt outcome and recovery case |
| Observed paid event requires refund, relink or customer communication | Escalate to owner D6 and independently verified provider record | No automatic refunds, account merges, grants or emails before separate authority |

Quarantining signed paid evidence is not an access-ready decision. It can be accepted as a processed-delivery acknowledgement ONLY after an authorized private durable commit proves custody of the event and a recovery case, not merely after logging a console error.

## 4. Proposed durable intake sequence (design only, no executable migration)

1. Verify raw HMAC, exact environment, store, product, recurring variant, signed object type and provider event identity. Reject unauthenticated or contradictory input without creating paid-ledger facts.
2. Derive a versioned business fingerprint from signed authoritative fields; preserve only the minimum identifiers necessary for later provider reconciliation in an encrypted/private, access-controlled evidence system. Public GitHub/chat receives counts and one-way correlation tokens only; never raw payloads, names, emails, billing addresses or API keys.
3. Before account binding, durably commit a unique signed-paid observation keyed by provider + authoritative event/transaction identity. Paid observation storage must NOT depend on the subsequent account-binding transaction succeeding.
4. Check an independently issued server-side checkout-intent reservation: authenticated account, subscription product, expected variant, one-time key, issuance/expiry, trusted checkout reference, replay state and expected environment. URL custom_data alone is untrusted evidence.
5. When valid reservation and all atomic binding/period checks pass, transition only once under database locks and ledger version/CAS. Otherwise preserve the paid observation, mark unbound/duplicate/conflict, and do not grant, revoke or silently suppress access.
6. Return HTTP 200 for an authenticated, durably captured provider delivery when processing/recovery can continue asynchronously, even if entitlement is held. If the receipt transaction itself fails, return retryable 5xx and alert independently; Lemon Squeezy's finite retries are not a sufficient recovery ledger.
7. Reconcile signed-paid observations against provider-authoritative statuses only under separately authorized D4 read access. Retain an auditable unresolved-work queue and an owner-visible count of paid-but-unbound events. D6 must specify escalation SLA, retention and permitted refund/relink/customer contact policy.
8. Keep legacy v1/v2/v3 receipt versions and the older independent Library Pass purchase system separate; never backfill or reinterpret old webhook receipts as v3 without version-specific proof and independent permission review.

No new tables, functions, roles, jobs, APIs, invoices, purchases or alerts are installed by this document. Design must have an approved D2 private writer boundary and no PUBLIC/anon/authenticated EXECUTE exposure before any rollout.

## 5. Owner decision gates — NOT approvals

D3 (commerce/checkout containment): choose whether new self-serve Research checkout should continue, be restricted through verified merchant controls, or be separately paused. A site-only checkout flag does not itself demonstrate that a provider-hosted Share URL is disabled. Do not unpublish or mutate live variants without owner/customer-impact authorization and provider-specific proof.

D4 (provider read): approve precisely scoped read-only provider subscription/order reconciliation, if required. No key, token or broad event export requested here.

D6 (consumer recovery): approve one supervised procedure for (a) unbound paid delivery, (b) duplicate paid checkout, (c) wrong account metadata, (d) exhausted webhook retries and (e) authorized refund/relink. Define evidence thresholds, escalation owner, retention, privacy controls and customer-contact wording. Until approved: investigate and preserve; do not modify bills or membership.

D2 (database authority): independently review non-escalatable private writer/journal separation and least privilege; no Production grants/migration authorized.

D7 (receipt rollout): leave RESEARCH_WEBHOOK_RECEIPTS_ENABLED OFF until real application SQL, role, dual-session, legacy version and rollback evidence are independently accepted.

## 6. Required negative tests and release acceptance

- T13 actual application binding SQL: two paid provider subscriptions for one account under two independent PostgreSQL sessions; second payment captured, no false success, no duplicate entitlement. D1 review-only receipt prototype success is insufficient.
- T21/T22: complimentary Research and historical Library Pass entitlements/purchases are byte-identical under both arrival orders and failed binding attempts.
- D5a: signed paid event missing account metadata leaves no entitlement and leaves one durable, private pending-paid observation.
- D5b: signed paid event with customer-supplied forged account metadata but no matching server-issued checkout reservation does NOT bind or grant.
- D5c: event observation commit succeeds but binding transaction rolls back; the paid fact remains independently committed and actionable.
- D5d: observation persistence fails; a 200 must not be emitted merely to stop provider retries. Verify bounded retry/exhaustion recovery with a separately trusted queue.
- D5e: replay of the exact event returns idempotent custody outcome, while same event identity with changed signed business fields creates immutable conflict evidence.
- D5f: malicious or mismatched Live/Test/Store/Variant/HMAC events never create paid truth or entitlement.
- O1/O4: stale provider lifecycle, equal timestamp races and late payment_failed/cancellation cannot shorten legitimately renewed access.
- D2: explicit negative privileges for anon, authenticated, PUBLIC and nonowner writer; ownership, BYPASSRLS and SECURITY DEFINER/search_path test cases in isolated environment.
- Provider/checkout: one truly authenticated checkout issuance must correspond to one verifiable server-side reservation. A direct Share link without binding stays quarantined; no manufactured real purchase required.
- Acceptance requires current exact-head checks, reviewer verdict, owner D2/D3/D4/D6/D7 item approvals, Production rollout/rollback and privacy evidence. No automatic merge or deploy.

## 7. Current workstream separation and unresolved state

Research #1103 remains LIVE P1, not a confirmed customer incident. D1 real two-session review-only prototype PASS is in Draft #1115 at c0ef515be89ef15ffab617cc20e817c3da4b3918. Claude's separate B-4 synthetic-only Draft #1117 at initial 9e3dc4dc56c283e329f82339d206c3a6eca340e3 tests T13/T21/T22 in fixtures but does not change protected-main binding SQL. New A33/A34 invoice guard/lookup Draft #1111 remains independent. This D5/D6 decision packet is a separate documentation-only lane; it does not change those branches or imply they were reconciled. Verify their current HEADs before any later work.

Protected main, Production checkout, enabled membership, historical Library Pass, provider products/variants, customer data, refunds, webhook delivery, payments, F2, Score, rights/media and Daily #840 are unchanged. No release permission is granted or implied.
