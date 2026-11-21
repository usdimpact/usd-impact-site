# Issue #950 — Independent 21-object byte checksums versus the committed asset manifests

**Date:** 2026-10-30. **Status:** source-only integrity-control proposal and offline fixtures. **No private files, real source or restore Storage bytes were accessed.**

## Why source-versus-restored equality is insufficient

The earlier private Storage recovery checklist compared (1) SQL object metadata fingerprints and (2) proposed source and destination file SHA-256 values. Both are necessary but can still miss a shared failure: if the **source file itself is unexpectedly corrupted**, copying it successfully to the isolated restore yields two identical but incorrect files.

USD Impact's existing published private-media source code holds **independently committed authoritative file SHA-256 values and exact lengths** for all 21 files:

- **20** protected English audiobook tracks in `apps/web/src/lib/private-audiobook.js`, aggregate **372,647,590 bytes**.
- **1** protected PDF in `apps/web/src/lib/private-book.js`, **2,281,645 bytes**.
- Total **21 objects / 374,929,235 bytes**. The signed URL TTLs remain 3600 seconds for audiobook and 300 seconds for book.

These are **known committed expectations**, not new measurements of actual object bytes. Existing source and isolated restore metadata match the aggregate totals, but neither project has been used to fetch or SHA-256 the actual content during this review.

## Offline-only evidence consistency helper

`apps/web/src/lib/account-deletion-private-storage-checksum-evidence.review.js` constructs an internal, frozen **21-object exact-identity/length/SHA-256** allowlist from these committed manifests. It accepts only a pair of claimed per-object *streamed-byte* evidence arrays for exact source `ycstrcvshdluovtuasjc` and isolated restore `movnekagnxgcyenczfoc`.

It rejects:
- Any other project, including Production `gjzetjugmnwanvjkchux`;
- Missing, extra, duplicate or unknown paths or buckets;
- Size changes, malformed hex hashes and **even identical corrupted SHA-256 claims on both source and destination**;
- SQL-metadata-only digests, ETags, path-based manifests presented as actual byte hashes;
- Total mismatch against the immutable 21-object code manifest.

The result is **aggregate-only** (count, total expected bytes and structural consistency) and includes unequivocal `realObjectBytesReadByThisFunction=false`, `independentRunnerProvenanceVerified=false`, `productionReleaseAuthorized=false`, `s3TransferAuthorized=false` flags. It **never** returns private object paths, the per-object hashes, API keys, signed URLs or account information. The module cannot invoke `fetch`, provider clients, local `fs`, external shell commands or the account-deletion finalizer and is forbidden from import by active application source.

**Crucial limitation:** An input claiming a streamed SHA-256 may be fabricated. The helper validates **claims against an authoritative manifest**; it does **not** attest that a protected runner read the real bytes. This distinction is intentional and no amount of fixture testing changes it.

## Protected real-provider acceptance (not run)

After separately approved temporary access with scoped S3 session JWTs (preferred if actual provider support permits), a trusted, isolated, audited runner must:

1. Read **real S3 object bytes** on the source and restored project, with authenticated correct project credentials and **no public signed URLs**; stream and SHA-256 each file independently, with exact size, type and bucket/key identity.
2. Compare **both** observed file hashes to the committed code-manifest SHA-256, not merely to each other. Compare aggregate count and total bytes to 21 / 374,929,235.
3. Confirm the independent reviewer trusts the source code manifest as authoritative (and separately verifies its version/chain of custody); CI tests do not prove the original manifest was compiled from a genuine file.
4. Keep the full per-object report, any paths and hashes inside a restricted audit storage location, not a PR/issue, email, public CI artifact or stdout log. Publish only aggregate pass/fail counts and a reviewer-signed evidence reference.
5. Re-run the same checks after S3 transfer and confirm source still serves correctly; revoke both temporary user JWT sessions and rollback only the temporary object/bucket RLS policies, leaving source unchanged.
6. Stop if any source hash differs from committed manifest, any dest hash differs from source/manifest, or a real Storage protocol test fails. Never repair `storage.objects` metadata by direct SQL. Never use unrestricted project S3 keys as an unreviewed fallback.

The temporary restore is **not** a full-service clone until byte checks, Storage access/policy teardown and the independently required Edge Function/runtime validation are complete. The already copied real Auth identities must not be used in synthetic tests.

## Separate unchanged account-deletion gates

Even if all 21 objects later pass, Issue #950 remains on HOLD pending independent DBA/security/privacy approvals, completion-recipient escrow retention and terminal failure policy, real GoTrue/JWT/PostgREST/Storage synthetic acceptance, exclusive-claim-aware finalizer migration, previously issued signed URL residual-availability acceptance (5m book / 60m audio), and a separate Production rollout authorization.

**This Draft does not verify actual file bytes or authorize any real Storage, Auth, SQL, payment, email or Production operation.** The temporary restored project's ongoing charge and eventual separately approved removal are tracked in [Issue #978](https://github.com/usdimpact/usd-impact-site/issues/978).

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) · [Scoped S3 session reviewer #993](https://github.com/usdimpact/usd-impact-site/pull/993) · [Storage schema warning](https://supabase.com/docs/guides/storage/schema/design).
