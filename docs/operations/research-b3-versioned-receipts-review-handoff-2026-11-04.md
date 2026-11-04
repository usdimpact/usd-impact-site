# Research #1103 — B-3 versioned receipt prototype and independent-review handoff

**Date:** 2026-11-04. **Source:** user-provided Claude Assignment 32 (independent review of Draft #1111 exact HEAD `2f1a76ab91f518d92c5104cf3853d72c19f54c1e`). **Branch:** stacked child from that exact commit, itself based on unmerged #1109/#1108. Protected main was `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`. All production/checkout/rights/SQL HOLDs remain.

## Why this Draft exists

Claude A32 found code-level PASS only while `RESEARCH_WEBHOOK_RECEIPTS_ENABLED` is OFF, but a **V1 P1 activation BLOCK**: the application mixes `research-receipt-business-v3` into the SHA-256 fingerprint yet the current `begin_commerce_webhook_receipt` persists only the hash, not the version. An old incomplete receipt can reject a new delivery with 42501, whereas an old terminal receipt can silently suppress a semantically changed delivery. Existing receipt CAS (F2), conflict history (F3), worker lease, and real two-session PostgreSQL remain unimplemented.

## What is included (no live code path)

1. `docs/operations/research-b3-versioned-receipts-pglite-review-2026-11-04.sql` — **executable prototype for isolated PGlite testing only**. It creates an intentionally isolated `research_receipt_review` namespace and stores event identity, `fingerprint_version`, hash, status, attempt, server-generated 90-second lease, last-completed attempt/token digest/status, and append-only conflict/resolution observations. It is NOT in `supabase/migrations`, NOT `research_private`, and is NEVER imported into a deployed app.
2. `apps/web/scripts/test-research-membership-b3-versioned-receipts-pglite.mjs` — PGlite **single-session** assertions: v3 version physically stored; in-progress duplicate returns in_progress; changed fingerprint/version receives a logged non-applied result; unsupported versions fail closed; exact finish idempotent; stale/mismatched finish refused; paid duplicate failure evidence survives retries; journal UPDATE/DELETE/TRUNCATE refused; simulated expired lease with stale-worker finish.
3. Existing offline Research B-2 test imports the new synthetic suite so Web Quality validates this prototype on exact-HEAD CI.
4. This handoff enumerates remaining service-security, compatibility, time budget, two-session and owner-approval gates. No new packages, workflows, keys or external database access.

## Frozen fingerprint version compatibility (NOT yet wired)

The prototype **does not implement** the production application's v1/v2/v3 hash computation, because previous logic is not frozen as callable modules on this branch. The application would need:

- A strict, reviewed version registry containing immutable v1/v2/v3 implementations, with known signed payload fixtures and hash golden vectors.
- A server-side, authenticated, read-only **receipt version discovery** step by provider+event ID, with no exposed customer data. On an absent receipt, use the currently approved version; on an existing receipt, compute a hash with that exact stored version, then atomically call the begin function.
- The begin function must verify stored `fingerprint_version` **and** the semantic hash on every event, **including terminal processed/ignored**. Version mismatch or unsupported stored version produces a durable non-applied conflict and non-2xx; never silently replace a version/hash or trigger a paid entitlement transition.
- Read-only aggregate count of existing Research receipts before any future activation (provider namespace only, grouped by status). The owner has NOT authorized a Production database query in this task; **no count has been obtained**, and zero historical rows must never be assumed.
- The old shared `webhook_receipts` cannot be treated as automatically migrated; a separate owner-approved backfill/legacy-hold policy is required.

**Do not activate the new flag or replace current begin/finish RPCs with these offline prototypes.** SQL permissions, full trusted provider event binding and two-session safety have not been established.

## Database and security gates not proved by PGlite

- **D1:** real isolated PostgreSQL 15+ with pinned image, two independent concurrent connections; no Dev/Production DB.
- **D2:** approved NOLOGIN writer, separate journal owner and precise grants, revoke EXECUTE from PUBLIC/anon/authenticated, no SET ROLE privilege escalation. A SECURITY DEFINER entrypoint is privileged and must be explicitly approved; code here is SECURITY INVOKER, not a release-ready permission design.
- RLS alone is insufficient against Supabase service_role BYPASSRLS. Private schema, grants, restricted function calls and no journal direct UPDATE/DELETE/TRUNCATE must be asserted against actual roles.
- Triggers on conflict observations protect accidental mutation but are not immutable against a schema owner or superuser. Redaction/DSAR and financial retention require D6.
- External provider charge, webhook handler and local entitlement transition do not share a transaction with receipt begin/finish: CAS **cannot** guarantee paid entitlement or stop duplicate billing by itself.
- Explicit bounded total Research-network timeout (suggested <=60 s, pending verification) required before a 90-second lease can be considered viable. `api/commerce.js` is shared by Library Pass; changes to its `maxDuration` require separate regression review.
- The first settled receipt under v3 must not be silently reprocessed under v4; v3 retains known theoretical P2 missing-sentinel object collision and unprojected `pause` display fields. Address after the versioned contract is approved; do not introduce uncoordinated v4 hash changes.

## Real PostgreSQL tests to run ONLY once D1 is approved

- **T13:** competing first paid bindings to same account with `FOR UPDATE` and immutable unbound-provider journal.
- **T17:** two connections acquiring the same receipt; exactly one lease granted. One can block on row/unique index.
- **T18:** after intentional lease expiry, stale worker's finish must not overwrite new successful finish; exact retry of successful finish returns already_applied.
- **T19:** kill one worker after a committed conflict observation and before receipt finalization; retained journal still present, retry appends but cannot mutate. Also test service_role grants and trigger refusal.
- **T20:** identical signed business event with changed presentation URLs has unchanged per-version hash and can be retried after an actual failed attempt without 42501.
- **T21/T22:** complimentary Research and all non-Research Library Pass entitlements, commerce receipts remain byte-identical through complete test matrix.
- **V1:** v1/v2/v3 preexisting receipt row under matching/mismatching/unsupported stored versions, processed and failed outcomes, no false 200.

The PGlite test is single-session and does not prove locks, concurrent execution, privilege ownership, real PostgREST RPC grants, or Production deployability.

## Other unresolved work

- Research #1107, #1108, #1109, #1111 stay Draft/unmerged. Missing real CAS/journal, stale Research event ordering, first-binding conflict and provider retry exhaustion remain P1.
- Owner D5 must read-only inspect whether the merchant publicly exposes direct Research buy links. No merchant settings were inspected or changed.
- D3 checkout-reservation policy, D4 provider reconciliation access, D6 human refund/relink/retention decisions and D7 receipt activation remain separate.
- **Daily #840 P0:** [PR #1110](https://github.com/usdimpact/usd-impact-site/pull/1110) November 4 article remains unpublished; EIA Nov 6 weekly petroleum date is contradicted by EIA's Wednesday schedule. Publisher handoff and bot-created PR check-approval issues recorded in [Draft #1112](https://github.com/usdimpact/usd-impact-site/pull/1112), not modified here.

## Independent Claude next review

Review the new isolated SQL prototype and PGlite assertions against the exact child HEAD. Probe version mismatch, terminal semantic conflicts, stale attempts, journal triggers, untrusted function caller inputs, the DB-event ID source, and timeout/lease assumptions. Return code-level PASS/BLOCK/HOLD and a separate **activation BLOCK** verdict. Do not report PGlite tests as two-session PostgreSQL proof or create a migration.

**Safety statement:** no Supabase connected SQL, schema, role, grant, migration, Production config, provider charge, refund, email, customer entitlement, workflow, right, merge, or deployment was authorized by this Draft.
