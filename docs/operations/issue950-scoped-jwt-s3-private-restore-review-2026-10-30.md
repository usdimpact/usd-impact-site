# Issue #950 — Session-token S3 transfer as an RLS-scoped alternative (REVIEW ONLY)

**Status:** unapproved architectural candidate, source-only SQL templates, disposable in-memory PostgreSQL proof. **No SQL applied to either real project, no synthetic users created, no JWTs issued, no real Storage files read, copied or exposed.**

## Verified provider support and current project evidence

Supabase's October 2026 [S3 Authentication](https://supabase.com/docs/guides/storage/s3/authentication) documentation explicitly supports **Session Token authentication with a user JWT** and states that these operations respect Storage RLS. Its generated S3 access keys, in contrast, have **full access across all buckets and bypass RLS**. The session-token option is the preferred candidate to review **instead of** provisioning such unrestricted S3 keys for Issue #950.

**Important compatibility condition:** the documented S3 session-token authentication uses the project reference as `accessKeyId`, the **legacy anon key** as `secretAccessKey`, and the authorized user's **signed JWT** as `sessionToken`. The guide says the newer `sb_publishable_` key is **not yet supported** for this S3 mode. **Read-only compatibility check on October 30, 2026:** Supabase Management returned an enabled legacy `anon` JWT-form key for **both** Development and the isolated restore; none of the key values were displayed or copied. This clears the *key-present* prerequisite only. **No signed user JWT or S3 session-token request has been tested against either provider**, so real compatibility, disabled sign-in-provider behavior on the restored project and request/RLS mapping are still unverified. Never paste JWTs or any API keys in ChatGPT, GitHub, CI, shell logs or public incident records.

Read-only metadata queries on **both** existing projects, independently confirmed:

| Field | Development source | Isolated restore |
| --- | --- | --- |
| Supabase reference | `ycstrcvshdluovtuasjc` | `movnekagnxgcyenczfoc` |
| Storage `objects` RLS enabled | YES | YES |
| Storage `buckets` RLS enabled | YES | YES |
| Existing `storage.objects` policies | 0 | 0 |
| Existing `storage.buckets` policies | 0 | 0 |
| Authenticated SQL table privileges on `objects` | SELECT, INSERT, UPDATE, DELETE (subject to RLS) | Same |
| Private audiobook objects, exact manifest prefix | 20 | 20 |
| Private PDF objects, exact manifest prefix | 1 | 1 |
| Objects outside these two expected prefixes (within these two buckets) | 0 | 0 |
| Underlying private file bytes | Present in source, not inspected this review | **NOT recovered/verified** |

Both source and restored SQL catalogs contain exactly **21** private `storage.objects` metadata rows and matching metadata fingerprints; those facts **do not demonstrate that Storage bytes exist** in the clone.

## Four intentionally non-executable templates

These SQL candidates live under `docs/operations/candidates/`, **never** `supabase/migrations/`.

| File | Only intended project | Proposed RLS operations |
| --- | --- | --- |
| `issue950-s3-jwt-session-source.review.sql` | Source Development only | `SELECT` exactly 21 approved `storage.objects` names; read-only `SELECT` of two private `storage.buckets` |
| `issue950-s3-jwt-session-restore.review.sql` | Already-created isolated restore only | `SELECT`, `INSERT`, `UPDATE` only for the same 21 objects; private `buckets` `SELECT`; **no DELETE** |
| `issue950-s3-jwt-session-source-rollback.review.sql` | Source only, after transfer or abort | `DROP POLICY` for only the exact named temporary source policies |
| `issue950-s3-jwt-session-restore-rollback.review.sql` | Restore only, after transfer or abort | `DROP POLICY` for only the exact named temporary destination policies |

Both installation templates contain **invalid placeholders** for the project-local synthetic Auth user UUID, exact approved synthetic email, hard UTC expiry **and private, moment-of-execution server-host fingerprint**. Both real databases have an enabled `on_auth_user_created` trigger that ALWAYS creates a `public.profiles` row using `public.handle_new_auth_user()`. Consequently the preflight now **requires** an operator-confirmed, canonically linked but `suspended` synthetic profile, not an absent profile. It also requires admin-only `auth.users.raw_app_meta_data.issue950_scoped_s3` to equal `source` or `restore` respectively, email equality across Auth/profile, no active deletion timestamps, and **zero entitlements**. User-editable `raw_user_meta_data` is never trusted. Preflight additionally rejects disabled Storage RLS, unexpected existing Storage policies, public buckets, changed 21-key manifests and expiry outside the **next eight hours**. The `auth.uid()` predicate is restricted to that project's **exact synthetic account**, not to all `authenticated` users. Object names come from the immutable, committed private PDF/audio source manifests, **not** an unrestricted bucket wildcard.

