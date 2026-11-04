# Research #1103 — A30 findings and B-1/B-2 Draft acceptance (2026-11-04)

This is a **stacked Draft** based on PR #1108 at exact SHA 098e322b1931f6ff7e823464fa1345d783bcea81 and originally protected main bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea. No merging, deployment, SQL migration, roles, workflow, Production settings, payment, email or provider action authorized.

**All current Research receipt logic remains default-OFF.** The new fingerprint is called only inside the already optional receipt path. The companion file in docs/operations is COMMENT-ONLY SQL design, not a migration, and none of it was executed.

## A30 findings classified

| Finding | Evidence | Required work |
|---|---|---|
| F1, P1: unstable semantic fingerprint | Claude offline A2/A3 example, plus code hashes all signed payload except delivery webhook_id. Lemon Squeezy documents 24h signed portal URLs, NOT verified URL regeneration on webhooks. | Pure versioned business-field allow-list. Added in this Draft; independent provider-schema review still necessary |
| F2, P1: stale finish overwrites new status | Verified shared finish receipt SQL has UPDATE by id without attempt CAS; Claude RC2/RC3 modeled. | Research-specific DB lease/attempt CAS, not yet implemented |
| F3, P1: lost conflict on retry | Verified shared receipt begin resets last_error to null; Claude RC8 modeled. | Append-only conflict evidence, not merely mutable receipt. Only SQL review plan here |
| F4/F5, P2: duplicate in-flight workers and terminal mismatched hash | Shared begin returns terminal duplicates before comparing SHA; no worker lease. | Research receipt begin must compare hash on terminal states, lease a single worker, return in_progress to competitors |
| F6/F7, P2: unknown paid subscription and unrelated invoice | Claude mock reproduction | Journal signed unbound subscription, verify invoice provider-subscription ownership |
| F8/F9, P2: service headers and message classification | Source read-only review | Verify Supabase secret-key service header form; use trusted SQL conflict codes, not brittle error messages |
| F10, operational P1: limited provider retries | Lemon Squeezy documentation confirms 3 retries after initial attempt at about 5/25/125 seconds | Reviewed durable recovery and owner-authorized provider reconciliation required |

## New versioned business fingerprint

The pure helper in apps/web/src/lib/research-membership-receipt-business-fingerprint.js includes:
- Signed event name and four current USD Impact checkout binding keys: account ID, Research product ID, interval, checkout key.
- Object type and object ID.
- Subscription store/product/variant/customer, status, cancellation, trial/renewal/end and created/updated dates, mode.
- Invoice subscription/store, status/refunded flags and amount, currency/tax/subtotal, refund/create/update dates and mode.

The projected hash excludes portal/payment URLs, buyer email, buyer name and webhook delivery metadata. Key order is normalized. Missing fields and null are distinct. A newly added USD Impact binding key requires a fingerprint-version review. Raw identifiers are not persisted in the new hash.

**This field list is provisional until independently checked against the latest provider payload and all account/entitlement-affecting adapter fields.** HMAC, store/product/mode checks, provider ownership and DB ordering are separate boundaries; the hash never authorizes a transition. Signed portal URL rotation across deliveries is unverified.

## New Research-only SQL contract (NOT IMPLEMENTED)

The COMMENT-ONLY file docs/operations/research-b2-journal-receipts-2026-11-04.sql proposes:

1. A Research-specific receipt begin that compares semantic hash even on terminal processed/ignored records; issues server-side attempt and lease token; refuses a second concurrent processing lease.
2. Research-specific finish with compare-and-swap predicate on receipt ID, exact attempt, lease token, and status received. A stale finish does not overwrite a terminal state.
3. An append-only private reconciliation observation journal with separate resolution events. No UPDATE/DELETE by service_role and no raw provider body, email, name, URLs or credentials.
4. Explicit RLS, SQL overload audits, function revokes from PUBLIC/anon/authenticated, owner-role checks, and protection from direct service-role bypass. No privileged writer model is approved.

The existing Library Pass shared receipt SQL remains untouched. An app-level receipt begin/finish still cannot make an external provider charge and local entitlement transition globally atomic. Actual two-session PostgreSQL and failure-recovery proof remain mandatory.

## Acceptance matrix — future real Postgres work

| Case | Future requirement | Evidence now |
|---|---|---|
| A2/T20 | Portal URLs rotate without changing business hash; changed period/account/status/refund changes hash | Pure synthetic, NOT provider delivery |
| RC1/T17 | Two concurrent begin calls; one leased, one in_progress | Model only, NOT real PostgreSQL |
| RC2/RC3/T18 | Stale attempt fails CAS and cannot overwrite terminal | Model only |
| RC8/T19 | Retry/crash never erases immutable conflict observation | Model only |
| A3/T7/T8 | Terminal duplicate with changed semantic hash is conflicting, never silent duplicate | SQL design only |
| T13 | Two paid subscriptions for one account produce durable unbound-provider journal entry and no unintended entitlement | Not executed |
| T11/T21 | Deleted account and complimentary entitlement remain protected | Not executed |
| T22 | Existing Library Pass entitlement and receipt behavior unchanged | Code diff only; executed DB negative tests pending |

