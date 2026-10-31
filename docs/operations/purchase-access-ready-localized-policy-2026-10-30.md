# UI-02 — Localized, non-blocking Library Pass access email (DRAFT)

Owner direction: standard purchase-linked USD Impact access-ready notice, localized by a verified customer preference, independent of all marketing/newsletter groups; Lemon Squeezy remains the separate receipt merchant. This document records design and draft-only engineering, NOT a Production send approval.

## Verified architecture and evidence
- One completed genuine Library Pass purchase, processed webhook, active purchase-linked entitlement and member access were independently accepted; do not backfill that buyer or replay the event.
- A verified Resend sending domain exists: updates.usd-impact.com. Resend has 3 of 3 audience segments allocated: Spanish weekly, Read the Dollar First waitlist, General. Spanish segment currently has zero contacts and the waitlist has five. These are not purchase-delivery recipients or trustworthy language preferences.
- A Resend Spanish private opt-in topic exists; no native Resend templates or automations were found. Purchase email must not create or require a segment, contact marketing subscription, or promotional consent.
- Production and Development public.profiles each contain account_id,email,status but NO preferred_locale/locale column as of 2026-10-30. The existing notification_outbox stores a minimized empty purchase_access_ready payload and a fixed English template version. Do not pretend a locale is already available.
- Only EMAIL_READINESS_LEDGER_ENABLED=true was individually verified for Production. Other Production ledger/dispatch approval flags are not certified. Existing sending remains HOLD.

## Delivery and commerce boundaries
1. Financial authority: a genuine Lemon Squeezy paid order, matched trusted intent, authoritative terms and completed entitlement must be proven before email work.
2. The existing provider receipt or invoice remains Lemon Squeezy-owned. USD Impact purchase_access_ready is a separate account ACCESS notification, never a duplicate invoice.
3. After independently verifying the entitlement/account match, the notification attempt is non-blocking. An outbox or provider error reports a bounded code only and must not change the paid entitlement or mark the completed commerce webhook as failed. A notification HOLD requires separate review, not a blind webhook replay.
4. Preserve the durable outbox idempotency key and one message identity per qualifying purchase. A successful HTTP provider submission is NOT equivalent to delivered; a signed delivery callback is needed.
5. Production ledger and dispatch approvals remain fail-closed. Do not enable EMAIL_READINESS_PRODUCTION_APPROVED, LAUNCH_EMAIL_DISPATCH_ENABLED, LAUNCH_EMAIL_PRODUCTION_APPROVED or any other flag from this draft.
6. Never auto-enroll a paying customer in newsletters, Spanish weekly, waitlist, Portuguese audience, affiliate marketing, or Research Membership.

## Localization sequence (not yet activated)
- A purchase-language routing decision must come from a VERIFIED account preference recorded deliberately by the user under the appropriate site privacy notice. Never infer language from an email domain, browser header alone, merchant geolocation, consent event, or Resend marketing segment.
- The currently available deterministic fallback is English when no VERIFIED preference exists. English matches the already-published Library Pass product. Draft-only English and Spanish (including es-MX/es-419) render examples are in purchase-access-ready-locale-preview.js; they are NOT wired to checkout, webhook, outbox or Resend.
- Portuguese (pt or pt-BR) is intentionally HOLD because the independent Portuguese publication and its legal/brand release gates are still unapproved. Do not send a message claiming Portuguese product availability.
- Before any locale-driven Production delivery: design and review a server-verified account locale persistence mechanism, decide the precise language choice at checkout/account, and snapshot the immutable locale/template version for retries. This requires a separately approved schema/contract change; do NOT add it in this draft.
- Review Spanish copy with the owner, including the notice that included content may currently be in English; use USD Impact product/account URLs, not the independent Siguiendo el Dólar newsletter domain.

## Offline acceptance and release gates
- Synthetic tests prove: verified entitlement identity still gates notification; no-provider network when disabled; disabled Production controls fail closed; idempotent outbox intent; safe non-blocking HOLD even if logger fails; preview-only EN/ES and Portuguese HOLD; no marketing segment routing.
- The parent PR #1022 remains DRAFT/UNMERGED. Require exact-head Web quality, CodeQL and Dependency Review; Preview QA must not send any emails.
- Before any future live activation: confirm ALL four Production booleans privately, verified sender and reply-to support, locale preference provenance, immutable locale snapshot/outbox schema, recipient and bounce/complaint suppression, retry/ambiguous acceptance, operational alerting for HOLDs, signed Resend callbacks, and independently approved production template/rollback.
- Merchant receipt remains the canonical payment receipt. Account access must remain available even when USD Impact transactional email is delayed or never delivered.

