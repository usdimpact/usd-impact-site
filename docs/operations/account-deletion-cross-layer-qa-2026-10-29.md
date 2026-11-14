# Issue #950 — Cross-layer atomic claim, RLS and dormant client acceptance

**Dated:** 2026-10-29. **Status:** offline-only, isolated Draft; no real user, database or provider operation.
**Base:** exact 28/28 green Draft #958 integration, SHA `6a717e0b6f5543d446ef7c7ca36912b3f535a218`.

## Purpose

Earlier Drafts #954, #955 and #957 passed separate SQL, injected client and RLS tests. Separate success does not prove their RPC payloads interoperate. This Draft tests the actual unchanged claim SQL, stale-JWT RLS SQL and dormant adapter together. It applies both SQL review candidates to an in-memory PGlite database **only**, with a fake PostgREST transport, synthetic UUIDs and no real HTTP.

## Verified scenarios (once CI passes)

- Real SQL `claim_due_account_deletion` returns the token, request ID and generation expected by the client. SQL `begin_claimed_auth_removal` atomically moves to `auth_dispatched` and detaches the FK before the single injected Auth call.
- Existing linked pending accounts retain own profile/bookmark reads, but simulated previously-issued JWT subjects lose direct Data API reads of profile, bookmarks and learning_progress after FK detachment.
- A confirmed synthetic Auth 200 allows claim-bound SQL finalization and one in-memory durable completion.
- 100 synthetic competitors, using actual SQL via an in-memory API bridge, cannot create multiple successful claims, Auth calls or completion intents. **PGlite serializes its transactions: this is NOT live multi-connection or actual PostgREST proof.**
- A committed SQL begin() followed by a lost response generates **zero Auth requests**, retains `auth_dispatched`, and blocks automatic takeover.
- An Auth 404 results in a durable SQL `auth_ambiguous` state, no completion intent and no blind second DELETE.
- Cancellation before claim invalidates a scanned request; cancellation after claim conflicts. New app uses neither the old nonexclusive prepare RPC nor the plain-ID finalize RPC.

## What remains blocked

The old application finalizer in Draft #958 is still unwired to the new claim-aware adapter. The review SQL would disable its legacy RPCs if applied. No migration, source release or activation can happen independently of a separately reviewed coordinated cutover.

This synthetic fixture does not cover full live data/entitlement erasure, actual durable outbox storage, Auth Admin opaque-key real HTTP, Storage object ownership, JWT session IDs or refresh invalidation. Real PostgreSQL multi-connection concurrency, synthetic-only Development identity, cleanup and recoverability need distinct approval. SQL and RLS candidates remain outside `supabase/migrations`, so no automatic schema change is possible.

**Hard HOLD:** no SQL applied to actual Supabase Development/Production, no Auth deletion, no real user test, no provider email, no PR merge, no Production deploy, no cron or flags, no payment/entitlement/Research/Score change.

Refs: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950), [Draft #958](https://github.com/usdimpact/usd-impact-site/pull/958).
