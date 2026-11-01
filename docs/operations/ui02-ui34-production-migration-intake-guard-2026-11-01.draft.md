# UI-02 / UI-34 — Production migration intake guard (Draft-only, 2026-11-01)

## Scope

This is a repository/CI-only safeguard. It does not install migrations, modify either Supabase database, repair a migration ledger, modify #1022 or #1028, merge code, enable customer email, or authorize a Production release.

Repository of record: https://github.com/usdimpact/usd-impact-site
- Upstream Account Language Draft PR #1022 HEAD 9622efec7a164ac076bc2ef7d69519e01ff05c87.
- Stacked Media Language Draft PR #1028 HEAD dd0146eb11478891eeb1c2e663f4178d5cbe17c2.
- Public main at review: 4221668716c2214012e4dd26a1dae8ee050f728a.

## Read-only ledger evidence (November 1, 2026)

| History metric | Development ycstrcvshdluovtuasjc | Production gjzetjugmnwanvjkchux |
| --- | ---: | ---: |
| Applied migration versions | 58 | 57 |
| Versions absent from the other project | 19 | 18 |
| Shared version IDs | 39 | 39 |

Three Development-applied versions have no Production ledger entries:
- 20261030214706_ui02_atomic_purchase_access_locale_dev.sql
- 20261030221037_ui02_language_privacy_lifecycle_dev.sql
- 20261030234009_ui03_account_media_locale_preview_dev.sql

Ledger drift already predates these files. Production has sed_newsletter_* and stage_sed_consent_* versions missing in Development. Score handoff migrations have different version IDs across projects; some September email migrations have different IDs despite similar names. A version-only match is NOT equivalent to verified schema compatibility, nor permission to replay SQL or repair an applied history.

The existing repo runbook docs/operations/supabase-development-migration-gate.md is stricter: no db push, migration repair, SQL application or schema mutation without a separate, explicit scoped approval and review. That restriction still applies.

## Draft safeguard

1. .github/scripts/check-supabase-production-intake.mjs scans the checked-out supabase/migrations SQL directory, not a live database. It refuses the three known version IDs even after a rename; filenames ending _dev.sql; SQL header declarations saying Development-only or NOT a Production migration (including multiline block headers); **reserved SQL object identifiers from those Development-only migrations even when their timestamps, filenames and comments are rewritten**; symlinks and non-regular SQL entries; and a missing directory. These identifiers remain blocked even for a future legitimate Production feature rollout until separately reviewed and approved. This is static detection, not a proof that every unsafe possible SQL rewrite is detectable.
2. .github/scripts/test-supabase-production-intake.mjs uses Node's built-in test runner and temporary synthetic file fixtures. The original seven tests cover a safe migration, all three forbidden versions, renamed-version bypass, new _dev suffix, two header-marker cases, and missing migration directory. Three additional tests reject retimestamped/renamed copies referencing known Development-only UI-02/UI-34 objects, multiline SQL block comment headers, and SQL symlinks.
3. .github/workflows/supabase-production-intake-guard.yml runs the negative fixture tests then the migration scanner on **every pull request** (no path filter), merge-queue groups when applicable, protected-main pushes, and manual dispatch. GitHub path-filtered workflows can leave required checks pending on unrelated PRs, and merge queues need merge_group checks. This broader trigger increases read-only CI execution, with no database secrets or connections. Checkout and Node setup use pinned repository-reviewed action SHAs. Permissions are read-only, and no secrets or database connections are used.

The local precommit synthetic suite was 7/7 PASS, and an injected known Dev-only SQL file was rejected with a nonzero exit. This is local test evidence, not a claim about GitHub Actions or branch protection.

**Boundary:** A Draft guard is NOT yet enforced on protected main. Even after a separately authorized merge, a CI job that is not a required branch-protection check cannot guarantee merge blocking, and no CI scan can prevent an operator from manually invoking db push. Make the guard required on protected main before relying on it.

Once live, the guard intentionally FAILS PR #1022 or #1028 until the three SQL files are safely removed from the standard Production migration intake with a separately reviewed plan preserving Development's already-applied version provenance. Do not weaken tests merely to make those PRs green.

## Independent follow-up: safe Development provenance preservation (proposal only)

