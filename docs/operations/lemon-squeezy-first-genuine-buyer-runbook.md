# Lemon Squeezy first genuine buyer verification runbook

Status: **Draft operational runbook — read-only verification by default**  
Prepared: **2026-09-02**  
Product: **Read the Dollar First Library Pass**  
Provider: **Lemon Squeezy (`lemon-squeezy`)**  
Product ID: `read-the-dollar-first-guided-interactive-edition`

## 1. Purpose

This runbook defines the bounded verification sequence for the first independent genuine buyer of the one-time Read the Dollar First Library Pass after approved Production activation.

The first Live order is real commerce, not a test fixture. It must not be created by the owner, an employee, contractor, QA account, related party, or any person acting merely to manufacture launch evidence. Payment and refund testing remains in Lemon Squeezy Test Mode.

Verification must remain read-only unless a separately approved incident action is required. Never create, edit, delete, transfer, backfill, replay, or repair a customer, checkout, purchase intent, provider receipt, purchase, reconciliation, entitlement, entitlement event, refund, email, or account record merely to make the evidence pass.

The order must remain intact unless the buyer legitimately requests a refund or another valid operational reason exists.

## 2. Governing contracts

Use this runbook together with:

- `docs/operations/lemon-squeezy-selected-provider-contract-2026-08-26.md`;
- `docs/operations/lemon-squeezy-provider-compliant-live-evidence-2026-08-27.md`;
- `docs/operations/commerce-provider-responsibility-matrix.md`;
- `docs/operations/commerce-provider-readiness.md`;
- the deployed Lemon Squeezy runtime, commerce migration, paid-access, private-book, private-audiobook, and protected-video contracts.

This runbook does not replace those contracts and does not authorize a weaker interpretation.

Prepared-against Git baseline: `8136c566d888abcfef7e37eb230991d1e6eb47fd`.

Before using the runbook, record the current signed `main` commit and matching READY Production deployment. If the commerce runtime, provider mapping, product offer, protected-delivery implementation, or database contract has changed since this baseline, stop and revalidate this runbook against the current code before claiming a PASS.

## 3. Non-negotiable boundaries

1. Do not initiate a checkout or payment for verification.
2. Do not use a real card for testing.
3. Do not manufacture a Live refund, dispute, chargeback, fraudulent state, or reversal.
4. Do not manually invoke `/api/commerce-reconciliation` merely to accelerate evidence.
5. Do not retrieve, expose, rotate, or copy API keys, webhook signing secrets, database secret keys, scheduler secrets, access tokens, signed asset URLs, or customer session credentials.
6. Do not impersonate the buyer or request the buyer's password, passkey, one-time sign-in link, or browser session.
7. Do not patch Production tables or Auth records directly.
8. Do not send, resend, or fabricate a financial receipt or access-ready email.
9. Do not publish buyer personal data or full provider identifiers in GitHub, chat, logs, screenshots, or public documents.
10. Do not change Candidate 2, its governed object path, private bucket, signed-URL lifetime, accessibility statement, public-sharing state, ISBN/barcode state, or print-publication state.

The allowed activity is evidence collection from already-existing records and normal provider/application behavior, using read-only provider inspection, read-only database queries, Production route checks, and runtime-log review.

## 4. Definition of an eligible first order

Treat an order as the first genuine buyer candidate only when all of the following are true:

- it appeared after approved public Live activation;
- it was not created by the owner, staff, contractor, QA account, related party, or a person reimbursed or instructed to create evidence;
- the provider environment is Live and the authoritative Order reports `test_mode=false`;
- the Order belongs to the configured USD Impact Lemon Squeezy Store;
- the Order contains exactly one authoritative Order Item and quantity exactly `1`;
- the authoritative Product and Variant match the server-trusted Library Pass mapping selected from the durable purchase intent;
- the currency is `USD`;
- the authoritative Order subtotal equals the trusted `purchase_intents.amount_cents` value;
- `discount_total` is zero;
- tax and the provider total are retained as Merchant-of-Record evidence and are not confused with the server-authoritative pre-tax product subtotal;
- the provider status is `paid` before entitlement creation;
- the provider custom metadata contains the opaque USD Impact account and purchase-intent identifiers expected by the runtime;
- those identifiers match one existing trusted account and purchase intent;
- a browser redirect, receipt, email, screenshot, dashboard state, or client-supplied identifier is not used as entitlement authority.

