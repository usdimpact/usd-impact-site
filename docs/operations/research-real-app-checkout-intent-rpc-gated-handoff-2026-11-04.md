# DRAFT HOLD — Research #1103 actual-app checkout intent gate (no database rollout)

Date: 2026-11-04
Protected main: `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea` (unchanged)
Independent branch: `agent/1103-real-app-checkout-intent-guard-20261104`
Owner scope: source/test preparation only. D2/D3/D4/D6/D7 permission and Production release NOT GRANTED.

## What this change does

This Draft modifies actual `apps/web/src/lib/research-membership-first-purchase.js` and its mocked regression tests, unlike the separate B-4.1 **synthetic** Draft #1121. It prevents the old first-purchase fallback from silently trusting Lemon Squeezy's signed `meta.custom_data.usd_impact_account_id` and a **format-validated** checkout idempotency key. A signed webhook proves the provider sent those bytes, not that the purchaser authenticated as the claimed USD Impact account or that an account-bound intent was issued by USD Impact.

Two *new*, intentionally uninstalled PostgREST RPC contracts must be independently designed, reviewed and installed before new purchases can work:

1. `issue_research_membership_checkout_intent`: only after `getVerifiedSupabaseUser` authenticates a session, a server-only call using dedicated trusted writer credentials requests an intent scoped to account, `research-membership`, exact store/product/variant, environment and monthly/annual interval. The **database** must atomically issue a 256-bit random base64url key (43 characters) and store its cryptographic digest privately, issue time, `clock_timestamp()` expiry (maximum 30 minutes), and unique client retry identifier scoped to the account. Return one response shape:
   `{action:"reserved",intent_id:"UUID",checkout_key:"43 base64url chars",account_id:"UUID",store_id:"...",variant_id:"...",billing_interval:"monthly|annual",test_mode:boolean,expires_at:"ISO UTC"}`.
   The client-supplied `idempotencyKey` is only a **request replay hint**, NEVER a trusted binding secret. No reusable plaintext proof may be exposed through any client-facing API response; store only its digest. Until an approved issuance function exists, the app returns a sanitized 503 and makes zero Lemon Squeezy checkout API calls.
2. `attach_research_membership_checkout_intent`: after the provider creates a hosted checkout but BEFORE its URL is returned to the buyer, atomically bind the issuer's account+one-time proof to a verified provider checkout ID. A failed attachment means **no provider checkout URL is returned** and a privately generated orphan checkout may require recovery. The endpoint must reject a second provider checkout association, state drift, mismatched env/store or expired reservation. Expected response: `{action:"attached",intent_id:"same UUID",provider_checkout_id:"same provider id"}`.
3. `bind_research_membership_with_checkout_intent`: replaces the old unguarded `bind_research_membership_subscription` fallback. In **one transaction**, lock the account and intent, verify digest/key, issuance and ownership, provider subscription identity, account+variant+store+test mode, attached provider checkout reference, expiry/consumption state, status/period constraints, duplicate paid evidence and existing complimentary Research / Library Pass invariants, and **consume intent AND bind pending subscription atomically**. Return a unique created/existing result only if evidence proves the same account and provider subscription; otherwise a non-200 response (and separately durable signed-paid evidence under the approved receipt design). Never grant access from this RPC alone.

All three RPCs above are **contract requirements**, not deployed code. No function, table, role, grant, index, RLS policy, feature flag or Supabase migration is created in this Draft. A valid-looking 43-character key is NOT cryptographic proof on its own; only the atomic private DB lookup can authorize binding.

## Risk and failure mode

- Missing/disabled issuer RPC: no checkout can be created. Missing/disabled trusted binding RPC: no first-purchase subscription binding is allowed. Existing known-subscription signed lifecycle events are still dispatched by the prior handler and remain subject to its independent ordering/security blockers. This Draft cannot be merged or deployed alone; while security-fail-closed, it would break legitimate new purchases until the server-side issuer and atomic binder exist.
- The frontend/replay caller can still send a requester-chosen idempotency string; that string is *never* a binding credential. The new private DB issuer MUST generate the proof, enforce a single outstanding intent per account/variant or collision-free request key, handle duplicate request retries without issuing multiple payable checkouts, and prevent replay across accounts or between test/live variants.
- The provider-created checkout link cannot be returned until attachment is committed. If the API fails after the provider checkout was generated, **no automatic retry or refund** should be inferred; provider checkout reconciliation/expiry remains a D6 recovery decision.
- The new RPCs are deliberately not implemented. Mocked tests check request/response shape, issuer mismatch, failed issuance/attachment, replay attempts and no legacy first-purchase RPC usage; passing mocked tests is NOT real SQL concurrency proof or a genuine HMAC/provenance guarantee.
- `inspectResearchMembershipFirstPurchase` currently rejects `subscription_created` if custom binding is absent/malformed. **A real paid provider event without local binding must be durably captured in a distinct private signed-paid observation before the provider's finite webhook retries are exhausted**, never auto-bound by email. That paid-custody journal/acknowledgement behavior is NOT solved by this patch. D4 provider read and D6 refund/relink/retention policy remain separately required.
- Current-main T13 competing paid subscriptions, T21 complimentary Research mismatch, T22 Library Pass protection, lifecycle O1/O4, receipt journal X3 rollback loss and X8 versioned historical fingerprint incompatibility remain open or independently tested in isolated synthetic branches only.
- Provider custom URL query fields are buyer-editable; webhook HMAC authenticates the provider delivery, not the user. Never accept a direct Lemon Squeezy Share buy link as trusted proof of an authenticated USD Impact checkout.

## Review acceptance and sequencing

1. Review this source/test-only Draft exact HEAD. Confirm no old `/rpc/bind_research_membership_subscription` call remains on the first-purchase path; no signed webhook can create an account binding without the new atomic RPC; the checkout API returns no URL without issuance and reference attachment.
2. Verify `apps/web/scripts/test-research-membership-first-purchase.mjs` and the existing Web Quality/CodeQL/Dependency/migration-guard hosted checks on this exact commit. No Supabase data or merchant API calls in tests.
3. Claude A37 separately reviews B-4.1 [Draft #1121](https://github.com/usdimpact/usd-impact-site/pull/1121). Independent invoice and receipt Drafts #1111/#1115, D5/D6 docs #1120, and live Daily #840 remain untouched. **Do not merge parent or rebase branches without a reviewed integration sequence.**
4. Design the private D2 SQL issuance/bind and real two-session test using **only a disposable isolated PostgreSQL project**, with no broad BYPASSRLS, SECURITY DEFINER, public EXECUTE, role self-escalation, service_role abuse or access to real customer data. Use the previously authorized D1 isolated runner; real D2 grant/deployment stays HOLD.
5. Separately approve D2, real merchant/customer recovery D6, D3 direct checkout policy and D7 Production release only after full replay/ordering/custody evidence. Keeping Research product Draft is not proof a direct Share URL is unreachable, and the user has deferred merchant toggles to prioritize engineering. No one here touched product status.

## Explicit non-actions

NO merge, deployment, connected Supabase or provider API call, webhook/receipt activation, real customer, payment/refund, billing/subscription, product status/variant, Lemon Squeezy test/live setting, Production SQL, GitHub App credentials, F2/Score, rights/media, Daily #840 or storage #950 changes. No real customer incident inferred from test code.
