# Research #1103 — F3 UI02/UI03 + A-strict integration evidence

**Review-only / not a release migration.** The two independent disposable PostgreSQL 17 jobs demonstrate a combined **synthetic** schema/test replay. This does NOT mean that every #1189 financial behavior has been merged, that Development/Production schemas are equivalent, or that D1–D6 have been accepted.

## Pinned inputs and non-overlapping branch ownership

| Input | Exact revision | Incorporated into this child |
| --- | --- | --- |
| Protected main | `eecdc4aff221006289c9d7996ce2cb191f6da98b` | NONE; no change |
| Parent Research #1164 | `18a3c73bb514f1e380f741353707026835fa9af0` | Existing Research source, historical Draft only |
| F3 combined source #1189 | `35aa2701c51561fe24ee684e113b9308d6dcd43b` | **Only** exact UI02/UI03 test harness, F3 catalog query pack, 38 UI negative tests; **NOT** its changed P1 migration or webhook handler |
| F3 original Development UI source | `7005aa0585301892c96490d341c3c5645a616890` | Exact 3 source blob SHA verification, disposable second CI job |
| D3 source-only #1229 | `5ba5af790d8c520fbf05c47ec871bafad32ade30` | Not merged; A-strict overlay contains separate, unapproved 15-minute proposal |
| A-strict #1230 | `6aaa27e035065a485074e0408e8625199eb2e25b` | Inherited child branch |
| Outbox P1-C #1231 | `0d80b06bfcfa6acc8f373e96a7edb721ff9c960b` | Inherited immutable outbox guard |
| Recovery P1-A/B #1232 | `14d1665a640d919ea83cf5374f25ac55b87cf50d` | Frozen child base; four existing recovery changes |
| Current combined child #1233 | **check PR head at review time** | Only additional tests, copied reviewed F3 fixtures, workflow, and this document |

The F3 harness is copied verbatim from #1189 to the isolated paths `owner_model_replay_f3_review.py`, `test_f3_catalog_query_pack.py`, `test_research_p1_ui_locale_combined.py`, and `f3-development-catalog-readonly.sql`. The three pinned original UI migration blobs are verified before replay. In this source fixture, `auth.users` and JWT claims are **synthetic mocks** of Supabase GoTrue, not hosted Auth behavior.

## Verified exact-code security results

At CI run [#42894494996](https://github.com/usdimpact/usd-impact-site/actions/runs/42894494996), both separate PostgreSQL jobs finished SUCCESS:
- Base 53/53 source migrations, A-strict 162, outbox 14, owner recovery 67; JavaScript SQL-shaped 39 plus zero-network worker denial.
- F3 56/56 (53 base + 3 pinned UI02/UI03), F3 read-only catalog 20/20, UI two-user/anonymous/RLS/export/Phase A 38/38, then same A-strict 162, outbox 14 and owner recovery 67.
- Added adversarial checks after the previous #1232 review: prior ambiguous Auth attempt makes **zero** second FENCE and **zero** DELETE, with exact `prior_auth_attempt_ambiguous` HOLD; a signed payment between durable Auth intent and external DELETE creates a lasting open financial incident with no completed privacy/email; positive completion asserts `privacy_requests.status='completed'`, `completed_at`, case `completed_at`, and removal of private queued request IDs after receipt release.
- The tests confirm behavior of **synthetic SQL functions and mock Auth**. They do not prove provider order finality, actual JWT invalidation, or post-Auth merchant cessation.

## Major source-parity gap — DO NOT label this a full #1189 merge

At this child Draft's source tree, `supabase/migrations/20261105190000_research_p1_billing_safe_lifecycle.sql` has blob `395d0349eebc8406978c90d7a31873b34bd2c87b`, whereas #1189 has blob `e7875a39e6170d501f158ef9a319111840e2625f` at its exact head. The differences are **semantic**, not simply timestamps:
- #1189 includes `public.record_research_signed_invoice_receipt` (signed invoice payment/partial/full refund custody) and the related `researchP1InvoiceReceipt` non-entitlement-grant logic. **This combined child does NOT contain that new P1 SQL function.**
- #1189's `apps/web/src/lib/research-membership-webhook-handler.js` has blob `54349c836b3ae36ac28b022ba26a4d7203130aad` and records non-applied signed invoice facts before responding 2xx. The child still has earlier blob `c7c32a8e8559a01403e21c7f1e647336c5e4700d` without that receipt path. There is therefore a **financial-custody source gap** not covered by the current F3 UI tests.
- The child's original P1 lifecycle SQL still references the **24-hour** pre-Auth clearance. The **15-minute** checks are in the uninstalled A-strict overlay and in independent unmerged D3 #1229. There is no reviewed single deployable migration that reconciles both thresholds.
- #1189 also adds grant/revocation and old worker fail-closed revisions in the P1 migration and handler regressions. They are NOT silently incorporated by running UI02/UI03 replay.

**This source-parity gap remains a hard Research release blocker even when every current test is green.** Do not auto-merge a newer source file merely because its filename matches. The #1189 P1 migration and webhook adapter must be manually reconciled in a NEW owner-authorized integrated candidate, then tested under all source + F3 + A-strict suites and accepted by Claude at one exact SHA.

## Gated next actions

1. Freeze this child at an exact SHA and send the immutable source/test manifest to Claude for a read-only adversarial verdict. Do not alter its parents while it is reviewed.
2. Obtain independent audit of the finance-custody delta from #1189 (signed payment/partial refund event monotonicity, replay handling, no entitlement restoration, quarantine/late webhook), then **manual** source consolidation when the owner accepts that precise scope. Do not treat a combined UI-test PASS as permission to move #1189.
3. Verify the live Development F3 58-ID/Production 57-ID migration provenance, role grants and applied immutable SQL bytes **only** under separate approved catalog-only access. A 56/56 disposable result does not prove hosted parity.
4. Obtain written Lemon Squeezy account/checkout/invoice/PayPal/settlement cessation evidence; obtain legal/privacy response limits and D1–D6 **item-specific** owner decisions before any actual Auth, financial or privacy action.
5. Future release must separately quiesce legacy Auth-first workers, stage a fully reconciled migration under protected release approval, validate JWT/session and storage behavior on disposable synthetic identities and finally obtain a new exact-head independent reviewer verdict. No automatic re-DELETE or access restoration.

**Status:** All source changes Draft-only and unmerged; #1103 OPEN, real-account deletion NO-GO, checkout/new Research sales PAUSED. No hosted SQL/Auth, merchant calls, refunds, customer-data access, credential, Vercel/Production setting or deployment action was taken.