Do **not** move or edit the original migrations in #1022/#1028 as part of this guard PR. Their Development ledger entries already exist, while Production has none. A file move by itself does **not** remove an applied Development migration ID or make a Development checkout ready for further migrations. Supabase compares the migration versions in `supabase/migrations` against `supabase_migrations.schema_migrations`; moving these files outside the normal directory will make their IDs appear **remote-only** from a checkout using the normal directory.

The proposed staged, separately approvable design:

1. **Freeze lineage.** Independently verify each source's complete bytes and immutable source commit before any relocation. Original filename, version, source PR, Git blob, verified SHA-256, Development ledger presence and Production absence belong in a reviewed manifest. Current source Git blobs (not replacements for SHA-256): `20261030214706` = `4ebdeb72cfb140ea8bd24ae0f84f91b3e81b5762` in #1022; `20261030221037` = `0df302812a95982b7c0d9dbdbe5fc983849ccc5a` in #1022; `20261030234009` = `63a15deb451704efa94e6f0f6a561fe1b817d01d` in #1028. The first and third sources already document SHA-256 in their Draft PR descriptions; independently calculate and verify **all three** before changing files.
2. **Propose an inert archive**, e.g. `supabase/development-applied-archive/ui02-ui34/` (outside the CLI's migration discovery path). Preserve original full SQL bytes and filenames plus manifest. This is for provenance only: it is NOT a runnable Development migration source and must not be treated as a replacement for the remote ledger.
3. **Separately design Development execution source reconstruction.** In an isolated, offline validation checkout, assemble the *complete* historical Development `supabase/migrations/` source set with the same applied version IDs. Prove how future Development-only operations avoid remote-only versions and the separate 19/18 ledger differences. Require an explicit per-environment target-binding check and deny any Production-target execution. Do not create an automatic `db push` shortcut.
4. **Add no-write CI evidence** for archive integrity, source-to-manifest SHA-256 matches, duplicate version prevention, and absence of all three SQL files and reserved identifiers from merge-ready Production intake. Intentionally injected Development-only SQL must fail. Prove the reconstructed Development migration tree in an isolated environment before amending upstream PRs.
5. **Obtain separate approvals** for archive/relocation and for the #1022/#1028 source changes. Confirm both remote ledgers are unchanged before and after. No migration repair, SQL replay, Production schema rollout, or release activation is implicit.

**Stop conditions:** any unsigned/unknown source hash, missing historical Development version, revised Production remote version, unresolved ledger/schema mismatch, or tool proposing `db push`, `migration repair`, `db reset`, or live SQL. The existing stricter Development runbook and separate F2 signed two-user testing gate remain authoritative.

References:
- https://supabase.com/docs/reference/cli/supabase-migration-list
- https://supabase.com/docs/guides/deployment/database-migrations
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks

## Acceptance plan

- [ ] Independent source review of this Draft PR plus exact GitHub Actions negative fixture run.
- [ ] Separate owner approval for the guard merge, then independently verify the required status-check policy.
- [ ] Reconcile local/Development/Production migration inventories, including the unrelated 19/18 drift, before proposing migration relocation. Preserve the applied Development migration-version audit trail. No history repair or migration replay now.
- [ ] Design an explicit nondeployable Development SQL source and test its complete migration-history behavior in an isolated environment before changes to #1022/#1028.
- [ ] Confirm all three known versions are absent from any merge-ready Production intake, with fail-closed CI.
- [ ] F2 remains separate: execute owner-authorized two-distinct-signed-user synthetic RLS negative tests with no real accounts; static pg_policies and handler mocks are not signed-session PASS.
- [ ] F3 deletion-pending export requires an explicit owner privacy decision. F4 export compatibility and F5 bounded video-preference fetch remain subsequent scope.

Supabase CLI documentation:
- https://supabase.com/docs/reference/cli/supabase-migration-list
- https://supabase.com/docs/reference/cli/supabase-db-push
- https://supabase.com/docs/reference/cli/supabase-migration-repair

Verdict: F1 BLOCK until guard + safe migration-source design are both accepted; F2 NOT VERIFIED. No Production or Development SQL writes, merge, deployment, user access, entitlement changes, or release-hold removals are authorized.