**Not validated:** whether S3 `ListObjectsV2`, `GetObject`, `PutObject`, partial reads, multipart uploads and restored-existing-row overwrite semantics map to these particular `storage.objects`/`storage.buckets` RLS policies in both real projects. PGlite cannot prove provider operation mapping, signed JWT validation, Storage backend behavior, real content hashes, or physical file availability. Until separately tested, this is only a *candidate*, not a guaranteed S3 recovery path.

## Project identity and credential preflight (not a live authorization)

The original policy SQL commented the project IDs, but comments do not stop a DBA from applying a correct-looking temporary policy to the wrong database. An additional **fail-closed** check now requires a privately attested hash of `inet_server_addr()::text`. This is an **ephemeral supplemental host binding**, not a permanent project identity; infrastructure failover/change must cause the proposal to abort and require fresh review.

**Why not the PostgreSQL cluster identifier:** a read-only `md5(system_identifier::text)` from `pg_control_system()` unexpectedly returned the **same fingerprint on original Development, restored Development and Production**. Neither `system_identifier`, `current_database()=postgres` nor an Auth user count can safely distinguish these three. The current server-address fingerprints differ, but addresses may change and are neither a secret nor a cryptographic project attestation. **Never rely solely on the host check.**

A qualified operator must independently select the exact Supabase **Management project reference** and preapprove the intended source or clone, inspect the server host fingerprint using a read-only query on that selected project, and substitute the expected value privately in `__ISSUE950_SOURCE_SERVER_HOST_MD5__` or `__ISSUE950_RESTORE_SERVER_HOST_MD5__` together with that project's unique synthetic UUID/email and short expiry. The expected address and its hash **must not be committed to GitHub or printed in a public log**. If the project changed host between inspection and use, **STOP**; do not weaken the check or infer equivalence. The SQL guard must reject a missing/unexpected fingerprint **before any CREATE POLICY**.

This does **not** make standalone SQL safe to execute without independent DBA/security/privacy signoff. The only available Supabase connector actions in this session can inspect keys/project state and query PostgreSQL. They do **not** provide Supabase Auth Admin `createUser`/sign-in or S3 `GetObject`/`PutObject` capabilities. Never bypass this limitation by directly inserting into `auth.users` or `storage.objects` with SQL; Auth service and Storage API state would be inconsistent. Use a separately approved protected operator environment for the genuine provider session pilot.

## Synthetic provider acceptance — pending separate explicit approval

A qualified owner, DBA and security reviewer should decide whether to allow **temporary narrowly scoped RLS policies and newly created synthetic Auth users in the real Development and isolated restore**. This is a live privilege-surface change and is **not authorized merely by source-only PR approval**.

Before any permitted execution, require all of:

