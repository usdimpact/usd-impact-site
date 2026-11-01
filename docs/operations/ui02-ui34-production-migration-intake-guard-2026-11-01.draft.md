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

1. .github/scripts/check-supabase-production-intake.mjs scans the checked-out supabase/migrations SQL directory, not a live database. It refuses the three known version IDs even after a rename; filenames ending _dev.sql; SQL header declarations saying Development-only or NOT a Production migration; symlinks and non-regular SQL entries; and a missing directory.
2. .github/scripts/test-supabase-production-intake.mjs uses Node's built-in test runner and temporary synthetic file fixtures. Seven tests cover a safe migration, all three forbidden versions, renamed-version bypass, new _dev suffix, two header-marker cases, and missing migration directory.
3. .github/workflows/supabase-production-intake-guard.yml runs the negative fixture tests then the migration scanner on **every pull request** (no path filter), protected-main pushes, and manual dispatch. GitHub path-filtered workflows can leave required checks pending on unrelated PRs, so the gate must emit a stable check on all PRs. This broader trigger only increases read-only CI execution; no database secrets or connections are used. Checkout and Node setup use pinned repository-reviewed action SHAs. Permissions are read-only, and no secrets or database connections are used.

The local precommit synthetic suite was 7/7 PASS, and an injected known Dev-only SQL file was rejected with a nonzero exit. This is local test evidence, not a claim about GitHub Actions or branch protection.

**Boundary:** A Draft guard is NOT yet enforced on protected main. Even after a separately authorized merge, a CI job that is not a required branch-protection check cannot guarantee merge blocking, and no CI scan can prevent an operator from manually invoking db push. Make the guard required on protected main before relying on it.

Once live, the guard intentionally FAILS PR #1022 or #1028 until the three SQL files are safely removed from the standard Production migration intake with a separately reviewed plan preserving Development's already-applied version provenance. Do not weaken tests merely to make those PRs green.

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
