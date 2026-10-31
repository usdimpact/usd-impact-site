# Issue #950 — Post-lock lease clock regression

**Date:** 2026-10-29. **Scope:** source-only SQL candidate patch and real concurrent PostgreSQL 17 GitHub Actions test. **No real Supabase SQL applied.**

## Review finding

The first atomic-claim SQL candidate initialized `v_now := clock_timestamp()` at the beginning of `claim_due_account_deletion` and `begin_claimed_auth_removal`. Both procedures then wait on `SELECT ... FOR UPDATE` locks. A worker can enter with a valid claim lease but wait longer than its remaining lease, and the old `begin` then authorizes `auth_dispatched` and FK detachment using the **stale entry-time clock**.

The revised source resets `v_now := pg_catalog.clock_timestamp()` **after** acquiring both profile and attempt locks, before any lease-expiry decision or dispatch timestamp. The other token/generation checks remain unchanged. This is a candidate-level concurrency finding; no Production incident is alleged.

## Real lock-wait synthetic acceptance

The GitHub workflow runs a disposable local-only PostgreSQL 17 service. A first session acquires a profile row lock then an advisory-lock signal, and holds the row beyond an artificially shortened 3-second claim lease. A separate session begins before expiry, waits until after expiry, and must **reject** the previously valid token instead of detaching the Auth link. A second scenario confirms that a competing claim that began before expiry can correctly renew the expired pre-dispatch lease after its lock wait, with a new token/generation, while the stale token remains invalid.

The test uses separate `psql` connections and synthetic profiles, not PGlite, real Supabase PostgREST, real Auth Admin, session tokens, Storage or email. All work remains in GitHub Actions, no provider credentials injected.

**HARD HOLD:** no executable migration, Dev/Production SQL DDL/DML, real user, Auth deletion, provider email, Production deploy/merge, finalizer flag or cron activation. Cross-system exactly-once and crash recovery remain subject to independent testing and security approval.

See [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) and Drafts #963/#964.
