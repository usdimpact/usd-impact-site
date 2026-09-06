# Research Membership TradingView access runbook

Status: launch-control runbook under issue #122. This defines the approved manual grant/revocation operating model only. It does not activate TradingView access, upload source code, create subscriptions, or authorize Production commerce changes.

## Purpose

Private TradingView Weekly Score access is a Research Membership benefit. Initial launch control is manual: USD Impact verifies the canonical Research Membership entitlement first, then an authorized operator grants or revokes TradingView access. Provider billing state, email claims, checkout redirects, screenshots, or customer assertions are never sufficient by themselves.

## Product boundary

- TradingView access belongs only to `research-membership`.
- Monthly and annual Research Memberships receive the same TradingView benefit while eligible.
- Library Pass is independent and permanent; TradingView grant/revocation must never create, revoke, suspend, or otherwise modify Library Pass entitlement.
- Daily News remains public.
- TradingView source code, private invite links, internal distribution metadata, and operator credentials remain private and must not be placed in tickets, customer email, public pages, logs, or repository content.

## Canonical eligibility source

The canonical authorization source is the USD Impact `research-membership` entitlement backed by the recurring subscription lifecycle.

Grant is allowed only when all are true:

1. the customer account is unambiguously resolved;
2. the canonical Research Membership entitlement is `active`;
3. the linked recurring subscription is in an access-eligible state (`active`, or `cancel_scheduled` before the paid-period end);
4. entitlement `ends_at`, when present, has not elapsed;
5. there is no unresolved refund, dispute, chargeback, fraud, or entitlement-integrity incident requiring suspension;
6. the requested TradingView username/account has been supplied through an approved support/account channel and normalized exactly;
7. the operator records evidence before changing TradingView access.

Do not grant from `pending`, `past_due`, `cancelled`, `refunded`, `disputed`, or `charged_back` state. No grace period is assumed unless separately approved.

## Grant procedure

1. Resolve the USD Impact account and canonical Research Membership entitlement.
2. Verify the recurring subscription and entitlement are eligible at the same observation time.
3. Confirm the TradingView username/account with the customer; never infer it from email address or display name.
4. Record a grant-control entry with: UTC timestamp, USD Impact account identifier, subscription identifier, entitlement identifier/version, TradingView username, observed subscription state, observed entitlement state, operator, and source evidence references. Do not record secrets.
5. In TradingView's private/invite-only access control, grant the exact verified username only.
6. Re-open or refresh the TradingView access list and verify the exact username appears once.
7. Record verification outcome and timestamp in the control entry.
8. If the grant cannot be independently verified, classify the operation UNKNOWN and do not tell the customer access is active.

## Revocation procedure

Revoke TradingView access when the canonical Research entitlement becomes ineligible, including effective cancellation, refund, chargeback, dispute suspension, explicit entitlement revocation, or a confirmed account-integrity correction.

1. Re-resolve the USD Impact account, subscription, and Research entitlement before revoking.
2. Verify the exact TradingView username previously granted from the control record; do not revoke by fuzzy matching.
3. Record the revocation reason, canonical state, entitlement version, operator, and UTC timestamp before the provider change.
4. Remove only that exact TradingView username from the private indicator access list.
5. Re-open or refresh the provider access list and verify the username is absent.
6. Record the post-change verification.
7. Confirm no Library Pass entitlement or learning-product access state changed.

For `cancel_scheduled`, do not revoke before the paid-period end while the Research entitlement remains active. Revocation follows the effective entitlement transition, not the cancellation request itself.

## Duplicate, replay, and identity controls

- A second grant request for an already verified active username is a no-op after entitlement re-verification.
- Never grant two TradingView usernames for one Research entitlement unless a separate policy explicitly authorizes it.
- Username changes require re-verification: grant the new exact username only after eligibility is confirmed, then revoke the old username and verify both outcomes.
- If two USD Impact accounts claim the same TradingView username, stop and escalate; do not guess ownership.
- Customer email changes do not automatically change TradingView identity.

## Failure and incident handling

If TradingView is unavailable, its access state cannot be read back, or the operator cannot prove the exact requested change:

- leave the canonical USD Impact entitlement unchanged;
- classify provider access as UNKNOWN rather than PASS;
- preserve the intended action and evidence for retry;
- do not issue compensating commerce, entitlement, or Library Pass changes;
- do not expose source code as a workaround.

If canonical entitlement and TradingView access disagree, the canonical USD Impact entitlement is authoritative. Correct the provider access narrowly after verifying identity and current lifecycle state.

## Minimum control record

Each grant or revocation record must contain, without secrets:

- operation: `grant` or `revoke`;
- UTC requested/observed/completed timestamps;
- USD Impact account id;
- Research subscription id;
- Research entitlement id and version;
- normalized TradingView username;
- canonical subscription state;
- canonical entitlement state;
- reason/source event for revocation when applicable;
- operator identity;
- provider read-back result;
- final status: PASS, UNKNOWN, or FAIL;
- evidence references.

Do not store passwords, cookies, API tokens, webhook secrets, private Pine source, or full payment data.

## Reconciliation

Until automation is separately approved, Research Membership operations must reconcile TradingView access against canonical entitlements at least:

- after every controlled lifecycle QA sequence;
- before Production launch approval;
- after any refund, dispute, chargeback, effective cancellation, or entitlement-repair incident;
- whenever watchdog/provider evidence reports an access mismatch.

A launch-readiness reconciliation should produce three sets: eligible-and-granted, eligible-but-missing, and ineligible-but-still-granted. The latter two are blockers until corrected or explicitly accepted with evidence.

## Separation of duties and protected actions

Read-only entitlement/provider inspection and reconciliation may be performed autonomously by authorized operations tooling. A real TradingView grant or revocation is a provider-side access mutation and requires the same protected-action approval discipline as other Production access changes unless an explicitly approved automation later owns that action.

No runbook step authorizes:

- TradingView source upload or source disclosure;
- automatic provider grants/revocations;
- Production recurring product, price, checkout, webhook, schema, credential, customer, subscription, or entitlement activation;
- email or outbound customer communication;
- changes to Library Pass access.

## Launch gate

TradingView launch control is considered ready only when:

- this runbook is merged;
- a controlled non-customer QA account proves grant, read-back verification, revoke, and read-back verification;
- the operation leaves Library Pass state untouched;
- the exact evidence format is retained for watchdog/reconciliation use;
- Production Research Membership activation is separately approved.
