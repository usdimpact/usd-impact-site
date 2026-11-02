# USD Impact — free-first / future paid-transition safety runbook (Draft / HOLD)

**Recorded:** 2026-11-02. **Owner policy:** Fundraising [DEC-018](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit#gid=476834265&range=A24:H24). **Implementation owner:** Master **UI-37**, with UI-02 (consumer notices and earlier buyers), UI-29 (Research), UI-39/UI-40 (EN/ES public experience), UI-25/D02 (audio rights), and UI-23/UI-24 (original Score rights). **Code:** [Draft PR #1056](https://github.com/usdimpact/usd-impact-site/pull/1056).

> **Do not merge or deploy this Draft on the basis of this document.** This is a release-safety contract and test guide. It is not an active payment mode, provider approval, owner-signed commercial offer, public rights clearance, or instruction to convert any account. No waiting period applies: the owner may ask for a new commercial offer on any date. All technical, legal, rights and customer-protection gates still apply.

## 1. Three distinct things — do not conflate them

| Function | Current and future handling | Owner |
| --- | --- | --- |
| Existing customer contracts | Earlier paid Library Pass entitlements, invoices, refund/support rights and protected copies remain intact, even during a future free-first campaign and after any prospective charge change | Master UI-02/UI-37 |
| Free learning | New public routes/text/EN-ES book/videos/audio only after individual rights, localization, access, consumer, privacy and bandwidth approvals. Public free items do **not** rewrite existing private member entitlement records | Fundraising D01/D02 + Master UI-39/UI-40/UI-25 |
| New charges | Existing Research Membership continues in its own checkout action. Future *educational* paid offer cannot reuse existing Library Pass SKU, price, billing period or merchant approvals without explicit item-specific confirmation | Master UI-37, owner, Merchant of Record |

Existing `Mode Switch` in the Fundraising tracker concerns an **alternate frontend routing decision**, not a payment switch. Do not move DNS or create a second store/site.

## 2. Current Draft code, explicitly not activated

`apps/web/src/lib/learning-offer-commerce-policy.js` defines server-controlled `USD_IMPACT_LEARNING_OFFER_MODE`.

| Committed free-launch barrier | Runtime mode | New legacy Library checkout | Notes |
| --- | --- | --- | --- |
| `false` (this Draft) | unset or `legacy` | Existing behavior | Zero-change baseline for current Production |
| `false` | `free`, `paid`, invalid | BLOCK | Testing guard, not a public free launch |
| `true` (future separately approved source edit) | unset or `free` | BLOCK | Safe after free launch even if the env key is lost |
| `true` | stale `legacy`, malformed | BLOCK | Reject a rollback to the old customer-facing checkout |
| `true` | `paid` | BLOCK | A paid request does **not** authorize any SKU; new billing design remains missing |

**Future free-public release requires an exact, reviewed source edit setting `FREE_CORE_PUBLIC_RELEASE_COMMITTED = true` in the *same* approved release that exposes the cleared free content.** Never use env-only `free` as the final launch mechanism or assume removing a flag is a safe rollback.

This source barrier is *not* a cryptographically irreversible transaction. Deploying an older **pre-free** code revision can still restore old checkout behavior; a future rollback must target a **free-locked** known-good release instead. Don't pre-emptively flip the barrier in this Draft or current Production.

The Draft API checks POST method, cross-site request and JSON content type first; then blocks `action=checkout` if new legacy Library purchases are not permitted, before it reads a body, account or provider. It does **not** alter `research-membership-checkout`, signed order/refund/research webhooks or reconciliation.

## 3. Prepare the free launch (independent explicit approval required)

1. Confirm the exact EN/ES educational objects and final versions; prove publishing, translation, voice, imagery and provider data rights **per item**. The original 8-driver Score provider inputs/derived archives remain on source-rights HOLD; synthetic teaching mathematics may be documented but not passed off as live Score.
2. Protect earlier purchasers: retain the existing authenticated Library path, historical entitlement and refund semantics; do not revoke customer rights, rewrite Production RLS or migrate purchaser records simply because another version becomes public.
3. Approve factual bilingual terms before free access, *without* a `free forever` promise. Define how a future prospective paid offer will be announced, how existing downloads remain with recipients, and how current Research remains separately paid.
4. Approve an explicit media delivery cost/abuse guard for each publicly streamed/downloadable film/audio asset. Preserve private Supabase signed objects and Cloudflare Stream access until clearances and limits PASS. Publicly distributed downloads and cached URLs cannot be recalled merely by turning on a paywall later.
5. Master UI-39/40 owns link/menu/canonical and anonymous public route changes; make all $39 Library sales CTAs, historical sales badges and waiting-list language accurate for the free state. Cross-check every duplicate CTA path, not only `/checkout/`.
6. Master UI-37 must verify that neither a direct `POST /api/commerce?action=checkout` **nor an existing Lemon Squeezy hosted checkout/buy URL** can sell a disallowed Library Pass. **Server blocking alone cannot invalidate a provider-hosted checkout link.** An appropriately scoped Merchant-of-Record product/variant/hosted link action needs independent approval; retain signed historical order/refund webhooks so earlier purchasers remain supported.
7. Approve source-committed free-lock and explicit server-side mode together, with a prechecked free-locked rollback SHA. Protect all existing Research checkout/subscription and historic buyer paths.
8. Validate **two distinct synthetic Development accounts** where possible (buyer and nonbuyer), plus anonymous access, lost cookies, expired JWT, invalid user, refund/revocation and signed download URL expiry. Do not use customers' personal data or invent a live paid purchase. Prefer existing PGlite/controlled Preview tests when no independent reviewer is available.
9. Require exact commit SHA, required GitHub tests, security scans, protected Vercel Preview, UI screens at 320/390/768/1440, noindex/canonical review, and documented owner release authorization. A READY Preview is not Proof of Production readiness.

**The free public launch is not performed by PR #1056**. This PR contains only the staged checkout boundary and tests.

## 4. Owner-triggered prospective paid release (no countdown, not yet an offer)

1. Owner requests a pricing review whenever funding or operations require it. No threshold or elapsed day automatically changes the site.
2. Owner signs a new **specific product contract**: exact list of assets affected, countries, currency, price, one-time/subscription cadence, effective time, refund/cancellation terms, and whether already-free materials stay obtainable. No prefilled price or hypothetical customer consent.
3. Merchant of Record provides item-specific written acceptance of the new commercial product/variant and handling of existing purchases. Confirm tax/refunds, terms, checkout domains, accessible hosted link, payment redirection and webhook secret scope.
4. Prepare a **new fail-closed server allowlist** for the approved offering (not the old `legacy` $39 checkout). Require positive SKU/variant match, owner-approved contract version and explicit opt-in from each *new* purchaser; don't infer any permission from existing membership or free use.
5. Keep existing Research subscriptions and existing Library Pass entitlements independent. Never auto-create purchase intents/ subscriptions or charge someone merely because they visited a free page.
6. Re-run both the `free` and prospective `paid` cases at protected exact-head Preview with malformed/missing config, replayed idempotency keys, forged account credentials, direct POST, provider-hosted links, CSRF, RLS, signed media URLs, refunds, accessibility, language and cache behavior.
7. Require evidence of successful test checkout *only in authorized provider Test Mode / Development*, if available, without real charges; separately approve any live genuine purchase test. Capture operator-only evidence without exposing tokens, customer identifiers or API secrets.
8. Owner gives final authorization for the **specific** pricing, user-facing legal notices, merchant setup, exact commit and Production activation method. A general “please continue” does not authorize new charges. Rollout with paired rollback controls; never mix with unrelated P0 Daily publishing fixes.

**There is no functional paid purchase mode in this Draft:** `paid` denies NEW Library orders until a future separately scoped implementation and merchant-approved variant exists. This intentionally prevents accidental revenue.

## 5. Tests and evidence

| Test | Evidence and boundary |
| --- | --- |
| Existing + explicit legacy checkout path unchanged in current pre-free Draft | `test-learning-offer-commerce-policy.mjs` and `test-learning-offer-commerce-function.mjs` |
| Future free-committed missing env, stale `legacy`, invalid values and premature `paid` all block old checkout | `test-learning-offer-commerce-policy.mjs` (synthetic committed-state simulation) |
| Direct POST denied before body, session, Supabase and Lemon Squeezy | `test-learning-offer-commerce-function.mjs` (offline disabled provider) |
| Method 405, cross-site 403 and content-type 415 remain enforced | Same direct-request matrix |
| Research checkout, signed webhooks and reconciliation remain isolated | Same *offline* fixture; no real subscriber touched |
| Existing paid buyer, unauthenticated/unenrolled visitors, refunded/revoked buyers preserve existing route decisions across pre-/post-free/paid states | `test-learning-offer-legacy-entitlements.mjs` (synthetic) and existing `test-paid-access.mjs` / `test-paid-route.mjs` |
| Development account-to-account RLS/negative and real protected media delivery | **Not yet executed** under this PR; a policy/schema review alone cannot certify them |
| Provider-hosted checkout URL disabling / new SKU / actual payment permission | **Not yet executed**; must be separately authorized |
| Live Production safety | Current main and paid endpoints remain unchanged; **no Production deploy/merge permitted** in this Draft |

Current Development/Production `entitlements`, `purchases` and `purchase_intents` tables have RLS enabled and `SELECT` policies scoped to own account. This is **read-only catalog evidence**, not a two-account executed negative-test receipt. Don't widen RLS or install migrations to enable free access.

## 6. Abort and rollback — do not erase entitlements

- On any mismatch, **block NEW educational purchases at the SERVER and provider-approved SKU/link layer** before touching existing account rights. Preserve already created legitimate payment records and refund processes.
- Roll back public pricing/navigation to an accurately described, previously QA-approved **free-locked** deployment; **never** use a pre-free legacy SHA as the rollback target once free learning has gone public. If no safe lock-compatible rollback exists, keep old sales blocked and pause the rollout rather than reinstall legacy sales.
- If a new paid provider checkout becomes invalid, stop NEW checkout URLs and review provider-side carts/links/fulfillment; disable or suspend the new SKU *only* with separately scoped merchant approval and a verified plan for open payment intents.
- Never rewrite the `entitlements` table, delete Library purchasers, reassign Supabase project IDs, change Research subscriptions, disable genuine refund webhooks, swap DNS, or delete downloaded materials to perform a pricing rollback.
- Record incident start, exact request/checkout mode, Git commit/deployment ID, event count *without PII*, merchant disposition and owner restoration approval. In a crisis use the existing manual rollback procedure and review the provider receipt.
- A paid option can be *considered immediately*, but safe activation cannot be promised instantly until the specific SKU, merchant rights, terms, implementation and tested protected release exist.

## 7. Gate ownership / current HOLD list

| Gate | Current state |
| --- | --- |
| UI-37 source-committed free-lock and offline checkout tests | Draft, under review |
| UI-02 historical buyer rights / EN-ES consumer notices | HOLD |
| UI-29 existing Research checkout and real subscriber separation | HOLD for real-account tests |
| UI-39/40 new EN-ES free public routes | Separate Drafts; not part of PR #1056 |
| UI-25/D02 voices, music/imagery/film rights and audio masters | Per-asset HOLD |
| Master UI-23/24 original Score sources | HOLD |
| Merchant future paid offering / variant / price / tax | Undefined / HOLD |
| Anonymous live media cost and abuse limits | Per-asset HOLD |
| Exact-head protected two-account Preview and rollback | Not executed |
| Production / media release / new commercial charge | **NOT AUTHORIZED / HOLD** |

Cross-tracker: [Fundraising Free/Paid Readiness](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit#gid=1353322769), [Master UI-37](https://docs.google.com/spreadsheets/d/1uDvVlmbqPONI6a7YWrbhQlwGt9QSn4qBtnYSx87NlcA/edit#gid=625932332&range=A43:Q43). Source references: [Supabase Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Lemon Squeezy checkout](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments), [Vercel release process](https://vercel.com/docs/deployments), [original Score source rights](https://github.com/usdimpact/usd-impact-pipeline/issues/155).
