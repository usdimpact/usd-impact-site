# Research report public/private boundary — candidate-only handoff

Status: **Draft preparation only. Not wired to runtime, build, publishing, commerce or Production.**
Date: 2026-10-28
Scope: USD Impact Research Membership weekly/monthly reports, separate from the protected Score member delivery.

## Observed baseline (read-only)

- Existing `/reports/weekly/[date]` and `/reports/monthly/[date]` Astro routes include published content in the static build. Published status is **not** a Research entitlement check.
- `research-preview-route.js` protects report pages **only** when `VERCEL_ENV=preview`; in Production it allows them. Middleware alone would not prove that prebuilt HTML, caches or source URLs have been contained.
- `/score/member/...` is a distinct private server-side Research gate. Never replace it with static publication or a client-side check.
- `/research/sample/` is intentionally public: complete Weekly Report ending 2026-08-07, at least 30 days old. Keep the sample unchanged pending explicit rights review.
- Research product promises ongoing Weekly/Monthly research. Library Pass is independent. TradingView remains deferred.
- [Pipeline issue #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) remains open for Score provider-data redistribution rights. Existing reports contain component/provenance material and must not be republished or migrated without disposition.

## Candidate policy and synthetic tests

- `apps/web/src/lib/research-report-publication-boundary.js` is pure. It has **no production caller**. Its most permissive answer is `CANDIDATE_ONLY`, always with `releaseAuthorized=false`. It never authorizes release.
- `apps/web/scripts/test-research-report-publication-boundary.mjs` uses **synthetic approvals**, not legal, editorial or release evidence. Missing rights, editorial approval, public-safe review and private-delivery controls all fail closed.
- Release classifications: `historical-public`, `public-sample`, `research-private`. Do **not** infer release scope from existing `status: published` frontmatter.

## Proposed future routing boundary (not active)

| Class | Path convention | Prerequisite |
| --- | --- | --- |
| Historical public | Existing `/reports/weekly/YYYY-MM-DD` and `/reports/monthly/YYYY-MM-DD` | Previously public, explicitly reviewed/retained, public-rights approved |
| Public sample | Existing `/research/sample/` | Explicit review, public-safe complete weekly report at least 30 days old |
| Research private | Proposed `/research/member/reports/{weekly|monthly}/YYYY-MM-DD` | Member-delivery rights, server-side session and Research entitlement, private storage, no public build or origin URL, fail-closed errors, `no-store` and `noindex` |

A public static HTML file behind middleware redirects is **not** proof of private storage. No protected material may appear in the public static build, sitemap, JSON, feeds, archived origin, direct provider URLs or source map.

## Blocked implementation sequence

1. Resolve issue #155 with written rights disposition for public and commercial member delivery, including historical derived content.
2. Review and classify every historical report and public-retention decision. Do not silently delete or privatize existing links.
3. Implement separately reviewed private storage and server delivery in Development/Test Mode only.
4. Test anonymous denial, authenticated Library-only denial, active Research authorization, expiry/suspension, archive access, GET/HEAD, error paths, cache headers, public sample and direct-origin denial.
5. Confirm Library Pass remains unaffected and TradingView excluded.
6. Perform exact-head quality/security checks and READY Preview; require separate Production release authorization.

## Non-actions

No existing report, route, sample, sitemap, Score source, Research subscription, entitlement, webhook, provider configuration, email or Production release was changed by this draft. The first genuine paid Research subscriber runbook remains independent, read-only and pending.

## 2026-10-28 high-detail inventory addendum

Evidence baseline: GitHub site main `dbbe7e6dcf1632275b0e05c1db311e543d524d6c`, reviewed against the actual `src/content/weekly-reports` and `src/content/monthly-reports` directories.

| Observable input | Count |
| --- | ---: |
| Published, statically generated weekly report source files | 13 |
| Published, statically generated monthly report source files | 3 |
| Reports carrying contribution-related language | 16 |
| Weekly files pointing to `weekly_input.json` evidence | 13 |
| Weekly reports declaring `nearestRegimeBoundary` | 13 |
| Named public sample routes | 1 |
| Reports with affirmative rights-cleared classification in this candidate inventory | **0** |

Week-end dates in the baseline: 2026-07-31, 2026-08-07, 2026-08-14, 2026-08-21, 2026-08-28, 2026-09-04, 2026-09-11, 2026-09-18, 2026-09-25, 2026-10-02, 2026-10-09, 2026-10-16, 2026-10-23.
Monthly dates: 2026-08-21, 2026-09-18, 2026-10-16.

Live anonymous read-only fetches also returned complete page content at:
- `https://usd-impact.com/reports/weekly/2026-10-23`;
- `https://usd-impact.com/reports/monthly/2026-10-16`;
- `https://usd-impact.com/research/sample/`.

These fetches demonstrate that those particular pages are publicly reachable. They do not establish what indexing or caching has done everywhere, and do not resolve licensing obligations. No privately authenticated page was requested.

The frozen metadata-only inventory is `apps/web/scripts/fixtures/research-report-public-baseline-2026-10-28.json`. Its `HOLD_UNREVIEWED` status is intentionally **not** an assertion that public delivery has been legally approved. The scanner `apps/web/scripts/audit-research-report-inventory.mjs --check` compares the actual repository files to that snapshot without copying report bodies or provider URLs into its output. It intentionally fails on added, removed, renamed, reclassified, or substantially changed observable report-risk flags until someone reviews the revised snapshot. The scanner is invoked by `validate:reports` on the Draft head.

**Important distinction:** the word `published` in historical content means the static website emits the page. It is not a paid Research entitlement or a license to redistribute provider-derived values.

## Implementation architecture — no Production implementation in this PR

### Design decisions

1. **Do not retrofit a paywall onto the public static report URL.** If HTML exists in a public Astro `dist` artifact, middleware redirects alone do not establish that CDN, static host, search cache, export, or origin copies have become private.
2. **Keep a distinct explicit access classification.** Three classes are `historical-public`, `public-sample`, and `research-private`. Content `status=published` is not an access classification. Rights disposition for the actual delivery scope is necessary for all three.
3. **Do not place future member reports in the public Astro content glob.** On approval, generate a private approved artifact with an immutable content digest, checked period-end date, product ID and permitted distribution scope. Store only in an approved non-public origin.
4. **Reuse the existing server authorization pattern, not the client's success message.** After checking the server-verified USD Impact session, call the existing account access decision using `productId=research-membership` and checked entitlement start/end. Neither a query parameter, `user_metadata`, a redirect, nor a provider email constitutes authority.
5. **Reuse an existing server function family if the Vercel function-count constraint remains 12.** Proposed `/research/member/reports/{weekly|monthly}/YYYY-MM-DD` rewrites can use `/api/account?action=research-report-content` after review. This is **not wired** in the Draft. Do not add a new function silently.
6. **Use a separate private report asset store from Score.** A future approved Supabase table or private Storage bucket can follow the existing server-only Score asset-delivery pattern. Do not introduce broad `anon` or `authenticated` grants to private report bodies. Avoid exposing raw provider histories, source bundles, or secret object URLs to the browser.
7. **Be explicit about rights scope.** Authorization to compute a derived Score does not itself permit public redistribution or paid member delivery. Moving data behind a paywall does not cure an unresolved license.

### Proposed HTTP decision table

| Request | Expected state | Response |
| --- | --- | --- |
| Anonymous GET/HEAD to approved private route | No trusted session | 401, no private body, no-store |
| Signed-in Library Pass only | No active Research entitlement | 403, no private body |
| Signed-in Research entitlement expired/inactive | Not entitled | 403, no private body |
| Valid signed-in internal QA entitlement | Currently allowed by existing Research account access service | 200 only for rights-approved private QA fixture; never counts as a first genuine paid subscriber |
| Genuine paid Research member (once independently observed) | Valid active membership | 200 only after both session/entitlement and asset rights check |
| Valid member, report not found or not approved for member distribution | No eligible private asset | 404 or fail-closed 503; never public fallback |
| Auth, permissions or private store unavailable | Unknown | 503; never serve from public static build |
| Unsupported method or malformed path | Out of scope | 405 or 404, no data |
| Public sample | Published historical sample with public-rights approval | 200 anonymously; remain at `/research/sample/` |
| Legacy public report | Existing public classification pending rights disposition | Do not change silently in this workstream |

**Cache/security contract for private content:** `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and restrictive CSP. Do not embed signed object URLs, provider IDs, session tokens, API keys, source raw payloads, or full customer identifiers.

### Proposed private artifact record (design sketch, not a migration)

| Field | Role |
| --- | --- |
| `report_type` and `period_end` | Typed key (weekly/monthly, validated ISO date) |
| `product_id` | Fixed `research-membership` authority |
| `asset_digest` / `source_commit` | Immutable approved artifact provenance, no private URL |
| `content_type` | Whitelisted HTML or JSON representation |
| `rights_scope` / `review_record` | Source-level approval for the exact *member* distribution scope |
| `approved_for_member_delivery` | Explicit review gate, not inferred from published status |
| `private_object_locator` | Server-side reference only; never returned to browser |

If private Supabase Storage is used, keep the bucket private; if a database table is used, enable RLS, explicitly restrict Data API access, and use server-only credentials. Neither choice is provisioned here. Budget and licensing approval remain independent release gates.

## Threat model and acceptance evidence

| Threat or regression | Required evidence before enabling |
| --- | --- |
| Static HTML remains public after moving a route | Build inventory proves member body absent from `dist`, sitemap, RSS, search exports, static assets and alternate origins |
| Direct private origin bypasses web gate | Anonymous direct-origin probe denied; server-only object lookup and no public object URL |
| Session is absent or forged | 401 before any private asset read; signed session verified on the server |
| Library Pass inadvertently grants Research | Authenticated Library-only negative test returns 403 while Library content still works |
| Trial/expired/refunded entitlement leaks reports | State+effective-date tests deny as required; no client claim can override |
| Provider-data rights not approved | Candidate withheld; old content reviewed separately; no private delivery before member-rights approval |
| Preview/Production mismatch | Test both route stacks; do not rely on the Preview-only research middleware |
| CDN, crawler or browser caches private body | Headers and cache behavior inspected on the exact READY Preview; no public fallback |
| URL traversal or date abuse | Strict report type/date/path validation and non-report denial |
| Database/API failure | 503 with no member data and no fall-through to public static pages |
| Replay/idempotency is conflated with access QA | Use only synthetic lifecycle tests; do not create Production subscriptions, events or webhooks |
| Library/TradingView coupling | Library Pass preserved, TradingView absent from active member delivery |
| Paid-subscriber acceptance misclassified | QA grants, employee activity and synthetic tests excluded from genuine provider-backed first-subscriber evidence |

## Release order, owners and statuses

1. **Rights and editorial decision — HOLD:** pipeline [#155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) must explicitly resolve Score-derived public and commercial distribution, including legacy archives and sample.
2. **Historical public classification — HOLD:** review all 16 inventory rows, preserve existing public links and SEO consequences intentionally, document keep/redact/replace choices. Do not silently remove evidence.
3. **Development synthetic private delivery — NOT STARTED:** design private storage, render pipeline, database policy, server handler, and source-rights metadata without touching Production.
4. **Exact-head QA — NOT STARTED:** test all negative/positive cases using Development credentials and synthetic accounts only; verify no static/private source exposure.
5. **Production activation — NOT AUTHORIZED:** require human review, signed exact-head checks, READY Preview, budget confirmation and separate explicit Production approval.
6. **First genuine paid Research subscriber — INDEPENDENT HOLD:** remain under `research-membership-first-genuine-subscriber-runbook.md`. No staff/QA entitlement is acceptance evidence.

Current Draft PR #920 cannot be merged as a Production release under this record. A future private-delivery implementation must be separately reviewed and tested and must not overlap the pipeline's ongoing rights containment.
