# Issue #950 — Private Library Pass signed URL lifetime and opaque-key protocol

**Date:** October 30, 2026. **Scope:** Draft source and offline acceptance only. No live credentials, download, S3 copy, Auth Admin or Production change.

## Grounded production-source findings

Two existing *server-side* private Storage signing helpers mint temporary URLs only after the book or audiobook handler verifies a signed-in member's Library Pass access:

| Asset | Private bucket | Source TTL | Observed redirect behavior |
| --- | --- | --- | --- |
| Read the Dollar First PDF | `library-pass-books` | **300 seconds (5 minutes)** | Protected book route → per-request entitlement check → Storage signed-url redirect |
| 20-track English audiobook | `library-pass-assets` | **3600 seconds (60 minutes)** | Protected track route → per-request entitlement check → Storage signed-url redirect |

The two helpers used `Authorization: Bearer ${resolvedConfig.secretKey}` even when the backend supplied a modern opaque Supabase `sb_secret_` API key. A shared `buildSupabaseRestHeaders` helper exists in the larger **unmerged** Issue #950 Draft, but **does not exist on protected main**. This narrow independent fix must not import that draft-only helper. Supabase's current [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [migration guidance](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) say that opaque secret keys are not JWTs and belong on `apikey`, not a JWT bearer header.

### Proposed fix in Draft only

On the main-based standalone branch, apply a minimal conditional header rule directly in the two signing functions: `apikey` always, `Authorization: Bearer` **only** for legacy JWT-form `eyJ...` keys. This retains the existing request path, POST body `{expiresIn}`, private bucket names, object manifests, URL origin/path/token validation and TTLs, with **no** new dependency on the account-deletion Draft. The helper sends an opaque `sb_secret_` key only in `apikey`, but supports an existing JWT-form service key on both `apikey` and `Authorization: Bearer` for backwards compatibility.

Update isolated book, audiobook and handler tests to prove modern no-Bearer and legacy JWT behavior; preserve the 300/3600-second expiry constants; reject wrong bucket, missing token, wrong origin and signing failure; and deny signing new URLs when a request still has an old auth cookie but its account is already deleted. All tests use mocked Storage and synthetic credentials, never an actual file or user.

## Security boundary: previously signed URLs survive account removal

A Storage signed URL is a **temporary bearer capability**: the browser can present it to Storage without re-performing the site's paid-member check on every byte or HTTP Range request. Deleting a profile, detaching the Auth FK or soft-deleting the Auth user prevents **minting new** URLs via the site once the protected entitlement/identity checks fail; it does **not** automatically invalidate a signed URL that was generated beforehand.

Current maximum residual URL lifetimes, absent further provider-side revocation, are **5 minutes PDF** and **up to 60 minutes audiobook** from the moment that URL was issued. Cached or fully downloaded content may remain accessible after that regardless of expiry. Actual Storage/CDN cache semantics require separate protected provider acceptance, and do **not** claim that a previously downloaded file can be recalled.

**Do not reduce the audiobook link to an arbitrary 60-second expiry** without first validating chapter durations, Range/seek/resume behavior on the real Storage provider and user experience. Short TTLs may interrupt streaming and break player seeking. If near-immediate byte-level cutoff is an explicit privacy/security requirement, the engineering alternative is a range-capable, authorization-checking server streaming proxy (or provider-supported token revocation design) with a fully costed capacity, abuse and cache-control assessment. This has NOT been built or approved.

## Required protected acceptance before any production release

- Verify real Storage signing with **a new synthetic private test object**, not the 21 copied real Library Pass objects, and a server-only short-lived key in an independently approved test runner. Capture only nonsecret status/counters; never print signed `token` query params, `Authorization` values, object contents, or secret keys.
- Validate 200 signing, expected 302 and cache headers; confirm explicit 401/403 denial for expired, wrong-object and revoked/non-entitled cases; verify the actual expiration time and HTTP Range/seek behavior on a synthetic audio object.
- Confirm the source's 21 private objects still exist and are private. The temporary isolated restored database has matching **SQL metadata**, but **no physical Storage-byte recovery/verification** yet; do not mistake that backup for a working file-servicing environment.
- Obtain documented owner/security/privacy acceptance of the **residual 60-minute signed-URL access window** or approve a different strategy before the account-deletion system can be activated.
- The GoTrue Auth Admin, stale-JWT RLS, single-worker claim, escrow legal retention, real synthetic acceptance, coordinated finalizer and Production gates remain separate. The live old finalizer is disabled and unfenced.

**Release status:** Hold. This Draft does not deploy, change the TTL, delete an account, transfer a Storage object, generate a real signed URL, or authorize access to any private file.

References: [Issue #950](https://github.com/usdimpact/usd-impact-site/issues/950) · [Supabase Storage serving assets](https://supabase.com/docs/guides/storage/serving/downloads) · [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
