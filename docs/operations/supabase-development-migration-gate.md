# Supabase Development migration gate

## Purpose

This runbook controls the future Development-only test of
`20260805194908_secure_future_public_object_defaults.sql`.

It is deliberately fail-closed. The migration must not be applied until every
prerequisite below is complete and a separate, explicit approval authorizes the
database change.

## Safety boundary

- The only permitted target is `usd-impact-development`.
- `usd-impact-production` is observation-only throughout this runbook.
- Do not use the SQL Editor, `db push`, `apply_migration`, migration
  repair, reset, restore, or branch merge during the preparation phases.
- `execute_sql` is prohibited except for the single read-only metadata
  collector exception defined in Phase 1. That exception requires a later,
  separate approval and does not authorize migration SQL, ad-hoc queries, or
  any database write.
- Never paste database passwords, access tokens, service-role keys, connection
  strings, or other secrets into GitHub, chat, screenshots, or evidence.
- Stop if any screen, command, or connector identifies Production as the target.
- Stop if a tool proposes more than the one approved migration.

## Known baseline — 2026-08-05

| Item | Development | Production |
| --- | --- | --- |
| Project name | `usd-impact-development` | `usd-impact-production` |
| Project reference | `ycstrcvshdluovtuasjc` | `gjzetjugmnwanvjkchux` |
| Health | `ACTIVE_HEALTHY` | `ACTIVE_HEALTHY` |
| PostgreSQL | 17.6 | 17.6 |
| Latest recorded migration | `20260804234558_store_guided_supplements_privately` | `20260804160932_optimize_rls_and_foreign_key_indexes` |
| New hardening migration recorded remotely | No | No |

Production records the complete 11-migration commercial foundation through
`20260804160932`. Development contains the matching commercial schema and five
later Guided Edition migrations, but its migration ledger omits ten historical
commercial entries. This is ledger divergence, not a normal one-file pending
migration.

The ten Development ledger entries requiring separate reconciliation are:

1. `20260731144500_webhook_receipt_service_role_grants`
2. `20260731160000_paddle_checkout_completed`
3. `20260731210000_paddle_adjustment_revocation`
4. `20260731213000_paddle_adjustment_amount_recovery`
5. `20260731215500_paddle_adjustment_enum_fix`
6. `20260731225000_paddle_dispute_lifecycle`
7. `20260731231500_paddle_transaction_recovery`
8. `20260803190000_guided_edition_launch_window`
9. `20260804154505_supabase_security_hardening`
10. `20260804160932_optimize_rls_and_foreign_key_indexes`

Do not replay their SQL. They may be marked as applied in Development only
after the metadata comparison below proves that the corresponding schema is
already present.

Development also records these five Guided Edition migrations, which are not
yet part of `main` and must not be lost or ignored by the eventual execution
source:

1. `20260804163445_guided_edition_progress_foundation`
2. `20260804170311_reset_guided_progress_on_content_version_change`
3. `20260804172251_store_guided_content_privately`
4. `20260804174902_publish_guided_content_catalog`
5. `20260804234558_store_guided_supplements_privately`

Do not run `db push` from `main` while these remote-only versions are unresolved.
The eventual approved execution source must account for the complete
Development history, not only the migrations currently merged into `main`.

## Phase 1 — read-only metadata reconciliation

Capture metadata from Development and Production without rows, secrets, or
customer content. The reviewed source collector is
`supabase/diagnostics/public_metadata_snapshot.sql`. It produces one
deterministically ordered JSON document inside a repeatable-read, read-only
transaction and queries PostgreSQL catalogs only.

Committing the collector does not authorize execution. Do not run it against
either project until a separate approval identifies both exact projects and a
private evidence-handling location. That later approval may permit
`execute_sql` only under all of these controls:

- the payload is byte-for-byte identical to
  `supabase/diagnostics/public_metadata_snapshot.sql` at the approved commit;
- one call is made to `usd-impact-development`
  (`ycstrcvshdluovtuasjc`) and one call to `usd-impact-production`
  (`gjzetjugmnwanvjkchux`), with the project identity checked before each call;
- no statement, comment, wrapper, variable, or retry logic is prepended,
  appended, or substituted;
- the collector's read-only transaction, bounded timeouts, catalog-only
  queries, deterministic output, and final `ROLLBACK` remain intact;
- the operator stops after the first unexpected result instead of modifying or
  retrying the query;
- raw snapshots stay in the approved private evidence location and are never
  committed, pasted into an issue or pull request, or published.

This is the only connector-SQL exception in the preparation phases. It does not
permit a migration, ledger repair, schema change, application-row query, Auth or
Storage query, or any Production write. Keep generated snapshots out of Git
because function bodies and access-control metadata are operational evidence.

Compare the common commercial objects and record differences for all of the
following:

- schemas, tables, columns, generated types, constraints, and enums;
- sequences and ownership;
- functions, argument and return signatures, complete function bodies,
  volatility, security mode, owner, and `search_path`;
- triggers and trigger functions;
- row-level-security enablement, forced-RLS state, and policy definitions;
- table, sequence, schema, and function grants;
- default privileges for every relevant object-creating role;
- indexes, uniqueness, predicates, expressions, and foreign-key indexes;
- enabled extensions and versions.

Pass condition: every object represented by the ten historical migrations is
equivalent in Development, with only the five documented Guided Edition changes
allowed as Development-only additions.