**Proposed next order:** owner D1 secrets-free two-session PostgreSQL target; D2 safe writer-role model; review B-2 append-only journal and CAS; choose D3 interim #1107 checkout rule; defer D4 read credential; owner D5 merchant public buy-link inspection; D6 customer refund/relink protocol; D7 flag release only after independent QA and real DB receipts.

**Status: Draft-only, test model only, all Production/Research P1/rights/F2/Score/email/publication/migration HOLDs preserved.** No real customer charge or Production incidence has been demonstrated by these offline tests.

## A31 independent review follow-up (2026-11-04; new stacked Draft, no release)

Claude independently reviewed exact parent Draft #1109 HEAD ae8df0bf81cb8341adf538c8f1d5fd0bc33184d0.
Verdict: CODE-LEVEL PASS with receipt feature OFF; ACTIVATION BLOCK.
RC2/RC3 stale finish, RC8 erased conflict, concurrent begin, terminal hash mismatch,
unrelated invoice and missing real PostgreSQL proof are NOT fixed by v2.

**G1 invoice billing reason:** Invoice billing_reason is read by the Research
Lemon Squeezy adapter but omitted from v1. v2 includes it, with offline
renewal-versus-initial negative tests.

**G2 binding metadata:** Missing, explicit-null and empty meta.custom_data now
produce distinct v2 fingerprints via a custom_data_state discriminator.
All four known USD Impact binding fields remain protected; unknown
usd_impact_* keys fail closed pending fingerprint review.

**G3 pause and subscription price:** v2 hashes the full signed subscription
pause object (or exact missing/null state) and first_subscription_item.price_id
and quantity, with offline negative tests. The actual adapter STILL ignores
pause as an entitlement transition. Separate signed-provider state mapping
and owner policy are required; this is not live pause support.

**Version upgrade:** v1 and v2 have different hashes. Flag remains OFF and
no receipt was rewritten. Before any future activation, independently verify
current environment settings and any historical v1 receipt rows; define
a versioned migration/reconciliation protocol rather than silently accepting
changed semantics as duplicates.

**G5:** Companion comment-only .sql specifies proposed 90-second lease
(unapproved), idempotent finish with completed-token digest, separate
journal ownership, UPDATE/DELETE/TRUNCATE refusal triggers, privilege and
RLS assertions, and approved retention/redaction requirements.
No migration or real PostgreSQL execution occurred, and F2/F3 remain
unimplemented. Owner D1-D7 HOLDs remain.

**Daily #840 P0:** Read-only evidence finds Nov 4 generator #41808333994
SUCCESS and one-file PR #1110 exact HEAD c011ddd1a3060e0b324a38f9b3474320880241fe
open/unmerged. No auto-publisher run was visible in recent Actions runs.
The candidate incorrectly dates next EIA petroleum report November 6,
conflicting with EIA's standard Wednesday Nov 4 release and Nov 12
holiday exception. Source and release gate approval required before
any merge. Evidence: https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-6633022086

**No release:** no SQL, roles/grants, workflows, cron, real Postgres,
provider request, payment/refund, customer entitlement, email, Production
settings, deployment or merge. Independent final-SHA review required.

## A32 targeted provider-field completion — v3 Draft-only (2026-11-04)

A32 provider-schema review identified omitted **signed business fields**, confirmed in published Lemon Squeezy API attribute definitions (not observed in a real customer webhook). The existing stacked Draft #1111 now proposes `research-receipt-business-v3` in the default-OFF pure fingerprint helper; no provider API access, merchant event, SQL or Production change.

- Subscription signed identity: `order_id`, `order_item_id`, and `billing_anchor` are now projected, in addition to the existing store/product/variant/customer fields. The billing anchor is the collection day, but this hash does **not** validate the authenticity of a later provider subscription snapshot.
- The nested first subscription item projects `id`, `subscription_id`, `price_id`, `quantity`, and optional `is_usage_based`. Missing versus null versus changed item identity are synthetic negative cases. Current Research products are not hereby authorized for usage-based billing.
- Invoice signed identity and money fields: `customer_id`, `discount_total`, and `tax_inclusive` are projected alongside subscription, store, currency, amounts, status and billing reason. Rotating invoice download URLs and buyer names/emails remain deliberately excluded.
- Synthetic tests cover altered order/item, collection day, customer, discount/tax, price/quantity/usage flags, key reorder, absent/null fields and URL/presentation stability. These are **hash distinctions**, not provider/customer binding checks, real signed webhook replay or durable storage assertions.
- Version changed from v2 to v3 because the protected field set and presence sentinel changed. **Never compare a persisted v1/v2 receipt against v3 as equivalent without an approved version migration and signed-event reconciliation.** Flag default-OFF and no v3 receipts installed or written by this Draft.
- Invoice customer-to-bound-subscription matching, unknown future financial provider fields, authorized database CAS/journal, role grants, trusted event ordering, two-session real PostgreSQL, and D1–D7 owner policy/release approval remain separate **ACTIVATION BLOCK** items.

Reference: https://docs.lemonsqueezy.com/api/subscription-invoices/the-subscription-invoice-object
Reference: https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
Reference: https://docs.lemonsqueezy.com/api/subscription-items/the-subscription-item-object
