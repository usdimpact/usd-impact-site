# F4 account export function signature — isolated PostgreSQL evidence (Draft / HOLD)

**Scope:** Read-only source evidence, synthetic local database tests only. **DO NOT MERGE, DEPLOY, APPLY MIGRATIONS, OR ENABLE ACCOUNT/MEDIA FEATURES.**

## Source owner and exact identities

- Protected main at the overlap preflight: `b3fde241de839a0067a2f61f52223bf366a58964`.
- Authoritative upstream [Draft PR #1022](https://github.com/usdimpact/usd-impact-site/pull/1022): `9622efec7a164ac076bc2ef7d69519e01ff05c87`. This QA branch is a **separate agent/** branch based on that exact commit. The source PR stays Draft.
- Stacked [Draft PR #1028](https://github.com/usdimpact/usd-impact-site/pull/1028) owns UI-03 media-language source at `dd0146eb11478891eeb1c2e663f4178d5cbe17c2`. Do **not** rebase or edit it from this QA branch.

## Confirmed code-to-PostgreSQL contract

| Source | Function or call | Execution and ownership behavior |
| --- | --- | --- |
| `supabase/migrations/20260729203000_paid_access_foundation.sql` | `public.account_export(export_account_id uuid)` | `SECURITY DEFINER`, explicit authenticated EXECUTE / anon revoke, `WHERE export_account_id = auth.uid()`, seven legacy JSON keys |
| `apps/web/src/lib/supabase-server.js:exportOwnAccount` | `POST /rest/v1/rpc/account_export` JSON `{export_account_id: user.id}` | Calls the **one-argument** function; verifies user through its existing server-side Auth logic |
| `supabase/migrations/20261030221037_ui02_language_privacy_lifecycle_dev.sql` | `CREATE OR REPLACE FUNCTION public.account_export()` | **New zero-argument overload**, default `SECURITY INVOKER`, adds `transactionalLanguagePreference`; does **not** replace the legacy function |
| Stacked UI-03 `20261030234009_ui03_account_media_locale_preview_dev.sql` | `CREATE OR REPLACE FUNCTION public.account_export()` | Replaces **zero-argument** overload again, adds `mediaLanguagePreference`; leaves original one-argument API untouched |

PostgreSQL identifies functions by **name plus argument types**; `CREATE OR REPLACE` with different arguments creates a second function. PostgREST maps named request parameters to the matching overload. References: https://www.postgresql.org/docs/current/sql-createfunction.html and https://docs.postgrest.org/en/stable/references/api/functions.html .

**Additional security-review concern:** The new zero-argument function has no explicit `REVOKE EXECUTE FROM PUBLIC` statement in its already-applied Dev migration, so normal PostgreSQL default function EXECUTE grants may apply, even though its `auth.uid()` guard should prevent data selection for anonymous users. Confirm actual `pg_proc` ownership, `prosecdef`, `proacl`, effective roles, and PostgREST schema exposure under a **separately authorized read-only collector**. Do not infer a real exploitable data leak from source alone. The UI-02 SQL comment saying the existing export remains SECURITY INVOKER does not describe the original one-arg SECURITY DEFINER function.

## Evidence scope

`apps/web/scripts/test-f4-account-export-overloads-qa.mjs` builds an isolated PGlite database using entirely synthetic identities. It reads and executes **the actual original one-arg SQL definition and the actual already-Dev-applied UI-02 zero-arg SQL definition** from the pinned source tree. Its fixture simulates the minimal required tables, JWT subject and active-profile RLS, then tests:

1. The old seven-key self-export and denial of cross-account export.
2. PostgreSQL `pg_proc` catalog confirms **two distinct function signatures** with the expected invoker/definer flags.
3. The application-compatible one-arg call continues to return only old keys, not newly declared language preferences.
4. The new zero-arg caller-specific SQL returns the transactional preference but does not fix the application's named-arg route.
5. Effective anon/authenticated function execution grants are distinct.
6. Under the fixture's active-only preference RLS, moving a synthetic profile into `deletion_pending` makes the retained preference invisible in the invoker function. This demonstrates a possible F3 behavior, **not** an approved privacy policy.

The stacked UI-03 function is source-reviewed but **not executed** here because this isolated QA branch intentionally starts at #1022's upstream head rather than importing dependent PR files. The test is **not** a signed PostgREST/Auth test and has no connection to any Supabase project.

## Required corrective sequence — separate authorization

1. **F1 first:** preserve applied Development migration bytes and finish full Development-history compatibility. Do not edit the two already-applied Dev SQL files in place, re-timestamp them, or run `db push`, `migration repair`, or `apply_migration` as a shortcut.
2. **F3 owner privacy decision:** choose and document whether an authenticated `deletion_pending` account may still export retained locale preferences, consistent with privacy rights and deletion timeline; pending-state writes must remain denied.
3. **F4 additive correction:** design a **new, separately reviewed Development-only** change to the existing `account_export(export_account_id uuid)` contract. Preserve all seven legacy keys, explicit self-identity check and verified-role access; add both locale fields under the approved privacy policy. Select SECURITY INVOKER vs DEFINER based on actual RLS/table visibility and least privilege—not to work around missing permissions. Any zero-arg overload hardening/removal requires a separate grant/compatibility review. Keep the caller JSON parameter contract unchanged until fully verified.
4. **F2 and F4 validation:** authorized distinct synthetic signed users A and B; prove A cannot export B, anonymous requests fail, the exact `{export_account_id: A}` POST carries the new keys plus all seven old keys, and pending/deleted behavior matches the signed-off F3 decision. Test PostgREST schema cache and changes with an actual isolated environment only after approval.
5. Finally rerun the merged Production migration-intake guard and all exact-head upstream and stacked CI. Continue to hold release, commerce, Spanish narration and access flags.

**Present status:** F4 mismatch demonstrated; no remediation deployed or merged. PGlite proves SQL overload behavior, not live database reconciliation, public Data API exposure, RLS negative-test certification or privacy approval.