Current expected public offer: the separately approved one-time USD 39 launch tier. If a separately approved transition to the standard tier occurs before the first order, use the durable purchase intent and deployed mapping as the authority and update this runbook before treating a different amount or Variant as expected.

## 5. Evidence workspace and privacy rules

Keep the full provider Order, full webhook payload, buyer identity, and complete provider identifiers inside the authenticated provider and private operational systems only.

For a public GitHub evidence comment, record only:

- verification timestamp in UTC;
- signed `main` commit and Production deployment ID;
- provider name and Live/Test determination;
- event type and final status;
- expected-versus-observed record counts;
- redacted identifier suffixes or one-way SHA-256 digests generated for the evidence packet;
- route-level PASS/HOLD results without customer session material;
- runtime request IDs only where they contain no customer data;
- the final PASS, HOLD, or INCIDENT disposition.

Never publish:

- buyer name, email, postal address, IP address, phone number, tax identifier, or payment details;
- full customer, checkout, order, transaction, event, purchase-intent, account, purchase, entitlement, or signed-URL identifiers;
- raw webhook bodies, provider API responses, request headers, cookies, authorization headers, or session tokens;
- invoice or receipt files containing customer details;
- private Supabase object URLs or signed Cloudflare Stream tokens.

A public evidence statement must say that identifiers were verified privately and redacted; it must not imply that absence of public identifiers means they were not checked.

## 6. Phase A — detect without mutating

When the buyer watch first reports a possible event:

1. Record the detection time and the current Production commit/deployment.
2. Confirm there is no concurrent incident, rollback, provider outage, or newer Production deployment under investigation.
3. Use the authenticated Lemon Squeezy dashboard or existing read-only API path to identify the candidate Order. Do not change the Order.
4. Confirm the Order is Live, paid, and within the approved product scope.
5. Record the provider event ID, Order/transaction ID, customer ID, Product/Variant, item count, quantity, subtotal, discount total, tax, total, currency, event time, and custom metadata privately.
6. Create redacted suffixes or one-way digests for any public evidence. Do not paste full values into a public issue.
7. If the candidate is Test Mode, owner-controlled, related-party, unsupported, or outside the approved product scope, classify it as **not qualifying** and stop. Do not alter it to make it qualify.

## 7. Phase B — signed webhook and authoritative provider re-read

Verify the normal application path in this order:

1. The provider request reached the deployed webhook route as `order_created`.
2. The exact raw request body was authenticated by `verifyLemonSqueezyWebhookSignature` before JSON parsing or any durable record mutation.
3. The event environment, provider identity, event type, and opaque account/purchase-intent metadata passed validation.
4. `begin_commerce_webhook_receipt` created or reused one durable receipt for the exact provider event ID and payload SHA-256.
5. A duplicate delivery with the same provider event ID and same payload hash did not create a second receipt or second commercial transition.
6. A same-ID replay with a different payload hash would fail closed.
7. `retrieveAuthoritativeLemonSqueezyOrder` re-read the authoritative Order and Order Items from Lemon Squeezy.
8. The re-read result, not the webhook payload alone, established the paid state and the trusted commercial invariants.
9. `complete_commerce_purchase` completed the trusted purchase, activated the Library Pass entitlement, recorded the canonical entitlement event, and established one reconciliation tracking row.
10. `finish_commerce_webhook_receipt` recorded the receipt as processed only after successful processing.

Do not claim a signed-webhook PASS from an email, dashboard screenshot, redirect, or receipt. Do not claim a provider re-read PASS unless the deployed runtime completed the authoritative Order and Order Items retrieval for the same private transaction.

## 8. Expected first-order cardinality

For the one private purchase-intent ID, provider transaction ID, account ID, and product ID, the expected steady state after successful `order_created` processing is:

| Record or invariant | Expected result |
|---|---|
| `purchase_intents` | Exactly **1** trusted row for the private purchase-intent ID |
| Purchase-intent status | `completed` |
| `webhook_receipts` for the first `order_created` provider event ID | Exactly **1** durable row |
| Webhook-receipt status | `processed` |
| `purchases` for provider + provider transaction ID | Exactly **1** row |
| Purchase status | `completed` |
| Purchase account, product, purchase-intent, Variant, subtotal and currency | Exact match to the trusted intent and authoritative provider re-read |
| `entitlements` for account + Library Pass product | Exactly **1** row |
| Entitlement state | `active` |
| Entitlement purchase link | Exact match to the one completed purchase |
| Entitlement end | `ends_at` is null; the purchased edition does not expire merely with time |
| Canonical `entitlement_events` payment-completed key | Exactly **1** row for `commerce:lemon-squeezy:<private-transaction-id>:payment.completed` |
| `commerce_reconciliations` for provider + transaction | Exactly **1** row |
| Initial reconciliation status | `provider_status='paid'`, `disposition='tracking'` |
| Duplicate purchase rows | **0** |
| Duplicate active entitlement rows | **0** |
| Duplicate payment-completed entitlement events | **0** |
| Foreign account or product links | **0** |

