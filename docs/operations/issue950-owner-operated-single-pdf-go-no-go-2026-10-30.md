# Issue #950 — Owner-operated single-PDF pilot: GO / NO-GO and incident playbook

**Review-only. Owner risk exception recorded; current live-operation verdict: NO-GO until operator prerequisites PASS.**
Owner decision: [Issue #950, comment 6527985148](https://github.com/usdimpact/usd-impact-site/issues/950#issuecomment-6527985148). The owner has no independent DBA/security/privacy reviewers; no independent approval is claimed. This is a **conditional one-file, non-Production exception only**, not a release or full restore approval.

## Immutable identifiers — DO NOT broaden

| Item | Value / restriction |
| --- | --- |
| Destination | Supabase **isolated restore** project **`movnekagnxgcyenczfoc`** only |
| Original Development | `ycstrcvshdluovtuasjc` — **no new policies, private source GET, or writes** for first PDF pilot |
| Production | `gjzetjugmnwanvjkchux` — **hard exclusion** |
| Target bucket | `library-pass-books`, private |
| Exact object key | `book/read-the-dollar-first/edition-1.3/USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf` |
| Approved offline source | Owner-supplied licensed PDF, **2,281,645 bytes** |
| Canonical SHA-256 | `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666` |
| API method | **one authorized** Storage REST upload at existing key with `x-upsert: true` and authenticated synthetic JWT; provider-confirmed in SU-531190 |
| Allowed temporary RLS | One synthetic Auth UID; `storage.objects` SELECT, INSERT, UPDATE with exact path; private books bucket SELECT; **no DELETE** |
| Expiry | Installed policy expires within **2 hours**. JWT must be suitably short-lived and its final expiry/access revocation checked |
| Forbidden | `service_role`, secret/system keys in local upload client, public buckets, extra file uploads, direct `storage.objects` DML, migration/PR merge, new clone, Production changes, customer auth, account deletion |

## Owner self-check record — fill privately and post only redacted PASS/STOP to Issue #950

* **Owner exception:** APPROVED (as recorded), not independently reviewed
* **Provider technical compatibility:** PASS — ticket SU-531190, October 30 16:00 UTC
* **Offline SQL scope tests:** PASS at [Draft #1011](https://github.com/usdimpact/usd-impact-site/pull/1011) once exact-head CI has completed; **rerun after any source change**
* **Target project state:** READ-ONLY PASS at last check (21 Library rows; two private buckets; zero temporary Storage policies/users; no pending deletions), **RECHECK immediately before live execution**
* **PDF actual bytes:** PASS in the current owner-provided private copy; **RECHECK on operator workstation immediately before any request**
* **Read-only owner workstation file check:** **OWNER-REPORTED PASS (October 30, 2026)** in direct reply to the local PDF preflight instructions; [Issue #950 evidence](https://github.com/usdimpact/usd-impact-site/issues/950#issuecomment-6528979786). This is an owner statement, **not** independently witnessed execution or a new authenticated transcript; the four script markers were not reproduced. Recheck on the protected operator workstation against the exact source immediately before any actual request. CI proves synthetic negative cases only.
* **DB host binding available:** READ-ONLY PASS that `inet_server_addr()` is non-null; matching private fingerprint not attested or installed; do not print host details or private substitute values in GitHub
* **Protected local operator client:** **OFFLINE REQUEST-ENVELOPE CANDIDATE PREPARED; LIVE CLIENT NOT READY / NOT VERIFIED**. The [review-only Windows REST envelope preflight](candidates/issue950-pdf-only-rest-envelope-preflight.review.ps1) pins one restore host and exact PDF and refuses broad credential environment variables, with **no network capability**. A separate future protected uploader/downloader must still prove JWT handling, non-redirected one-attempt transport, exact-object REST operations and cleanup; this offline script cannot send or authenticate
* **Synthetic Auth user:** **NOT CREATED**. Must be a noncustomer account in the isolated restore, with admin-only `app_metadata` marker, application profile suspended, and zero entitlements; never co-opt an existing customer/user. No credentials in chat/issues/CI
* **Exact-path temporary RLS:** **NOT INSTALLED**. Review-only SQL has invalid placeholders; obtain and verify the actual restore-specific replacements privately, only after other GO gates pass
* **Emergency/rollback capability:** **NOT VERIFIED IN PROVIDER**. Owner must have a proven way to remove precisely the four expected policies and revoke/expire access without using broad credentials in the upload client
* **External rights/legal restrictions:** Owner must confirm no binding external requirement mandates an independent reviewer, and the private PDF is authorized for this internal test
* **Live one-PDF upload:** **NOT EXECUTED**; NO-GO until every incomplete item is answered
* **Actual restore download SHA-256:** **NOT EXECUTED** (0/21 verified restored bytes)
* **Cleanup and no-access proof:** **NOT EXECUTED**

## Canonical 21-object metadata reconciliation — 2026-10-30 (read-only PASS)

A new paired, **SELECT-only** reconciliation compared all canonical paths, byte lengths, and MIME types from protected-main `apps/web/src/lib/private-audiobook.js` (blob `98f5209e825a63baeb6fc386a958fb5eee9a22bc`) and `apps/web/src/lib/private-book.js` (blob `df050fe7c3820785c4e3dedc532c352662b764d2`) against the exact two private Library buckets in **Development** (`ycstrcvshdluovtuasjc`) and **isolated restore** (`movnekagnxgcyenczfoc`).

| Check | Development | Isolated restore |
| --- | ---: | ---: |
| Canonical 20 MP3 + 1 PDF records | 21 | 21 |
| Missing entries | 0 | 0 |
| Unexpected entries | 0 | 0 |
| Byte-length mismatches | 0 | 0 |
| MIME mismatches | 0 | 0 |
| Sum of metadata-declared bytes | 374,929,235 | 374,929,235 |

This confirms a full canonical **metadata manifest match** on both projects without changing files, policies, users or permissions. It **does not demonstrate that the isolated restore has the physical bytes**. Verified restored-byte count remains **0/21**. The already byte-verified off-platform PDF and first English MP3 copies remain **2/21 offline recovery candidates**, not restored content.

## Verified Auth exposure inventory — 2026-10-30

The owner approved **read-only double-checking**, and two aggregate-only SELECT statements from the companion `Issue950_Auth_ReadOnly_Risk_Preflight_2026-10-30.sql` were executed against **isolated restore `movnekagnxgcyenczfoc` only**. Results:

| Confirmed aggregate measure | Verified value |
| --- | ---: |
| `auth.users` | **9** |
| Confirmed email users | **9** |
| Users with non-empty stored password hashes | **9** |
| `auth.identities` with `provider='email'` | **9** |
| `auth.sessions` records | **85**, **not proof that 85 sessions are active** |
| Issue-scoped synthetic recovery users | **0** |
| Private Library buckets | **2** |
| Library Storage metadata records | **21** |
| Temporary Storage policies | **0** |
| Pending account deletions | **0** |

**NO-GO on enabling Email as a shortcut.** All nine restored users have confirmed email identities and stored password hashes, so enabling the Email provider could allow existing accounts to authenticate. Public signups being disabled does **not** isolate the new synthetic user from these existing restored accounts. The 85 historical session records must not be misrepresented as currently active; password/sign-in exposure is still a material project-wide risk. Password protection settings shown by the owner (minimum six characters, leaked-password protection OFF, other change safeguards OFF) are additionally weak.

The sole-owner one-PDF exception remains valid, but **does not approve** this broader Auth provider change. Leave Email and all other providers disabled, leave the nine accounts untouched, and await Supabase Support's answer about a supported synthetic authenticated user session while all providers remain disabled. The focused Storage REST `x-upsert:true` method itself remains separately provider-confirmed. No user, JWT, SQL policy, file upload/download, merge/deploy, account deletion, or Production change was performed in this double-check.

## New owner-supplied Auth provider finding (NO-GO, 2026-10-30)

Owner screenshots of the **isolated restore** `https://supabase.com/dashboard/project/movnekagnxgcyenczfoc/auth/providers` show **Allow new users to sign up: OFF**, **Email provider: DISABLED**, **Phone provider: DISABLED**, **all displayed third-party/social providers: DISABLED**, **Allow anonymous sign-ins: OFF**, and **Confirm email: ON**. Screenshots were read-only; no setting was changed. Exact RESTORE project ref was visible in the URL. The existing nine restored users and current Storage metadata were reverified via SELECT-only SQL.

**Critical consequence:** The planned new synthetic user's email/password sign-in cannot be assumed functional while **Email provider is disabled**. The Dashboard's `Create new user` form by itself does not issue a tested Auth session/JWT. A protected Auth method must be demonstrated before creating a new user, enabling a Storage policy or attempting private file transfers.

**Alternatives requiring separate risk analysis:** (A) Temporarily enable **Email authentication on the isolated restore only**, with **public signup kept OFF**, prove login with exactly one dedicated noncustomer synthetic identity, then restore the original Auth configuration after the controlled test; this provider switch is **project-wide**, could permit password logins by the nine existing restored accounts, and is NOT yet approved/executed. (B) Request a documented supported Supabase method for issuing a short-lived **authenticated user JWT** on the isolated restore while Email and all other sign-in providers remain disabled, without using broad `service_role`, JWT signing secrets or SQL edits to `auth.users`. Do not invent or silently substitute a custom-signed token.

**Current GO verdict: NO-GO** on Auth/session readiness and upload. A new positive decision must identify the provider path, risks to the existing users, how to obtain the `app_metadata` marker and suspended profile through supported admin operations, authenticated session lifetime, rollback to initial provider state, and a protected local client. Any external security/privacy requirements remain in force. Until then **leave Email and every other provider disabled; do not click Save changes, Add/Create user, or upload an object.**

## Authentication provider blocker — 2026-10-30

**Observed in the owner-provided isolated-restore Dashboard** and recorded in [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950#issuecomment-6529121806): Email and other visible sign-in providers are disabled, anonymous sign-in is disabled, public self-signup is off, and there are nine existing Auth users. The Admin "Create new user" form is insufficient as session evidence. The `on_auth_user_created` trigger creates an active application profile, so an unreviewed create-user action also fails the required suspended-profile check.

**Do not enable Email, create an Auth user, retrieve signing secrets, use service_role in a Storage client, call Admin generateLink, or install RLS solely to bypass this blocker.** Project-owner Dashboard access does not imply access to a user-scoped JWT. Admin `generateLink` with disabled Email provider is **not yet provider-verified**.

Two conditional alternatives, neither approved for execution:
1. Supabase Support confirms a documented short-lived synthetic authenticated-user session flow **without enabling sign-in providers**. Verify its session scope, private Auth Admin requirements, revocation/expiry, noncustomer identity and suspended profile *before* use; no existing user is eligible.
2. Owner separately accepts a narrowly time-boxed **Email-provider enablement** on this restore only, with signup still disabled and explicit acknowledgement that restored users may be able to authenticate during the window. Verify pre-existing accounts' exposure, exact rollback and session revocation. Provider disablement must **not** be presumed to invalidate issued JWTs.

The Auth-method clarification **was sent** in ticket **SU-531190 on October 30 at 18:03 UTC**. The connected Gmail thread currently contains no later support reply. **Do not resend a duplicate request.** Until Supabase confirms a viable restricted-session method and the operator passes objective exact-target and rollback checks, **live one-PDF upload remains NO-GO**.

## Safe preparation (no live Storage write)

1. Use the [isolated restore Dashboard](https://supabase.com/dashboard/project/movnekagnxgcyenczfoc) to recheck the project identifier. Cross-check through a separately obtained authorized project reference. Never trust the dashboard's generic branch/status label alone.
2. In [restore Storage](https://supabase.com/dashboard/project/movnekagnxgcyenczfoc/storage/buckets) and [restore Auth](https://supabase.com/dashboard/project/movnekagnxgcyenczfoc/auth/users), **inspect only** until the exact readiness gates are satisfied; no upload, object delete, user creation or policy installation now.
3. On the owner's private Windows machine, use the **read-only local source preflight** [`issue950-pdf-only-offline-source-preflight.review.ps1`](candidates/issue950-pdf-only-offline-source-preflight.review.ps1) from this exact protected Draft head. This uses built-in Windows PowerShell 5.1+ and **does not create tokens or make network requests**. It rejects the wrong project ref, missing file, wrong extension, wrong byte length, or SHA-256 mismatch. Run it only with the PDF held privately on the protected machine; do not paste the full local path into issues or ChatGPT:

   ```powershell
   & '.\\issue950-pdf-only-offline-source-preflight.review.ps1' -SourcePdf 'C:\\Path\\To\\Authorized\\Book.pdf' -DestinationProjectRef 'movnekagnxgcyenczfoc'
   ```

   Expected successful output includes `ISSUE950_LOCAL_SOURCE_SHA256_PASS`, `ISSUE950_DESTINATION_PARAMETER_PIN_PASS`, `ISSUE950_NO_NETWORK_OR_WRITE_ACTION_PERFORMED` and `ISSUE950_LIVE_RESTORE_STILL_NO_GO`. The `DestinationProjectRef` flag checks only the **operator-supplied text parameter**, not the identity of any live network connection. The script is not an authenticated uploader, does not verify a JWT, and cannot convert the live-operation NO-GO into GO.

   Alternative one-off built-in PowerShell commands (if you cannot acquire the script from the exact Draft head), with the actual local path substituted privately:
   ```powershell
   $f = 'C:\Path\To\Authorized\Book.pdf'
   $size = (Get-Item -LiteralPath $f).Length
   $digest = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLowerInvariant()
   if ($size -ne 2281645 -or $digest -ne 'b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666') {
     throw 'STOP: PDF checksum/size mismatch'
   }
   'LOCAL_PDF_SHA256_PASS'
   ```
3a. **Optional, zero-network REST request-envelope sanity check** on the same protected Windows device, using the [review-only script](candidates/issue950-pdf-only-rest-envelope-preflight.review.ps1) downloaded from the exact Draft head. This is distinct from the owner-reported source-PDF PASS. It does not require Node.js, a Supabase SDK, an API key, JWT, or a network connection, and it cannot upload or download anything:

   ```powershell
   & '.\\issue950-pdf-only-rest-envelope-preflight.review.ps1' -SourcePdf 'C:\\Path\\To\\Authorized\\Book.pdf' -DestinationProjectRef 'movnekagnxgcyenczfoc'
   ```

   A successful result prints `ISSUE950_LOCAL_REST_REQUEST_ENVELOPE_PASS`, `ISSUE950_NO_BROAD_SECRET_VARIABLES_PRESENT`, `ISSUE950_REDIRECT_BLOCKING_AVAILABLE`, `ISSUE950_NO_NETWORK_JWT_OR_STORAGE_WRITE_PERFORMED`, `ISSUE950_LIVE_RESTORE_STILL_NO_GO`. The check does **not** validate any live API key, signed JWT, RLS policy, project-origin management ownership, provider response, or object checksum after upload. CI can execute only synthetic negative fixtures; do **not** treat this as a complete protected client.

4. Privately confirm that the owner can use an authenticated **noncustomer** synthetic JWT (not a service-role token) on the **isolated restore only**, without copying tokens into chat or GitHub. GoTrue user administration must be performed only through supported Auth Admin mechanisms, not direct SQL edits to `auth.users`. Existing application's on-user-created trigger produces an active profile, so an **explicit suspended-profile correction** is mandatory before the temporary policy is permitted. Stop if there are entitlements or ambiguous role/claim state.
5. Check that the safe local REST uploader and authenticated downloader exist, that tokens are held only in volatile protected memory, the endpoint host is locked to the restore project, and no automatic upload retries occur. Current connected Supabase tools **do not expose Storage REST object upload or Auth JWT issuance**, so this cannot be delegated to those tools.
6. Privately validate exact substitution/target and rollback SQL in an operator environment. **Reuse the identical UTC expiry timestamp (`__ISSUE950_EXPIRES_AT_UTC__`) in both the installation AND guarded rollback templates; do not recompute it.** The rollback now rejects same-name drift with an additional `OR`, an extra `AND`, or an inconsistent expiry before dropping policies. Do not treat these conservative structural checks as a full semantic SQL proof. Never execute a committed template with unfilled markers; PGlite simulation is **not** live-provider confirmation. If rollback refuses unexpected policy drift, stop and follow the guarded incident procedure rather than using unreviewed generic DROP commands. Do not create a migration or use direct DML against `storage.objects`.

## Conditional single-file execution — ONLY AFTER all GO gates PASS

1. Capture **restricted** before-state (private bucket, 21 objects, target metadata, no temporary policies, no synthetic user collisions, no pending deletions). Record a redacted GO decision with the exact Draft commit.
2. Provision one short-lived synthetic JWT in the isolated restore using supported Auth administration and prove the application profile is suspended and unentitled. Install **only** the owner-reviewed exact-PDF temporary RLS policies with a maximum two-hour expiry, after a positive project-binding check.
3. Use a single protected operator client with the restore's **publishable/legacy anon API key** (not `service_role`) plus that synthetic JWT to issue **one** Storage REST `x-upsert: true` to the immutable PDF key. Do not log headers, credentials, media bytes or signed URLs. **Do not send two concurrent uploads or auto-retry an ambiguous error.**
4. Perform one fresh private authenticated **direct REST download** from the isolated restore, recheck local byte length and SHA-256, and verify expected target metadata changes. Confirm no other Library object changed. On mismatch or unknown 400/403/409 behavior, **STOP** and preserve evidence; do not directly edit Storage tables.
5. Execute the **exact-name, policy-shape-checked rollback** while the verified project binding remains valid. Revoke/suspend the synthetic session through approved Auth controls and verify that temporary policies are zero, noncustomer access is no longer possible, and pending deletion remains zero. Deleting a user alone does not instantly invalidate all JWTs; account for expiry/session checks.
6. Publish **only redacted outcomes**: approved owner GO SHA, request result class, target metadata result, actual PDF hash PASS/FAIL, zero temporary-policy/revocation checks and source/Production unchanged. Declare **PDF 1/21 restored verified** only if the actual-byte test and cleanup both pass. Otherwise keep **0/21 recovered** and escalate the incident.

## Immediate STOP / recovery

- Any unexpected object, bucket, project ref, pre-existing policy, account, entitlement, expired token, scope widening, unexpected request response or missing source file => **STOP, no upload**.
- If upload reports an ambiguous error, **do not retry** until first-party Storage logs and target content state have been checked.
- If rollback detects unknown or drifted policies, its refusal is protective. Keep the isolate on HOLD, preserve restricted evidence, disable/revoke as practicable and seek Supabase Support or qualified external assistance; do not drop arbitrary policies manually.
- If the owner cannot access or isolate a protected JWT/client without exposing privileged keys, the correct verdict is **NO-GO**. Do not use privileged Dashboard object upload as a silent substitute for the required scoped JWT path.
- The original Development and Production projects are never part of the test; all-20-audio recovery, merging, deploying and account deletion require separate decisions.

## Evidence links

- [Issue #950 owner exception](https://github.com/usdimpact/usd-impact-site/issues/950#issuecomment-6527985148)
- [Draft #1011 — exact-PDF scoped policies and rollback](https://github.com/usdimpact/usd-impact-site/pull/1011)
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Restore logs](https://supabase.com/dashboard/project/movnekagnxgcyenczfoc/logs/storage-logs)

**Current operational verdict: NO-GO for a live upload.** All known work performed in this document is source-only; no Auth user, policy, Storage request, Production action, PR merge or deployment has occurred.
