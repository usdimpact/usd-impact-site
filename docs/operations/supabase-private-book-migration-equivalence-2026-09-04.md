# Supabase private-book migration equivalence — 2026-09-04

Status: **verified semantic equivalence; preserve both applied ledger entries**

Review mode: read-only

Repository baseline: `084e90933194729576abd7c2d4cba71c33a5f142`

## Decision

Do not delete, rename, insert, or otherwise rewrite either applied migration record. Production and Development record the private-book bucket migration under different ledger versions, but the stored SQL and resulting bucket contract are equivalent. No corrective migration is required.

| Environment | Applied version | Applied name | Stored SQL MD5 | Stored SQL bytes |
|---|---|---|---|---:|
| Production | `20260831010828` | `20260831002428_create_private_library_pass_book_bucket` | `a9a95f6e7292a04097151bea9b211ebd` | 554 |
| Development | `20260831003226` | `create_private_library_pass_book_bucket` | `a9a95f6e7292a04097151bea9b211ebd` | 554 |

The repository source is `supabase/migrations/20260831002428_create_private_library_pass_book_bucket.sql` (SHA-256 `69cb0f2a492cce45b9a23f201dd281655d80fc4cb0e1c0728711419148d6dd09`). The provider ledger stores the same migration body with environment-specific applied versions and names.

## Resulting schema fingerprint

Both environments returned the same read-only bucket properties on 2026-09-04 UTC:

| Control | Production | Development |
|---|---|---|
| Bucket ID/name | `library-pass-books` | `library-pass-books` |
| Public | `false` | `false` |
| Type | `STANDARD` | `STANDARD` |
| File-size limit | 10,485,760 bytes | 10,485,760 bytes |
| Allowed MIME types | `application/pdf` | `application/pdf` |
| Versioning | disabled | disabled |
| Matching browser-facing `storage.objects` policies | none | none |

Table-level Storage grants remain subject to RLS. The intentional control is the absence of a browser policy for this bucket; the trusted server verifies Library Pass access before using its server-only credential to mint a short-lived signed URL.

## Future CI rule

Treat the two provider ledger entries above as an approved equivalence pair for audit/reporting only. Continue to treat the repository migration filename as the canonical source for new environments. If a future check finds a different stored-SQL digest or bucket fingerprint, stop and create a new forward-only corrective migration; never falsify applied history.

## Evidence boundary

This record used migration metadata and aggregate schema controls only. No customer row, object payload, signed URL, credential, or database record was changed.