The permanent Library Pass is a one-time purchased-edition entitlement, not a subscription. It remains independent from any present or future Research Membership. A later Research Membership cancellation must not remove an independently purchased Library Pass.

Do not require a specific entitlement version number for a genuine buyer. Require the correct single row, correct state, correct purchase link, and an auditable version increment only when a legitimate transition occurs.

## 9. Read-only database verification

Run the database inspection through the authenticated Production database tool with read-only `SELECT` statements only. Keep full identifiers private.

Minimum private checks:

```sql
select id, account_id, product_id, status, price_tier, amount_cents, currency,
       provider_checkout_id, created_at, updated_at
from public.purchase_intents
where id = '<private-purchase-intent-uuid>';

select id, account_id, purchase_intent_id, product_id, provider,
       provider_transaction_id, provider_price_id, provider_event_id,
       status, subtotal_cents, tax_cents, total_cents, currency,
       price_tier, completed_at, refunded_at
from public.purchases
where provider = 'lemon-squeezy'
  and provider_transaction_id = '<private-provider-transaction-id>';

select id, provider, provider_event_id, event_type, status,
       payload_sha256, attempt_count, processed_at, last_error
from public.webhook_receipts
where provider = 'lemon-squeezy'
  and provider_event_id = '<private-provider-event-id>';

select id, account_id, purchase_id, product_id, state,
       starts_at, ends_at, version, updated_at
from public.entitlements
where account_id = '<private-account-uuid>'
  and product_id = 'read-the-dollar-first-guided-interactive-edition';

select id, event_key, entitlement_id, account_id, product_id,
       from_state, to_state, reason, actor_type, provider_event_id, occurred_at
from public.entitlement_events
where event_key = 'commerce:lemon-squeezy:<private-provider-transaction-id>:payment.completed';

select id, provider, provider_transaction_id, purchase_id,
       purchase_intent_id, account_id, product_id, provider_price_id,
       price_tier, expected_subtotal_cents, currency, provider_status,
       disposition, attempt_count, last_checked_at, next_reconcile_at,
       last_error_code, last_evidence_id, updated_at
from public.commerce_reconciliations
where provider = 'lemon-squeezy'
  and provider_transaction_id = '<private-provider-transaction-id>';
```

