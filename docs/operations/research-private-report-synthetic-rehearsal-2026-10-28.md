# Research private report delivery — synthetic Development-only rehearsal

Status: **DRAFT / HOLD — synthetic only, not a deployment, not a member benefit launch**  
Date: 2026-10-28  
Depends on: Draft PR #920 (publication boundary and frozen historical inventory).  
Rights constraint: [usdimpact/usd-impact-pipeline#155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) remains OPEN/HOLD.

## What was built

The new script-only module is located at:
- `apps/web/scripts/research-private-report-synthetic-contract.mjs`
- `apps/web/scripts/test-research-private-report-synthetic-rehearsal.mjs`

The synthetic module has **no runtime caller** in middleware, Astro, `api/account.js`, any commerce route or publication workflow. It only runs under the existing `validate:reports` test script when this stacked Draft PR is checked. It has no Supabase client, real access tokens, private asset origin, migration, provider ID, user identity, billing action or secrets.

This is deliberately narrower than a Production-ready private report handler. The fixture includes a fixed `SYNTHETIC_RESEARCH_REPORT_TEST_ONLY` marker; actual Research reports cannot be served by this rehearsal without first changing code and passing separate approvals. The most permissive response still has `releaseAuthorized=false`.

## Synthetic acceptance matrix

| Condition | Expected |
| --- | --- |
| Production, Preview, missing mode or missing services | 503, empty private body |
| Unsupported HTTP method | 405 |
| Public sample, legacy public route, malformed date, traversal or encoded path | 404 |
| Anonymous | 401 before private store lookup |
| Signed-in Library-only or missing Research entitlement | 403 |
| Pending, past-due, refunded, disputed, charged-back, cancelled, deleted or expired | 403 |
| Research `active` with canonical account match and valid period | Synthetic 200 |
| `cancel_scheduled` before vs after effective end | Synthetic 200 vs 403 |
| HEAD authorized | 200 with empty body |
| Forged query parameters | Never grant entitlement |
| Missing, public, mismatched or rights-unapproved object | 404 / 503, empty body |
| Authentication, account or asset-store failures | Sanitized 503 |
| Successful synthetic content headers | Private no-store, nonindexed, restrictive CSP, no framing |
| Internal complimentary QA entitlement | Can be modeled as an authorized access state, NEVER qualifies as a genuine provider-backed paid subscriber |

The synthetic `approvedForMemberDelivery` and `rightsApproval` test flags are *fabricated test fixtures*. They are never evidence of actual provider-data license clearance, editorial approval, entitlement grant or Production readiness.

## Relationship to existing server-side code

A future reviewed implementation may use the existing `resolveSessionWithRefresh` and `readAccountAccessState` server-side functions. In this rehearsal, each is represented by a deterministic injected stub. No browser-supplied user metadata, account email, query parameter or JWT claim is trusted as an entitlement. The account decision is checked for: `allowed=true`, verified account-to-entitlement match, active profile, Research product, access-eligible state and a valid effective period.

A private report cannot be reclassified as static public content. The actual planned Production implementation requires separately approved private storage and a server route; this Draft **does not** add either. A client-side redirect or Preview-only middleware check is insufficient to secure public build artifacts.

## Later Development validation — NOT executed

After rights disposition and private delivery architecture approval, test all of the following using real Development configuration and synthetic users: session refresh, server-to-store permissions, no public object URLs, non-entitled denial, expiry and refund state changes, server errors, direct-origin denial, CDN/cache headers, sitemap/JSON/feed/build absences, no dependence on TradingView or Library Pass, and immutable artifact provenance.

## No-action / stop boundaries

No Production endpoint, Supabase row/schema/Storage bucket, Vercel environment variable, Lemon Squeezy lifecycle, webhook, live customer account, Library Pass, public sample, historical report, Score data, TradingView access or real commercial record was read or modified by this synthetic rehearsal. The first genuine provider-backed Research subscriber acceptance stays a separate read-only HOLD under its runbook. Manual rights disposition and separately authorized release are still necessary for Production.

