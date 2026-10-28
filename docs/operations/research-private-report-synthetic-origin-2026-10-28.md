# Synthetic private report origin — Development-only storage and delivery rehearsal

Status: DRAFT / PRODUCTION HOLD
Date: 2026-10-28
Stack: PR #920 (report inventory) -> PR #921 (synthetic authorization) -> PR #922 (public-build exclusion) -> this PR.
Rights decision: https://github.com/usdimpact/usd-impact-pipeline/issues/155 (OPEN/HOLD).

## Goal

Demonstrate a complete offline sequence for a fabricated Research report: construct a marked immutable artifact, validate metadata and SHA-256 integrity, retrieve it through a narrow read-only mock data origin, and return the body only after the existing Development-only authorization simulator has accepted a fabricated Research entitlement.

The new code lives under apps/web/scripts only. It is not imported by src/lib, Astro pages, middleware, Vercel functions or the public browser. There is no database migration, Storage bucket, secret, real endpoint or customer record. There is no Production route or paid delivery enabled.

## Files

- apps/web/scripts/research-private-report-synthetic-origin.mjs
- apps/web/scripts/test-research-private-report-synthetic-origin.mjs
- Existing apps/web/package.json validate:reports executes the new tests.

## Restricted mock transport

- Origin is pinned to https://research-assets.invalid. The .invalid domain is reserved for testing and never becomes a live provider host.
- Requires VERCEL_ENV=development, explicit synthetic-rehearsal mode, and injected fetchImpl; the global network fetch is rejected.
- Only GET, no redirects, no HTTP cookies/credentials, no Authorization or apikey, and no-store.
- Queries report_type, period_end and fixed product_id=research-membership with exact equality filters.
- SELECT has a fixed allowlist of fourteen artifact metadata/body fields. No customer email, account ID, subscription/provider ID, commerce, raw provenance payload or secrets is returned.
- Queries limit=2 to reject duplicate rows. Empty rows return no asset; malformed/ambiguous/failing responses throw sanitized errors.
- Rejects public origins, unapproved synthetic rights metadata, mismatched paths, invalid source commit, extra fields, and SHA-256 mismatches.
- A synthetic fixture must include the reserved marker. Embedded scripts, iframe/form/embed tags, external URLs and href/src attributes are refused by the fixture builder.

## Tested access sequence

1. Anonymous or Library-only request terminates as 401/403 without reaching origin.
2. Fabricated active Research entitlement matching the account may retrieve an explicitly marked synthetic Weekly or Monthly report.
3. HEAD follows the same authorization but returns no private body.
4. Invalid date, traversal, forged query, incorrect product, expired/invalid access, unapproved metadata, duplicate record, bad JSON/media type, network error, or compromised source digest fails closed with 404/503, no body or credential leak.
5. All synthetic 200 responses carry private no-store, noindex/nofollow and releaseAuthorized=false. They never represent a valid paid subscriber or actual licensed Research content.

## Real private delivery remains blocked

A true private report origin must be a separately reviewed server-only schema or private Storage bucket, with explicit minimum Postgres privileges, no anon/authenticated direct access to raw report bodies, RLS where Data API exposure exists, no public object URLs, and an independent verified entitlement gate in front of reads. Supabase documentation distinguishes table GRANT privileges from RLS; neither is replaced by a client-side check.

This Draft does not create such infrastructure, select a production schema, obtain counsel or provider approval, or activate any runtime handler.

Before future release: resolve issue #155; classify all historical public reports and the August sample; approve distribution rights separately for member delivery; design the actual private origin; test Development/Preview authenticated and unauthenticated access; prove no static build, direct-origin, feed, sitemap or CDN leak; receive explicit Production approval.

### Deliberate limitations

- The mock injected fetch can return fabricated rows and is not a live database/RLS permission test.
- The synthetic sourceCommit SHA and rightsApproval flags are fabricated, not genuine provenance or legal receipts.
- SHA-256 confirms only consistency between a synthetic body and recorded digest, not truth, rights, or publisher identity.
- This is technical QA evidence. It must never be counted as a provider-backed subscription or first genuine paid-subscriber acceptance.

No real Production/customer/commercial or provider records are created, changed, replayed or accessed.
