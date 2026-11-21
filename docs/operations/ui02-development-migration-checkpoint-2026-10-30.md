# UI-02 — Development migration checkpoint (2026-10-30)

**Development-only installation. Production migration, dispatch and merge remain on HOLD.**

- PR: https://github.com/usdimpact/usd-impact-site/pull/1022 (Draft).
- Applied project: `ycstrcvshdluovtuasjc` — USD Impact Development. Production project `gjzetjugmnwanvjkchux` was not altered.
- Supabase migration ledger version: `20261030214706`, name: `ui02_atomic_purchase_access_locale_dev`.
- Exact installed SQL source: `supabase/migrations/20261030214706_ui02_atomic_purchase_access_locale_dev.sql`.
- SHA-256 of installed SQL (also asserted in CI): `3c1a88aa3f1a17c4a67fd0163026b0f2d8fda3da10b70fcbec66fb0ad719eb85`.
- Three persisted tables: transactional account language preferences; immutable purchase/access email locale snapshots; default-disabled activation control.
- Two privileged SECURITY INVOKER functions: atomic outbox/snapshot enqueue and independent pre-send DB verification.
- Post-install: `enabled=false`, `cutover_at=null`, zero preference records, zero snapshots, zero purchase-access-ready outbox entries.
- `anon` and `authenticated` cannot execute the protected RPCs. `service_role` can execute but does NOT have UPDATE permission for the activation control.

**Release warning.** This versioned file is on an unmerged Draft PR to preserve Development migration history. Merging the PR could make the migration available to automated deployment systems, including Production. **Do not merge, apply to Production, or enable any email flags without a separate scoped owner release approval and migration plan.**

Additional Development acceptance: prove live signed Auth RLS/REST flow; verify RLS under separate user sessions; exercise server-only PostgREST RPC path; certify concurrent preference and identity updates; review transactional UX/privacy; verify callback/suppression and refund timing. SQL role simulations and rollback-only synthetic purchase tests are not substitutes for signed end-to-end tests.

Commerce receipt remains Lemon Squeezy's responsibility. No marketing consent or Resend group subscription may be inferred from transactional purchases. EN fallback is draft-only; ES sending remains HOLD, Portuguese publication and customer notifications remain HOLD.