Then run private count checks scoped to the same identifiers and confirm the expected cardinality table above. Do not copy the full query results into a public issue. Do not run `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `CALL`, DDL, RPC mutation, or Auth-admin operations.

## 10. Phase C — protected Library Pass access

### 10.1 Mandatory non-impersonation rule

Do not take control of the buyer's browser session and do not request credentials. The mandatory operational proof is that the correct buyer account has exactly one active entitlement and that the deployed protected routes continue to enforce the same server-side account/product check.

Actual buyer interaction may be recorded only when it occurs naturally, is voluntarily confirmed by the buyer, or is visible through already-approved privacy-safe aggregate telemetry. Do not infer individual buyer usage from aggregate analytics and do not manufacture page views.

### 10.2 Book — Candidate 2

Verify the deployed authorization and delivery contract for `/guided-edition/book/`:

- anonymous access redirects to secure sign-in;
- an authenticated account without an active eligible entitlement is denied;
- the entitled buyer account is authorized for the protected reader;
- the reader identifies Edition 1.3 Candidate 2 and preserves the accepted untagged/non-PDF-UA wording;
- `Open private PDF` is shown only after the entitlement check;
- a file request signs only the exact governed Candidate 2 object in the private `library-pass-books` bucket;
- the signed URL lifetime remains exactly 300 seconds;
- the delivered object must match the frozen Candidate 2 size and SHA-256;
- the signed URL, token, and private object URL must not appear in public evidence or logs;
- revocation or refund removes the protected reader and private-file control.

Do not replace, rename, move, reprocess, upload, publicly share, or attach the PDF during buyer verification.

### 10.3 Audiobook

Verify the deployed authorization and delivery contract for `/guided-edition/audiobook/`:

- anonymous access redirects to secure sign-in;
- an authenticated account without an active eligible entitlement is denied;
- the entitled buyer account is authorized for the protected audiobook catalog;
- individual tracks are delivered only through short-lived signed private-object URLs after the entitlement check;
- no permanent MP3 URL, storage credential, or signed track URL appears in public HTML or evidence;
- a signing/provider failure returns an unavailable response and does not expose the asset.

### 10.4 Video Library

Verify the deployed authorization and delivery contract for `/guided-edition/video-library/`:

- anonymous access redirects to secure sign-in;
- an authenticated account without an active eligible entitlement is denied;
- the entitled buyer account is authorized for the protected 51-film catalog;
- playback uses a short-lived signed Cloudflare Stream token created only after the entitlement check;
- the raw Stream UID and signed token are not copied into public evidence;
- an invalid film path returns not found;
- a signing/provider failure returns a temporary-unavailability response and does not expose playback authority.

### 10.5 Access result language

Use one of these precise outcomes for each protected surface:

- **AUTHORIZED PATH VERIFIED** — server-side entitlement and route contract are correct, but individual buyer interaction was not observed;
- **BUYER-CONFIRMED PASS** — the buyer voluntarily confirmed successful access in their own authenticated session;
- **HOLD** — the buyer has a valid entitlement but the protected surface did not behave as required;
- **DENIED AS EXPECTED** — anonymous or non-entitled control access failed closed.

Do not claim a buyer playback or PDF-open PASS merely because the account has an entitlement.

## 11. Customer communication ownership

Lemon Squeezy owns the payment collection, financial receipt/invoice, transactional tax disclosure, payment dispute process, and provider-side financial notices.

USD Impact owns Library Pass account, product, access, privacy, and support communication. Any access-ready communication must occur only after the verified normalized payment and entitlement creation.

During this verification:

- confirm privately that Lemon Squeezy produced the normal provider financial confirmation where provider evidence supports it;
- verify an existing application-generated access-ready communication only if the normal reviewed lifecycle created one;
- do not send, resend, forward, or manufacture either communication;
- do not treat an email as authority to grant, revoke, or restore entitlement;
- if expected communication is absent, record a delivery/support HOLD and investigate through the existing lifecycle evidence path without changing the commercial records.

## 12. Scheduled final-state reconciliation

The normal Production scheduler calls `/api/commerce-reconciliation` once daily at 05:00 UTC. Do not manually invoke it to manufacture timing evidence.

For the first buyer transaction:

1. Confirm the one reconciliation row exists and has a legitimate `next_reconcile_at` value.
2. Wait for the first genuine scheduled window at or after that due time.
3. Verify the Vercel scheduler request was authorized and completed on the current Production deployment.
4. Confirm the scheduler selected only already-existing due rows with `disposition='tracking'`.
5. Confirm the runtime re-read the same authoritative provider Order and Order Items.
6. Confirm no second purchase, entitlement, or payment-completed event was created.
7. If the provider still reports `paid` while the local purchase is `completed` and entitlement is `active`, require `disposition='tracking'` and the next reviewed reconcile time.
8. If no row was due in a scheduled window, record **NO DUE ROW — NOT A FAILURE** and wait for the next legitimate due window.
9. If the provider read fails, confirm the reviewed failure path records a bounded retry for the existing tracking row without changing purchase or entitlement state.

The scheduled reconciliation is supporting final-state evidence. It does not replace the signed `order_created` webhook and trusted purchase-intent path required for initial entitlement creation.

## 13. Fail-closed incident matrix

| Observation | Required disposition |
|---|---|
| Provider payment exists but there is no trusted matching purchase intent | **HOLD**. Do not create or backfill an intent. Preserve evidence and escalate. |
| Webhook signature missing, invalid, or checked after parsing | **SECURITY INCIDENT / FAIL CLOSED**. No receipt, purchase, or entitlement may be accepted from that request. |
| Same provider event ID has a different payload hash | **SECURITY INCIDENT / FAIL CLOSED**. Preserve both hashes privately; do not overwrite the receipt. |
| `order_created` webhook exists but authoritative Order re-read fails | **HOLD**. Do not grant access from the webhook payload alone. Use normal provider retry/resend and reviewed incident procedures. |
| Authoritative Order is `pending` or `failed` | **DENY / HOLD**. Never grant entitlement. |
| Wrong Store, Product, Variant, item count, quantity, subtotal, discount policy, currency, account, or purchase-intent link | **SECURITY INCIDENT / FAIL CLOSED**. Do not patch the mismatch. |
| One provider transaction maps to more than one purchase | **P0 DUPLICATION INCIDENT**. Do not delete rows or issue a synthetic refund. |
| More than one active Library Pass entitlement exists for the buyer/product | **P0 ENTITLEMENT INCIDENT**. Deny any unsafe path, preserve records, and investigate without manual consolidation. |
| Active entitlement exists without one trusted completed purchase | **P0 AUTHORIZATION INCIDENT**. Treat access as unsafe; do not invent a purchase. |
| Purchase is completed but entitlement is absent or not active | **CUSTOMER ACCESS HOLD**. Do not create a second entitlement manually. Preserve the valid purchase and use the reviewed repair/incident process under separate approval. |
| Entitlement is active but book, audiobook, or video authorization fails | **PRODUCT DELIVERY HOLD**. Do not modify the entitlement merely to test; inspect the route, deployment, manifest, and provider-signing logs. |
| Buyer cannot sign in | **ACCOUNT SUPPORT HOLD**. Do not request credentials or move the purchase to another account without a reviewed identity and account-recovery process. |
| Duplicate webhook resend | Require one receipt per event ID and no second purchase, entitlement, or canonical event. |
| Provider status remains `paid` and local completed/active state agrees | Reconciliation remains `tracking`; no restoration or duplicate transition. |
| Provider reports full `refunded` with exact full refunded amount | Verify the legitimate refund and idempotent purchase/entitlement transition to `refunded`; do not manufacture the refund. |
| Provider reports `partial_refund` | `review` only. The full-refund-only Library Pass policy makes this non-automatic; do not grant, revoke, refund, suspend, or restore automatically. |
| Provider reports `fraudulent` | Verify reviewed idempotent `payment.revoked` semantics and entitlement `revoked`; do not invent a chargeback event. |
| Provider reports a later `paid` state after a terminal local state | `review` only. Never auto-restore a terminal entitlement from a conflicting observation. |
| Dispute or chargeback email/dashboard notice without a supported authoritative state | Operational escalation input only. It is not direct database authority. |
| Scheduled reconciliation request is unauthorized or non-200 | **SCHEDULER INCIDENT**. Do not invoke manually; inspect deployment/configuration and preserve the due row. |
| Provider or database outage creates an ambiguous outcome | **HOLD**. Do not retry in a way that can duplicate a purchase or entitlement; reconcile from durable evidence. |
| Any public evidence contains buyer data, full IDs, secrets, signed URLs, or raw payloads | Remove or restrict only the exposed evidence through the approved incident process; do not alter the underlying transaction. |

For any material invariant failure, mark the transaction verification **HOLD** immediately. Preserve durable evidence and request the existing configuration-first commerce rollback action if needed. Do not silently disable, enable, or redeploy commerce under this read-only runbook unless a separate action-time approval authorizes it or an already-approved automated fail-closed guard has acted.

## 14. Runtime and deployment verification

For the exact Production deployment serving the first order:

- verify the deployment is READY and matches current signed `main`;
- identify the webhook request and any associated runtime request IDs privately;
- scan warning, error, fatal, and 5xx logs for the webhook, provider re-read, completion RPC, entitlement access routes, and scheduled reconciliation;
- distinguish expected negative-fixture or unauthorized-probe messages from a real buyer-path failure;
- verify no secret, raw webhook body, buyer identity, signed URL, or private provider payload appears in logs;
- verify public Daily News remains available and independent from Library Pass access;
- verify commerce readiness and seller disclosures remain healthy without creating another checkout.

A green deployment alone is not proof of a valid transaction. A valid transaction alone is not proof that protected delivery and customer rights remain healthy.

## 15. Evidence packet template

### Private evidence packet

Record privately:

```text
Verification timestamp (UTC):
Current signed main SHA:
Production deployment ID:
Provider environment/test_mode:
Private Order/transaction ID:
Private provider event ID:
Private purchase-intent ID:
Private account ID:
Private purchase ID:
Private entitlement ID:
Private reconciliation ID:
Product / Variant / price tier:
Item count / quantity:
Subtotal / discount / tax / total / currency:
Webhook signature verification result:
Webhook receipt status and attempt count:
Authoritative Order + Order Items re-read result:
Purchase-intent cardinality/status:
Purchase cardinality/status:
Entitlement cardinality/state/purchase link/ends_at:
Canonical entitlement-event cardinality:
Reconciliation cardinality/status/disposition:
Book authorization result:
Audiobook authorization result:
Video authorization result:
Scheduled reconciliation result:
Runtime/log review result:
Customer communication observation:
Final disposition: PASS / HOLD / INCIDENT
Reviewer:
```

### Public GitHub evidence summary

Use a redacted summary only:

```text
First genuine buyer verification — PASS / HOLD / INCIDENT

