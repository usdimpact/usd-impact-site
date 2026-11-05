# Stage Q — full Stage P locked gateway two-backend race, rollback and replay

**DRAFT / ISOLATED PG17 ONLY / NO-GO FOR ALL LIVE RESEARCH O1/O4 OR B-5 COMMERCE.**

Parent [Stage P Draft #1154](https://github.com/usdimpact/usd-impact-site/pull/1154) at exact `ff81314e33d623c97fcdc2386b1cb1759053e05b`, unchanged and reserved for D2-26 independent read-only acceptance. Parent Stage O independently accepted a *synthetic-only* N-X0 design and passed a newer O-T1 exact-empty-`search_path` CI assertion, but this does not authorize deployment.

This Draft adds ONLY a new Stage Q test, this handoff and scoped Actions workflow. It has no app imports, migration files, merchant SDK, API secrets, connected Supabase SQL, new credentials, checkout mutations, customer entitlements, Library Pass edits, merge, or deployment. A fully disposable PostgreSQL 17.6 service and the exact Stage P test harness are used.

## Q-1 Post-effect transaction failure

The Stage Q job executes Stage P's complete historical Research/actual pinned B5 M1 PG17 fixture and all Stage P negatives first, then creates a second synthetic account with purchase-backed Library Pass and valid **test namespace** issued checkout, signed B5 observation, consumed intent, pending Research subscription, canonical non-quarantined J/K invoice, two independent verifier-witness events and private append-only Stage P handoffs.

It invokes one otherwise eligible first-activation through the real restricted Stage P gateway in an explicit database transaction. The call temporarily creates one Research entitlement, subscription event, entitlement event and delivery audit. A forced, subsequent local transaction exception (`P0001`) is injected **after** those effects and the full transaction is rolled back. A new connection must observe **zero** Research entitlements/events/audits, pending subscription version 1, intact preexisting B5/J/K/handoff history and byte-identical Library Pass purchases and entitlements. A clean retry remains possible.

This proves local rollback semantics only — not provider GET→COMMIT atomicity or refund resilience.

## Q-2 Two-backend conflicting first activation

Two **separate physical PostgreSQL client connections** synchronize on a barrier and race valid but different synthetic first-activation event keys against the SAME pending subscription with two independently verified Stage L witnesses and Stage P canonical handoffs. The gateway's subscription `FOR UPDATE` serialization must permit **exactly one** `synthetic_first_activation_applied`; the other independent event fails `42501` once version/state has changed. Database inspection requires one Research entitlement, one subscription event, one entitlement event, one delivery audit, active subscription at version 2, and no Library Pass changes.

## Q-3 Replay and stale receipt

The winning event, when replayed, must be non-mutating `synthetic_duplicate` with `can_mutate=false` and `live_can_mutate=false`. A replay of the losing (stale) independent event must still deny `42501`; counts and Library Pass must remain unchanged. This is deliberately distinct from two identical retries, and checks that the Stage P handoff does not create a second first purchase.

## Evidence and boundaries

The CI matrix replays original G/H/J/M + O provider fail-closed JS, fresh PostgreSQL I/J/K/L/M/N, O driver cancellation, O guard-first B5, P strict evidence and the new Q race/rollback, in individually disposable PG17 services. The Production migration-intake guard must pass too.

The canonical invoice digest is a **transport consistency hash**, not a merchant signature. The B5 signed observation is simulated, without actual Lemon Squeezy authenticated settlement. Verified invoice-paid-cycle start/end R2, post-final-GET refund R1 and the owner's exposure/reconciliation policy, live legacy `service_role` and 16-arg RPC L1, D2-C shared-commerce LP/Paddle/delete/TRUNCATE/TRIGGER, driver network-partition deadline, external auditing/role custody and Development parity all remain open. Source SHA and CI success are not independent D2-26/D2-27 acceptance or Production authorization. Leave all Drafts unmerged.

**Live O1/O4 P1 OPEN / B-5 NO-GO.**
