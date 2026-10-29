# Issue #950 — Private Storage Recovery: S3-to-S3 preflight and release HOLD

**Recorded:** October 30, 2026. **Classification:** READ-ONLY EVIDENCE + SOURCE-ONLY PLANNING. **No private file transfer, credentials, or external storage service was used.**

## Grounded projects and restore status

| Parameter | Verified |
| --- | --- |
| Source | `usd-impact-development`, `ycstrcvshdluovtuasjc` |
| Temporary destination | `usd-impact-restore-issue950-20261029`, `movnekagnxgcyenczfoc` |
| Region | `eu-central-1` |
| Destination health | `ACTIVE_HEALTHY` |
| Destination Data API | OFF, dashboard-confirmed |
| Destination new and anonymous signups | OFF |
| Destination Email Auth provider | DISABLED |
| Destination is a live website integration | NO |
| Production project | `gjzetjugmnwanvjkchux` — NEVER use as a migration source or target |
| Paid temporary restore estimate | $9.68/month additional compute, plus usage |

**Database restore is verified, not full-service Storage restoration.** Supabase's physical clone copied Storage bucket and object SQL **metadata**, but its documentation explicitly excludes the underlying S3 bytes.

## Independent Storage metadata evidence

A SELECT-only SQL query on **each** project returned:

| Private bucket | SQL object metadata rows | Size in metadata |
| --- | ---: | ---: |
| `library-pass-assets` | 20 | 372,647,590 bytes |
| `library-pass-books` | 1 | 2,281,645 bytes |
| **Total** | **21** | **374,929,235 bytes** |

Both buckets have `public=false` on both projects. Both have zero policies on `storage.objects`, consistent with privileged service access only.

The *identity+size+MIME* metadata fingerprint is the same in both projects:

`63b14b409e2ba3b7b826eca3915142ccaa1bdafb6fa2b042f22d48c177847f6e`

No object names, private file contents, recipient addresses, API keys or URLs were exported. This is a hash of database metadata **not** a checksum of file contents.

### Important dashboard-view limitation

In the restored project's Storage UI, bucket root views showed zero selectable files. The source UI showed some folders/nonzero book-level files, but its per-view counts did not reconcile with the full SQL inventory because nested folders are displayed separately. **Do not use a root-view count as the authoritative physical file count or proof of corruption.** The provider's restore documentation and a missing secure Storage verification remain the reason to keep actual bytes on HOLD. No private file was opened.

## Supported transfer architecture — only after separate security/data handling signoff

Supabase [Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project) says Storage file bytes are NOT copied. Their [Storage migration guidance](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3) documents the S3-compatible protocol and `rclone copy` for provider-managed objects. [Storage download guidance](https://supabase.com/docs/guides/storage/management/download-objects) also supports S3-compatible clients. The documentation's platform-to-self-hosted example is **not** a validated platform-to-platform overwrite of restored metadata; that behavior must first pass a ONE-OBJECT pilot.

The dormant offline object `apps/web/src/lib/account-deletion-private-storage-restore-plan.review.js` produces constrained, non-executable command examples. The test asserts these properties:

- Exact **one source ref and one restore ref**; neither can be Production.
- The two exact, **private** buckets and current metadata counts/sizes; any new object or changed metadata forces STOP/reinventory.
- Destination Data API disabled, signups disabled, Email Auth provider disabled and both metadata fingerprints unchanged.
- A read-only S3 `rclone size --json` inventory for both buckets, a restricted S3 write **pilot**, destination-only `rclone copy --ignore-times` **after** the pilot, then `rclone check --download` for actual byte comparisons.
- **NO** `rclone sync`, `move`, `purge`, `delete`, SQL metadata reset, public bucket, signed public URL, Google Colab, arbitrary external provider, GitHub artifacts, or stdout logging of object paths.
- All S3 keys must be created explicitly for a dedicated, access-restricted and short-lived **private execution environment**, never committed to GitHub, copied into chat, emailed, printed by a shell `set -x`, or exposed to browser/Preview client source. Revoke both project keys immediately afterwards.
- Use distinct per-project remotes `issue950_source:` and `issue950_restore:`, with direct HTTPS region-specific S3 endpoints, no fallback to global/public buckets. Source operations remain read-only. Confirm normal project API and user access remain disabled.
- Before any write, verify source actual S3 object inventory is exactly 20+1 with full byte totals and destination S3 inventory is compatible with placeholder metadata. **A database metadata match alone does not satisfy this.**

### Guarded pilot and actual copy (NOT EXECUTED)

A security-reviewed operator in a private runner should first configure remotes and run bounded **read-only** S3 inventory on both sides. Reconcile any view/SQL discrepancy and capture object hashes privately, without logging filenames in a public CI job. Select one harmless, owner-approved small asset for an in-provider pilot: S3 PUT to the **same restored key**, followed by S3 GET/HEAD verification and source/destination SHA256 equality. Confirm this does not create a duplicate SQL row or relax bucket visibility. **On any duplicate-key/metadata conflict, stop** and seek vendor guidance; never delete or rebuild original `storage.objects` records manually.

Only once the pilot is successful, execute **destination-only** copies bucket by bucket using validated `rclone copy` with `--ignore-times` so that matching-but-empty metadata cannot cause a silent skip. Run `rclone check --download` (verifies actual bytes on both sides, not just size or ETag) and compare `rclone size --json` counts/bytes, private bucket ACLs, key revocation and any costs. Re-check source asset availability after the operation. Store **aggregate counts and cryptographic comparison outcome only** in the public issue; retain any full private manifest and errors in restricted company incident records.

**Actual secure data transfer remains HOLD** because the current connected Supabase tools have no Storage GET/PUT/cross-project copy actions, and the authenticated Storage UI has no project-to-project copy. No source/target S3 access keys have been provisioned for a controlled runner, no in-provider pilot has run, and no independent security owner has approved temporary access/transfer logging.

## Separate account-deletion release gates

Even if all 21 objects later pass physical byte checks, Issue #950 **cannot** deploy solely on that evidence. Independent DBA/security/privacy approval of claim fencing, RLS, Auth soft-delete, and recipient escrow retention; live synthetic GoTrue/PostgREST/JWT/Storage acceptance; coordinated replacement of the old unfenced finalizer; migration/rollback and Production approval remain separate. All PRs remain Draft and unmerged, and no real user deletion is authorized.

## Cleanup

The restored project is billable while it exists. After all retained evidence is accepted and any authorized Storage pilot completed, have the owner **explicitly approve** deleting `movnekagnxgcyenczfoc` only after proving source `ycstrcvshdluovtuasjc` and Production `gjzetjugmnwanvjkchux` are not selected. Deleting the temporary project would erase its restore and is irreversible. No cleanup was performed in this review.