- Verified at: <UTC timestamp>
- main / Production deployment: <SHA> / <deployment ID>
- Provider: Lemon Squeezy Live; private identifiers verified and redacted
- Commercial invariants: PASS / exact blocker
- Signed webhook and authoritative provider re-read: PASS / exact blocker
- Cardinality: 1 trusted intent, 1 processed receipt for the event ID,
  1 completed purchase, 1 active permanent Library Pass entitlement,
  1 payment-completed entitlement event, 1 reconciliation row; no duplicates
- Protected delivery: book <result>; audiobook <result>; video <result>
- Scheduled reconciliation: <not yet due / scheduled PASS / exact blocker>
- Runtime health: PASS / exact blocker
- Buyer data, secrets, raw payloads, and signed URLs: not published
- Order preserved; no synthetic refund or manual database repair performed
```

Do not publish the template with unresolved placeholders.

## 16. PASS criteria

The first genuine buyer verification is complete only when:

1. the buyer qualifies as independent genuine commerce;
2. the Live paid Order matches all trusted product, account, price, quantity, subtotal, discount, and currency invariants;
3. the raw-body signature was verified before parsing;
4. one durable webhook receipt was processed;
5. the authoritative provider Order and Order Items were re-read;
6. exactly one trusted purchase intent became completed;
7. exactly one completed purchase exists;
8. exactly one active permanent Library Pass entitlement exists, linked to that purchase, with `ends_at` null;
9. exactly one canonical `payment.completed` entitlement event exists;
10. exactly one reconciliation row exists and no duplicate commercial state was created;
11. book, audiobook, and video authorization paths remain entitlement-gated and fail-closed, with buyer interaction described only at the evidence level actually observed;
12. the first due scheduled reconciliation runs normally or is explicitly recorded as not yet due;
13. runtime health and privacy-safe logging pass;
14. no manual database repair, synthetic transaction, synthetic refund, credential exposure, customer impersonation, or public buyer-data disclosure occurred;
15. the order remains intact unless a legitimate buyer-driven or provider-supported reason requires a later lifecycle transition.

A missing scheduled run that is not yet due does not block an interim **PURCHASE PATH PASS — RECONCILIATION PENDING** status. Final lifecycle closeout requires the first applicable genuine scheduled reconciliation evidence.

## 17. Candidate 2 preservation rule

Candidate 2 remains the active private digital-reader artifact for eligible Library Pass accounts only. Its accepted untagged/non-PDF-UA limitation must remain visible and must not be represented as PDF/UA conformity.

Maintain:

- private `library-pass-books` bucket;
- no public Storage policy;
- exact governed Candidate 2 object only;
- frozen size and SHA-256 integrity;
- authenticated and entitlement-gated access;
- five-minute signed URLs;
- denial after refund, revocation, or loss of eligibility;
- no public website download, public Drive sharing, anonymous access, email attachment distribution, public GitHub asset, ISBN/barcode action, or print-publication action.

The first genuine buyer does not authorize a new PDF, a replacement object, public sharing, ISBN assignment, barcode generation, or print publication.

## 18. Closeout

After a PASS:

- add one redacted evidence comment to the controlling commerce and launch governance issue or issues;
- do not copy the full private packet into the public repository;
- keep the transaction and entitlement intact;
- continue normal read-only buyer and scheduled-reconciliation monitoring;
- do not create a second buyer transaction or refund merely to repeat the proof;
- leave future legitimate refund, fraudulent-state, privacy, support, and account-deletion events to their normal reviewed lifecycle paths.

After a HOLD or INCIDENT:

- preserve the buyer's legitimate provider Order and all durable evidence;
- do not manually grant, revoke, transfer, duplicate, or delete access records;
- stop any claim of end-to-end launch completion;
- identify the smallest safe corrective action and require a separate explicit approval before any Production mutation;
- keep public Daily News and unrelated customer access isolated from the incident.