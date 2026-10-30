# Issue #950 — Single-PDF isolated-restore upsert pilot (REVIEW ONLY)
Date: 2026-10-30. **HARD HOLD. NOT an approved migration, provider test, SQL installation, Auth procedure or Production change.**

## Decision boundary

Supabase Support ticket **SU-531190** confirmed that the isolated restore contains the PDF's database metadata but lacks the underlying object bytes. Support recommends a supported Storage API **upsert** at the existing key, with no direct `storage.objects` editing. They demonstrated a `service_role` approach; that credential bypasses RLS and is NOT authorized by the existing least-privilege decision.

A threaded request asks whether one newly issued short-lived **synthetic Auth JWT** with exact-object temporary RLS can perform a Standard Storage API `upsert` on the restored metadata, and whether the independently byte-hashed offline PDF can serve as a *destination-only* source. **The provider answer to those narrower questions is outstanding.** Do not treat generic JWT/RLS documentation as definitive evidence about this exact metadata-without-bytes situation.

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

**Current evidence level: source-only Draft with disposable PostgreSQL testing PASSED; no live provider acceptance.** The existing credential-free `apps/web/scripts/test-issue950-scoped-s3-jwt-rls-pglite.mjs` was extended to exercise these exact PDF-only candidate files in a fresh in-memory PGlite database. Positive and negative checks include uninstantiated placeholder refusal, wrong-host and expiry refusal, exact one-PDF SELECT and UPDATE, non-PDF/other-user/anon/DELETE denial, unknown-policy rollback refusal, zero-policy cleanup and idempotency. The focused GitHub Actions test succeeded at commit `303e11399f4dc756fbb01fa22b432f4346e71669` (and also at predecessor `3ac4434c9c1e4650171572cb812509484ae35437`). This **does not** prove real Supabase JWT/session/provider upsert semantics or independently approve the SQL. Do not execute, merge or activate until qualified DBA/security/privacy review, the provider response, and a separately approved protected operator test.

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
5. Perform exactly one authorized `upsert: true` Standard Storage API PDF upload; provider confirmation on JWT-scoped existing-row behavior required. If provider rejects, **STOP**; never delete or edit `storage.objects` manually or fall back to unrestricted keys. Upsert updates metadata, so verify the metadata row and object identity carefully.
6. Privately GET the restored PDF, compare **actual downloaded bytes and SHA-256** to the committed manifest. A successful 200 or matching SQL metadata alone does **not** establish byte integrity.
7. Run exact-name rollback and separately revoke the synthetic session/account. Prove zero temporary policies and no pending deletions, with no customer/login, payment, entitlements, Production or email changes. Log only aggregate outcomes and a restricted evidence reference.
8. After one-PDF acceptance, evaluate *separately approved* source GET and restore PUT for the 20 MP3 tracks. Sixteen exceed 6 MB; use a reviewed reliable S3/TUS strategy, not an assumed safe small-file workflow.

No new clone, merge, deployment, physical Storage read/write, credential handling, SQL execution or Auth mutation is authorized by this review. Keep the existing billable restore; separate cost decision in [Issue #978](https://github.com/usdimpact/usd-impact-site/issues/978).

References: https://supabase.com/docs/guides/storage/uploads/standard-uploads ; https://supabase.com/docs/guides/storage/s3/authentication ; https://supabase.com/docs/guides/storage/security/access-control .