References: https://github.com/usdimpact/usd-impact-site/issues/1021 ; https://github.com/usdimpact/usd-impact-site/pull/1022 ; https://github.com/usdimpact/usd-impact-site/issues/54

## Future-buyer notification reconciliation — review-only draft

The immutable paid purchase, completed intent, purchase-linked entitlement and verified profile can be compared against the application notification outbox in a bounded read-only snapshot. The new pure preview module is apps/web/src/lib/purchase-access-ready-recovery-preview.js. It is NOT wired to a route, cron, webhook, provider or database operation.

Only a separately authorized FUTURE activation cutover may make an item a review candidate. The currently accepted historical first buyer remains excluded and must never be backfilled. The current owner policy decision is not an activation timestamp. There is no approved activation cutover.

The planner identifies completed, non-refunded, non-disputed Lemon Squeezy Library Pass purchases with verified, unique completed intents and active purchase-linked entitlements, matching active account identity, validated email, and no existing purchase_access_ready outbox row. Any prior row of any status is an existing notification and requires manual reconciliation, not automatic recreation.

All output is review only (canWrite=false, canDispatch=false, requiresOperatorApproval=true). Only opaque purchase IDs and reason codes appear; no recipient address or provider data. Input is capped at 500 records per source and 25 proposed candidates; exceeding limits fails closed. Copy language defaults to EN because accounts have no verified locale column; Spanish remains render-only and Portuguese remains HOLD.

Before an authorized future recovery action, the operator must revalidate live authoritative state, provider ownership, exact purchase and outbox identity, delivery/complaint suppression, immutable locale/template snapshot and idempotent conflict handling. A signed callback is needed to prove delivery. Any execution requires a separately approved read-only inspector then bounded Development proof and exact-head Production release gates. No payment webhook replay, historical buyer send, or Production mail activation is authorized by this draft.

Remaining separate risk: transient failure while reading account/entitlement after a committed purchase may still fail the original commerce webhook receipt. Do not suppress an access-authority failure without an independent commercial reconciliation proof. Maintain HOLD until this is addressed and tested.

Additional fail-closed proof: callers must provide all five source arrays and explicitly attest a complete read-only snapshot (snapshotCertified=true). Without attestation, candidate output is HOLD. Missing refund/dispute fields and any prior access-ready row with the purchase ID, even if its business-object type is anomalous, also prevent a candidate. This is a manual operator review assertion, not independent cryptographic proof of snapshot completeness; before any future worker, full pagination, authoritative provenance and consistency need review.

## Verified account-preference / immutable snapshot proposal — Draft

Additional pure module: apps/web/src/lib/purchase-access-ready-locale-contract.js. It validates a server-obtained preference record with the correct account_id, RLS-attested selection_provenance=authenticated_account, en/es locale, monotonically increasing revision, and update timestamp. Missing preference falls back to EN. It creates a deterministic immutable snapshot over the original purchase/outbox identity, hashed recipient, preferred locale, revision, and template version. It never sends or writes.

The current outbox renderer is EN-only and permanently rejects Spanish preview version mismatch at the immutable record boundary. The contract sets canDispatch=false even for English; it is proof of routing identity, not a release enablement. Portuguese, newsletter segments, browser language, and unverified user_metadata may not supply a purchase-notification locale.

To implement persistent customer choice and immutable snapshotted rendering in Development, review the separate SQL design at docs/operations/ui02-transactional-locale-schema-proposal.sql. It is deliberately NOT under supabase/migrations and is NOT applied to any database. Review RLS/grants, privacy consent wording for account preference, user UX, outbox version consistency, atomicity of snapshot-plus-outbox, and the signed Resend callback before any execution. Automatic locale routing and all Production dispatch remain HOLD.

## Immutable outbox/snapshot pair verification — Draft

Review-only `purchase-access-ready-atomic-pair-review.js` checks that a completed purchase and active entitlement still bind to an outbox with matching account/purchase IDs, exact original idempotency, normalized recipient, allowed locale, template version, recipient SHA-256, and deterministic snapshot checksum. Missing, altered, Portuguese, untrusted-marketing or cross-account records fail closed. Every success explicitly has `canWrite=false` and `canDispatch=false`. SQL proposal now includes the recipient hash and snapshot identity fields and confirms the entitlement version within the snapshot insertion predicate. The tested Development atomicity POC used temporary tables inside a rolled-back transaction; this is not yet a real atomic writer, runtime guard, migration or email delivery approval.