Stop if an object is missing, a function body differs unexpectedly, a grant is
broader, RLS is disabled, an index is missing, or the comparison is incomplete.
Do not repair the ledger while any uncertainty remains.

## Phase 2 — advisor review

Record the Supabase Security and Performance Advisor results before any write.
The 2026-08-05 read-only baseline is identical in both projects:

- six informational `RLS Enabled No Policy` notices on intentionally private,
  service-managed tables;
- warnings for authenticated execution of the `account_export` and
  `request_account_deletion` `SECURITY DEFINER` functions;
- one warning that leaked-password protection is disabled.

The function warnings require an explicit source and authorization review. Each
function must enforce the intended caller identity internally, use a controlled
`search_path`, expose only the minimum required grant, and avoid trusting a
caller-supplied account identifier. The leaked-password setting is a separate
manual security task.

Pass condition: no new Security Advisor warning or error, and every existing
warning is either fixed in a separate reviewed change or documented as an
intentional, tested exception.

References:

- [Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)

## Phase 3 — Development ledger reconciliation

This is a future write operation and needs separate approval.

Only after Phases 1 and 2 pass, prepare an exact ten-entry Development-only
migration-repair plan. A second person must compare every version against the
approved list above. The plan must mark existing migrations as applied without
executing their SQL.

Required evidence after the repair:

- Development remains `ACTIVE_HEALTHY`;
- all ten historical versions appear exactly once;
- the five Guided Edition versions remain exactly once;
- Production migration history is byte-for-byte unchanged;
- no table, function, trigger, policy, grant, index, row, Auth user, or Storage
  object changed as a side effect.

Before advancing, verify that the controlled execution source accounts for all
five Development-only Guided Edition versions. Stop if a migration tool reports
remote migrations that are absent locally, requests `--include-all`, or proposes
replaying any historical SQL. Resolve the source graph through reviewed Git
history; do not work around it with a broad push.

Stop if the repair tool targets Production, proposes an unlisted version, or
offers to execute migration SQL.

## Phase 4 — final pre-application gate

After ledger reconciliation, repeat the migration comparison. Exactly one new
source migration may be pending:

`20260805194908_secure_future_public_object_defaults.sql`

Before applying it to Development, require all of the following:

- [ ] Development is `ACTIVE_HEALTHY`.
- [ ] Production is `ACTIVE_HEALTHY` and observation-only.
- [ ] A fresh Development backup is visible and its UTC timestamp is recorded.
- [ ] No restore operation is active.
- [ ] The exact migration file on the approved commit has been reviewed.
- [ ] Web quality passed on that exact commit.
- [ ] The metadata comparison and advisor evidence are attached to the review.
- [ ] The tool preview shows Development and only one pending migration.
- [ ] Operator 1 states the Development project name and reference aloud.
- [ ] Operator 2 independently verifies the target and proposed operation.
- [ ] The owner gives a separate explicit approval for the Development write.

## Phase 5 — future Development application

This phase is not authorized by committing this runbook.

Use a migration mechanism that preserves the source version and records the
approved file exactly once. Do not use an ad-hoc SQL Editor execution. Capture
only non-secret output. If the transaction fails, preserve the error and stop;
do not retry repeatedly or switch to Production.

The migration is transaction-wrapped. Its intended effects are limited to:

- revoking automatic API-role privileges from future public tables;
- revoking automatic API-role privileges from future public sequences;
- removing default `PUBLIC` and API-role execution from future functions
  created by `postgres`;
- refusing to commit if an existing ordinary or partitioned public table lacks
  RLS.

It must not normalize existing object privileges, modify application rows, or
change Production.

## Phase 6 — post-application verification

Immediately after the future Development application:

- [ ] Development is `ACTIVE_HEALTHY`.
- [ ] The new migration version appears exactly once in Development.
- [ ] Production migration history is unchanged.
- [ ] All public ordinary and partitioned tables still have RLS enabled.
- [ ] Existing table, sequence, function, policy, and grant definitions are unchanged.
- [ ] Future table and sequence defaults do not grant API-role access automatically.
- [ ] Future functions created by `postgres` do not grant `PUBLIC` execution automatically.
- [ ] The complete automated validation suite and production build pass.
- [ ] Security and Performance Advisors show no new warning or error.
- [ ] Account, Guided Edition, Paddle sandbox, and protected-content smoke tests pass.

## Failure and rollback rule

If the migration fails before commit, rely on the transaction rollback and
investigate the first error. Do not rerun until the cause is understood.

If an unexpected problem is found after commit, do not restore either project
in place. Open an incident, preserve evidence, and prepare a reviewed
compensating migration. Default privileges affect future objects, so record the
pre-change defaults before application and remember that reverting defaults
does not retroactively change objects created while the new defaults were active.

## Production gate

Successful Development testing does not authorize Production. Production needs
its own fresh backup, full evidence review, two-person confirmation, explicit
owner approval, low-risk maintenance window, and post-application verification.
The 2026-08-05 restore incident checklist remains mandatory.

## Beginner summary

1. Do not apply the new migration yet.
2. First prove that Development's existing schema matches the historical files.
3. Then, with separate approval, repair only the missing Development ledger rows.
4. Confirm that exactly one migration remains pending.
5. Obtain a fresh backup and two-person confirmation.
6. Apply only to Development after a new explicit approval.
7. Verify everything again before considering Production.

This document is a safety plan, not permission to change a database.
