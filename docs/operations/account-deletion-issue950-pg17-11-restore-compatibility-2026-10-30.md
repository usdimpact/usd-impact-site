# Issue #950 — PostgreSQL 17.6 → 17.11 compatibility: read-only catalog assessment

**Assessed:** 2026-10-30. **Method:** PostgreSQL catalog queries only. **No user rows decrypted, scanned or modified, and no index or extension changes.**

## Why this matters

The already-approved isolated Supabase restoration of Development source `ycstrcvshdluovtuasjc` provisioned PostgreSQL 17.11, whereas the source is PostgreSQL 17.6. Supabase's [September 25, 2026 breaking-change bulletin](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) identifies several conditional risks in this minor-version transition: `ltree` index correctness, `btree_gist` indexes involving NaN floats, legacy `pgcrypto` Blowfish/CAST5 PGP decryption behavior, and custom operator estimator recreation.

A read-only, aggregate catalog-only query checked all currently listed categories in both source and restored projects:

| Catalog-only detection | Development PG17.6 | Restore PG17.11 |
| --- | ---: | ---: |
| Indexed `ltree`/array-`ltree` operator types | 0 | 0 |
| GiST indexes with `float4`/`float8` operator types | 0 | 0 |
| Non-extension custom operators with non-built-in selectivity estimators | 0 | 0 |
| Stored procedural functions explicitly referencing `cipher-algo=bf/blowfish/cast5` | 0 | 0 |
| `pgcrypto` installed | Yes | Yes |

**Interpretation:** the catalog evidence did not find the listed index/operator patterns; no relevant REINDEX or operator repair was justified by these queries. The query only checked explicit legacy-cipher references in database function bodies, **not existing encrypted data** nor application-originated encryption options. It does not establish that every ciphertext is compatible or that the complete application works identically under 17.11.

## Distinct account deletion scope

The isolated database restore had already matched 55/55 migration entries, 726 selected schema columns, 19 public RLS policies, 3 legacy deletion-function fingerprints, 9 Auth users, 9 profiles and the notification-outbox counts. The 21 private Storage object **metadata** records also match, but no actual S3 bytes have been restored or compared. The clone has Data API OFF, signups/anonymous access OFF and Email Auth disabled. These controls do not authorize real deletions or activity on copied accounts.

**Hard HOLD remains:** actual secure Storage file byte verification; independent DBA/privacy/security approval; review of escrow legal retention and operator-only recovery; protected synthetic real GoTrue/PostgREST/JWT/Storage acceptance; coordinated generated migration + claim-aware finalizer; and separate Production authorization. This assessment does not authorize upgrading Development or Production PostgreSQL.

The query returned only counts/boolean conditions/version strings. It was executed on Development and the previously approved isolated restore, **not Production**.