1. Confirm the two project references and the Production hard exclusion `gjzetjugmnwanvjkchux`. Confirm both are healthy, private buckets unchanged, no other policies, and the official 21-key counts/fingerprint unchanged. The restore must remain non-public, with Data API/signup/email disabled unless independently reviewed for a bounded synthetic test.
2. Separately provision one dedicated short-lived **noncustomer** Auth identity per project via an approved Admin-only process with exact approved test email and **app_metadata** marker `issue950_scoped_s3='source'|'restore'`. The actual `on_auth_user_created` trigger will automatically create an `active` application profile; the independently approved DBA must then set **only the exact new synthetic profile to `suspended`**, verify canonical `auth_user_id` equality and exact email, and confirm **zero** entitlements, purchases and other customer commerce records before adding any temporary Storage policy. `readAccountAccessState()` denies paid access for suspended profiles. Do not disable the creation trigger, re-use any of the nine copied identities, send a real email, or introduce synthetic entitlement/Research access. Record Auth UUIDs and the exact test email privately, never in public PR comments.
3. Verify **legacy anon-key compatibility** for S3 session-token auth on each project. Confirm the token is a real signed `authenticated` user session. Reject any `service_role`, `sb_secret_`, project-wide S3 access key or unrestricted key fallback. The JWT must stay within a restricted short-lived runner, not the web app or GitHub CI.
4. DBA and security jointly review and instantiate the **two exact project-local RLS templates**, substituting the independently verified synthetic UUIDs and an approved bounded UTC expiry no more than **eight hours** ahead. Confirm original RLS baseline and all existing rules before installing policies. Source must never gain INSERT, UPDATE or DELETE through the new policies.
5. In a dedicated fresh **all-synthetic** test environment, verify unauthorized JWTs cannot read, the source synthetic identity cannot write, and the destination synthetic identity cannot delete or write outside the 21-key allowlist. Do not use an attempted forbidden write as a test against the real Development source: if the permission model is wrong, that test could mutate live content.
6. In an approved private runner, attempt the smallest **read-only** real-source S3 pilot using the scoped session. Verify authentic file bytes and checksum in encrypted ephemeral memory, not stdout. On the isolated restore, perform a separately authorized ONE-object write/read pilot to confirm restored SQL metadata does not conflict with physical S3 objects. Stop on any 403/404/metadata conflict, wrong-project identifier or unexpected object count; **never** repair by deleting `storage.objects` rows manually.
7. If the pilot succeeds, prepare an exact, auditable private 21-file transfer using a session-token-capable AWS S3 client with strict project endpoint validation, bounded memory/streaming, disabled debug logs, **source GET only and destination PUT only**. Rclone session-token behavior has **not** been validated and must not be assumed. For each object, compare cryptographic SHA-256 of actual source and destination bytes, counts and types privately; post only aggregates.
8. In all successful, error or abort paths, run the reviewed **exact-name policy rollback** on each project, revoke both synthetic sessions/identities under separate approved Auth procedures, verify no temporary RLS policies or sessions remain and verify source Library Pass access still works. Document status without customer data. Do not stop at key expiration alone.
9. Continue to hold any account deletion, new claims/escrow SQL, real Auth Admin deletion, email, checkout, entitlements and Production changes until all **other** Issue #950 approval gates independently pass.

**Fallback:** If the legacy anon key is unavailable, RLS behavior differs, provider rejects a pre-existing metadata row, source integrity cannot be established or owners decline live policy/temporary-identity changes, stop. Reassess a **provider-assisted copy** or another separately approved mechanism. **Do not silently fall back to unrestricted generated S3 keys.**

## Synthetic PostgreSQL evidence

`apps/web/scripts/test-issue950-scoped-s3-jwt-rls-pglite.mjs` applies the exact four candidate files to **disposable in-memory PostgreSQL fixtures**, replacing only the intentionally invalid UUID/expiry placeholders with fake test values. It proves privileged source SELECT vs INSERT/UPDATE/DELETE denial, destination scope-limited INSERT/UPDATE but DELETE denial, stranger/anon denial, wrong bucket exclusion, 21-name manifest consistency, prevention of broad or public-bucket installs, trigger-created suspended synthetic profile tagged with admin-only app metadata and zero entitlements, bounded expiry preflight, fail-closed transaction rollback and restoration of zero client Storage policies following exact cleanup. JWT subjects in PGlite are **simulated session settings**, not actual signed GoTrue tokens.

The test itself has **no HTTP/S3 client, credentials, file contents, real projects or provider calls**. Its fixture now models `on_auth_user_created` inserting the initial active profile, enforces the explicit admin suspension transition, a signed-user claim, admin-only app metadata and exact email identity, and denies any synthetic subject with entitlements. CI is PR-only, without provider environment secrets.

## Release decision and cost

This potentially resolves the **unrestricted-S3-credential risk in architecture**, but does not resolve **physical Storage byte recovery** until a real approved, protected pilot and end-to-end transfer. The isolated restore remains billable (~$9.68/month plus usage), tracked for separate owner-approved cleanup in [Issue #978](https://github.com/usdimpact/usd-impact-site/issues/978). The 60-minute audiobook/5-minute PDF previously issued signed-URL residual access window is a separate security/privacy decision, not addressed by copying files.

**Owner approval for this Draft does not authorize installing RLS policies on Development/restore, issuing Auth identities/JWTs, operating private files, modifying SQL on any real project, merging, or Production deployment.**

References: [Supabase S3 Authentication](https://supabase.com/docs/guides/storage/s3/authentication) · [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) · [Storage Schema](https://supabase.com/docs/guides/storage/schema/design) · [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950).
