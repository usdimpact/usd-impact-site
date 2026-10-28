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
