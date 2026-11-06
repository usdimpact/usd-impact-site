# Daily USD Impact: verified carry-forward and afternoon recovery (owner direction 2026-11-06)

Status: **DRAFT / fail-closed activation hold until exact-head CI and Production receipt.** This is a new delivery lane, not proof that GitHub native scheduling or original generator automation has recovered (#840).

## Editorial decision

A weekday Daily edition should not be omitted solely because there was no significant same-day official release. Prefer official facts released today; if insufficient, use separately dated, independently sourced primary releases and announcements from the preceding **14 calendar days**. Identify the original publication and reference periods, label the edition **carry-forward**, and use a new review date without claiming that earlier facts were released today. An educational look-ahead based on a dated original announcement is valid; invented outcomes, prices, source dates, calendar publication dates, unsupported absence assertions and unstated source reuse are never valid.

Three verified eligible source documents and three source-grounded highlights remain mandatory. If that threshold fails, the workflow must HOLD with a concrete reason rather than publish fabricated context or duplicate an older edition without attribution.

## Two distinct scheduled checks

- Existing first chance: native weekday **09:17 UTC** Daily, Vercel independent wake at **09:32 UTC**, original bounded backstops **10:47 and 11:07 UTC**. The first generator spends only according to its existing one-recovery budget and original publication rules.
- New *no-paid* later chance: native GitHub schedule **15:47 UTC weekdays**, with an independent Vercel cron to `/api/daily-news-late-wake` at **15:47 UTC** after reviewed activation. The Vercel rewrite reuses the existing protected `daily-news-grounded-background` function, so no additional function or model call is introduced. It wakes `daily-news-late-carryforward.yml` only in the bounded 15:40–17:30 UTC window, when `DAILY_NEWS_SCHEDULE_WAKE_ENABLED=true` and independently `DAILY_NEWS_LATE_FALLBACK_ENABLED=true` in Production. The late wake does **not** rerun the paid generator and can proceed after a previous bounded original generation failed, provided no live generator or source/editorial PR exists.

The extra Vercel and GitHub triggers share the late workflow's serialized concurrency group. An existing dated article or matching PR, active generator, prior ambiguous/failed late execution, uncertain repository evidence, expired UTC weekday window or invalid authentication prevents a new candidate.

## Safe provenance-only fallback

`apps/web/scripts/create-daily-carry-forward.mjs` opens a *previously published* Daily from the last seven days and selects three to four distinct eligible primary documents with actual `publishedAt` dates no more than 14 days before the new edition. It rejects mutable/rolling indexes (including the conflicting BLS month calendars), off-domain URLs, future/stale documents, conflicting historical dates in the archived news ledger and duplicate source IDs. This produces original-date-labeled educational context, not new events, market movements or unverified claims. Offline regression tests prove failure when adequate documents are unavailable.

A qualified run opens exactly one GitHub App-authored publication PR touching only `apps/web/src/content/news/YYYY-MM-DD.md`. **The late workflow DOES NOT auto-approve or merge a PR.** The PR must obtain all three genuine eligible `pull_request` checks, actual source/editorial review, normal protected merge, exact-SHA READY Vercel Production and independent live article/index/latest.json/RSS verification before reporting `PUBLISHED_MANUAL_LATE`. No late path may be labeled `PUBLISHED_AUTO_ON_TIME` or count as native GitHub schedule recovery.

## Activation and rollback

1. Review the exact main-based PR and require the three genuine GitHub checks, CodeQL, regressions and Preview. Do not treat dispatch successes as ruleset checks.
2. Protected-merge, verify corresponding Vercel Production READY and existing public routes first.
3. After a separate review of the Production cron registration and secure flag scopes, enable **Production only** `DAILY_NEWS_LATE_FALLBACK_ENABLED=true`; leave all existing credentials and `CRON_SECRET` unchanged. Never print their values.
4. Observe the next real *natural* weekday, including one Vercel runtime wake receipt, any native GitHub schedule receipt, the late PR, genuine checks and eventual protected/live publication. A wake's HTTP 204/202 is not publication.
5. To pause the late external wake, disable the flag; to stop invocations, remove the single new Vercel cron and GitHub cron via a reviewed change. Do not delete historical PRs or backdate articles.

The separate BLS safeguard repair from #1175 was ported onto the new branch because merging the older PR after main advanced was rejected by the required-check ruleset. Historical archived citations are unchanged. All Score, Weekly, Monthly, rights, commerce, account deletion and security holds are unchanged.
