# Issue #950 — Single-PDF isolated-restore upsert pilot (REVIEW ONLY)
Date: 2026-10-30. **HARD HOLD. NOT an approved migration, provider test, SQL installation, Auth procedure or Production change.**

## Decision boundary

Supabase Support ticket **SU-531190** confirmed that the isolated restore contains the PDF's database metadata but lacks the underlying object bytes. Support recommends a supported Storage API **upsert** at the existing key, with no direct `storage.objects` editing. They demonstrated a `service_role` approach; that credential bypasses RLS and is NOT authorized by the existing least-privilege decision.

**Provider guidance received (SU-531190, October 30 at 16:00 UTC):** Authenticated JWT-based Storage REST upsert (`x-upsert: true`) is supported with exact-object SELECT, INSERT and UPDATE policies. For existing restored metadata, Supabase recommends this REST method rather than S3 session-token PutObject for the first controlled file. The SHA-256-verified offline PDF is an acceptable source. This resolves technical method selection, **not** the separate DBA, security, privacy, operator or real-byte acceptance gates.

## Why a separate PDF-only proposal

The larger [Draft PR #1001](https://github.com/usdimpact/usd-impact-site/pull/1001) includes candidate temporary policies for all **21** media objects in both Development and the isolated restore. That scope is broader than necessary for a **single-PDF pilot**.

This stacked review proposes **destination-only** policies with no new Development grants and no activity in Production:
- Destination project: isolated restore **`movnekagnxgcyenczfoc`** only.
- Bucket: **`library-pass-books`**, only the one exact published Edition 1.3 Candidate 2 PDF object path from the immutable code manifest.
- Session: newly created, noncustomer, independently approved **restored-project synthetic JWT** with matching admin-only app metadata, exact email, `suspended` application profile, no entitlements, a bound expiry of at most **two hours**, and an independently attested project ref.
- Proposed operations: `storage.objects` **SELECT, INSERT and UPDATE**, including both UPDATE `USING` and `WITH CHECK`; `storage.buckets` **SELECT** on the one private book bucket. **No DELETE, no audiobook permissions, no source policies, no public bucket access.**
- All 21 immutable metadata rows are still checked by the installation preflight as a baseline; **only one PDF is granted a policy**.
- The private, failover-sensitive host fingerprint is supplemental, never a substitute for independent project-ref attestation.
- Separate exact-name guarded rollback, fail-closed on unexpected/modified policies, preserves object content and does not delete Auth users.

Both SQL proposals live only under `docs/operations/candidates/`, not `supabase/migrations/`, and intentionally contain invalid private project host, UUID, email, and expiry placeholders.

## Unverified, mandatory test and approvals

**Current evidence level: source-only Draft with disposable PostgreSQL testing PASSED; no live provider acceptance.** The existing credential-free `apps/web/scripts/test-issue950-scoped-s3-jwt-rls-pglite.mjs` was extended to exercise these exact PDF-only candidate files in a fresh in-memory PGlite database. Positive and negative checks include uninstantiated placeholder refusal, wrong-host and expiry refusal, exact one-PDF SELECT and UPDATE, non-PDF/other-user/anon/DELETE denial, unknown-policy rollback refusal, zero-policy cleanup and idempotency. The current exact-head GitHub Actions run [41080093674](https://github.com/usdimpact/usd-impact-site/actions/runs/41080093674) passed at `bbf96332ac28f21cb042caadee8a88fd72e230be`: **213 disposable PostgreSQL assertions** and **2,133 source/runtime boundary checks**. This **does not** prove real Supabase JWT/session/provider upsert semantics or independently approve the SQL. Do not execute, merge or activate until qualified DBA/security/privacy review and a separately approved protected operator test.

Require separately attributable approvals by:
1. **DBA:** schema/policy exactness, source/restore identity, no incidental policy grants, host guard, preflight and rollback, and post-upsert metadata effects (version, hash/size, content type, cache control).
2. **Security:** short-lived synthetic JWT issued by GoTrue Admin, correct request Authorization/client key mapping, denial for all non-PDF paths, expiry, no exposed service-role/S3 bypass keys, no public artifacts, no existing customer accounts.
3. **Privacy:** restricted licensed PDF source, acceptable private destination test, retention/evidence policy, no external uploads, no release.
4. **Named operator:** isolated protected runner, privately held approved PDF, original 2,281,645-byte SHA-256 `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`, expected path and project references independently cross-checked.

## Proposed operator acceptance — only after all gates

1. Private operator receives authorized offline PDF without sending bytes into GitHub/ChatGPT/CI. Independently hash and check size before request.
2. Before any temporary policy installation, verify Storage RLS and zero prior policies, all 21 existing metadata rows, no pending deletions, synthetic isolation; independently attest the exact restore project.
3. Install only *reviewed* PDF-only temporary candidate policies following independent approval, without touching original Development.
4. In an isolated all-synthetic fixture, prove unauthorized JWT/anon, other bucket/path, update, deletion, and wrong-project requests fail. **Do not fire negative potentially destructive requests at real Development**.
5. After all independent approvals, perform exactly one authenticated JWT/RLS-scoped `x-upsert: true` REST upload of the approved PDF to the exact existing restore path; provider technical guidance is confirmed, but no real upload has occurred. If provider rejects, **STOP**; never delete or edit `storage.objects` manually or fall back to unrestricted keys. Upsert updates metadata, so verify the metadata row and object identity carefully.
6. Privately GET the restored PDF using the approved direct Storage API access, and compare **actual downloaded bytes and SHA-256** against the committed manifest. Confirm the PDF remains private and the pre/post metadata is inspected. Do not rely on a cached CDN response, a 200 status or SQL metadata alone; an overwrite can exhibit propagation delay.
7. Run exact-name rollback and separately revoke the synthetic session/account. Prove zero temporary policies and no pending deletions, with no customer/login, payment, entitlements, Production or email changes. Log only aggregate outcomes and a restricted evidence reference.
8. After one-PDF acceptance, evaluate *separately approved* source GET and restore PUT for the 20 MP3 tracks. Sixteen exceed 6 MB; use a reviewed reliable S3/TUS strategy, not an assumed safe small-file workflow.

## Acceptance evidence and STOP matrix — review-only, unfilled

This table is a **future-operator template, not an execution record**. Record no real credentials, JWTs, source bytes, private signed URLs, or customer data in GitHub. The assigned operator must retain restricted evidence in a separately approved private location and post only redacted outcomes and references.

| Acceptance gate | Expected evidence | STOP condition |
| --- | --- | --- |
| Independent review | DBA, security and privacy each explicitly approve **the identical current Draft commit**, exact REST/JWT scope, temporary Auth, and data-handling plan | Missing, stale or owner-proxy approvals |
| Protected operator | A named operator attests private runner controls, legal PDF custody, two-person review where required, and an independently checked **RESTORE** project ref | Wrong project, shared unscoped key, no custodian |
| Source integrity | Offline authorized book PDF **2,281,645 bytes**, SHA-256 `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666` | Unexpected size/hash, unclear source rights |
| Before state | Exact 21 private-object metadata rows, 2 private Library buckets, 0 temporary Storage policies, 0 issue-scoped transfer users, no pending deletions; preserve a restricted before-metadata snapshot | Drift or additional policies, missing manifest rows |
| Session and permission isolation | An approved noncustomer Auth principal with suspended application profile, no entitlements, 2-hour **maximum policy expiry**, verified exact-path RLS on only the book PDF; no DELETE | Anonymous/other-user access, broadened permission, wrong bucket/path |
| Single-writer REST test | One authorized protected client, one request to the **same existing PDF key** with standard Storage API `x-upsert: true`; request outcome/ID recorded privately, never signed URLs or JWTs | Simultaneous writes, ambiguous response, unauthorized 403/409/400; **do not retry automatically** |
| Actual object integrity | A newly requested private *direct Storage API* download; operator hashes **the downloaded bytes** and matches the exact 2,281,645-byte canonical digest; independently inspect the pre/post target metadata row | Only SQL metadata match, status 200 without bytes, CDN-stale result, byte/hash mismatch |
| Scope and state after upload | The other 20 audio object names/metadata untouched; the books bucket remains private; acceptable target row version/metadata changes are recorded (upsert may change the target metadata) | Unexpected extra object version changes or modifications outside the exact approved PDF |
| Cleanup | Approved exact-name rollback removes 4 temporary policies; no remaining issue-scoped transfer users/sessions; check that short-lived JWTs cannot authorize any Storage action and no account deletion is pending | Policy drift or failed revocation; escalate to assigned DBA/security, do not claim cleanup PASS |
| Release rights | Pilot may be recorded as one-file isolated-restore byte verification only; Production, deployment, merge and account-deletion release remain separately gated | Any attempt to treat a recovered PDF as full 21-file or application DR signoff |

**Important REST upsert and CDN nuances:** Supabase documents that upserting a path replaces the object and can lead to stale CDN responses while changes propagate. Its docs also warn that concurrent `x-upsert` writers produce *last-writer-wins* behavior. The pilot therefore requires **one writer, one intended request, no parallel retry**, and a direct private read that establishes the actual new bytes. Do not equate the retained SQL metadata row with physical Storage recovery.

**Rollback failure / expired JWT incident procedure:** If exact-name rollback refuses a modified or incomplete policy set, the automated guard correctly leaves the situation for the DBA to inspect; it **does not prove access has been revoked**. Security must trigger the independently approved manual incident path, revoke/invalidate the synthetic session as applicable, and ensure the policy expiry is enforced. Deleting an Auth user alone is not proof all previously issued JWTs are invalid. Record a separate post-incident zero-access verification. If file integrity fails after a write, **leave the isolated restore on HOLD**, do not alter `storage.objects` with manual SQL and do not transfer the other 20 objects.

**Separate source-media status:** The owner attests the first English audiobook MP3 was downloaded from Development and its bytes matched the committed hash. The authorized offline book PDF also matched. These **2/21 byte-verified off-platform candidates** do not constitute restored Storage bytes; the isolated restore remains **0/21 recovered bytes independently verified** until the controlled acceptance above passes.

No new clone, merge, deployment, physical Storage read/write, credential handling, SQL execution or Auth mutation is authorized by this review. Keep the existing billable restore; separate cost decision in [Issue #978](https://github.com/usdimpact/usd-impact-site/issues/978).

References: https://supabase.com/docs/guides/storage/uploads/standard-uploads ; https://supabase.com/docs/guides/storage/s3/authentication ; https://supabase.com/docs/guides/storage/security/access-control .
