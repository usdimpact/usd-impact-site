# Daily independent schedule wake - staged repair for incident #786

Status (2026-10-17): CRON REGISTERED IN REPOSITORY; LIVE ACCEPTANCE UNVERIFIED.
`apps/web/vercel.json` contains one weekday 09:32 UTC (`32 9 * * 1-5`) cron for
`/api/daily-news-grounded-background`, registered in
[activation commit e45ce1d](https://github.com/usdimpact/usd-impact-site/commit/e45ce1d32f8a791e1b933c93a358be72147d773c).
Current Production runtime enablement and live native/external acceptance are not
established by this repository evidence. The activation section below is retained
as the original setup runbook; do not repeat registration or activation from it.

## Why this repair

Native Daily runs #38581525232, #38749369958 and #38912187326 were created
5h16m08s, 4h55m46s and 4h42m45s after the 09:17 UTC schedule. Their jobs began
2-3 seconds after creation. The observed bottleneck is before run creation.
GitHub's internal cause is not established; moving a cron a few minutes does not
provide an independent clock.

Proposed route: Vercel Cron -> authenticated wake adapter -> EXISTING GitHub
schedule-backstop workflow -> EXISTING Daily workflow -> protected editorial PR.
The adapter cannot choose another repository, branch, date, or source endpoint.
The wake adapter never reads a model credential or calls an OpenAI endpoint.

## What the code does

- Default off; requires Production and DAILY_NEWS_SCHEDULE_WAKE_ENABLED=true.
- Reuses the existing daily-news-grounded-background function to preserve the 12-function source limit.
  Vercel's documented vercel-cron/1.0 user-agent selects an isolated early-return route;
  the user-agent is NOT authentication. Exact Bearer CRON_SECRET (at least 32 characters)
  remains mandatory, and URL parameters are rejected.
- Restricts execution to UTC weekdays, 09:32 inclusive through 16:30 exclusive.
- Establishes repository access before interpreting a contents 404 as absence.
- Respects existing articles and matching PRs in ALL states, including drafts/closed
  PRs. PR inspection is paginated and bounded; incomplete evidence is HOLD.
- Refuses an extra wake when a Daily/backstop is active, a Daily workflow_dispatch
  already consumed the recovery budget, an external backstop wake exists, or a
  previous backstop has a failed/cancelled/unknown conclusion.
- Can POST only to daily-news-schedule-backstop.yml on main. Never dispatches Daily
  directly. HTTP 204 means only that GitHub accepted the wake request.
- Never retries a dispatch after an ambiguous acknowledgement. No publication,
  issue closure, merge, customer, commerce, or source-content writes are added.

The existing backstop retains its schedule and concurrency group, so native
backstop events and external wakes use the SAME serialized recovery authority.
Duplicate wake requests can still occur at the HTTP layer; they are not exactly-once
delivery. The backstop retains its one-Daily-recovery budget, waits for a visible
run receipt while holding its concurrency group, and fails closed on uncertain
receipts. A subsequent backstop refuses automatic retries after an earlier failed
or cancelled backstop. That conservative HOLD can require operator reconciliation;
it must not be cleared by rerunning blindly.

The backstop also now rejects authentication/transport failures instead of treating
all article-lookup failures as missing content. Contents and PR permissions remain
read-only. The primary generator, Treasury source guard and Health closure rules
are unchanged. Only the existing grounded function's reserved cron routing is added;
its previous generation implementation is checked byte-for-byte in the tests.

## Offline verification

From apps/web:

    node scripts/test-daily-news-schedule-wake.mjs
    npm run validate:automation-health

The new tests use mocked fetch calls plus local gh/date/sleep stand-ins to execute
the actual backstop shell. They make no live GitHub dispatch or model call. Existing
Health tests import this suite, so the normal CI route includes it without a new
workflow. Unit tests do not establish deployment, credential, scheduler or source
acceptance.

## Separate activation gate - approval required

The earlier no-new-automation/no-scheduler-change restriction remains an activation
boundary. Do NOT activate from this document alone.

After explicit approval and exact-head CI/CodeQL/Preview review:

1. Protected-merge the code, independently verify its Production merge SHA and
   READY deployment. Leave the new flag absent/false during deployment verification.
2. Securely configure DAILY_NEWS_SCHEDULE_GITHUB_TOKEN in Production only, scoped
   only to usdimpact/usd-impact-site: Actions write, Contents read, Pull requests read
   and Metadata read. Never retrieve or paste its value into chat, Git or logs.
   Validate the existing CRON_SECRET securely; do not rotate a shared cron secret
   without reviewing its other consumers. No secret is provisioned by this PR.
3. In a separately reviewed activation change, add exactly one entry to the EXISTING
   apps/web/vercel.json crons array, preserving all other entries:

       { "path": "/api/daily-news-grounded-background", "schedule": "32 9 * * 1-5" }

   Set DAILY_NEWS_SCHEDULE_WAKE_ENABLED=true in Production only. There is a
   15-minute grace after the native primary. 09:32 UTC is 12:32 Bucharest on
   October 19, 2026; the cron remains UTC across daylight-saving changes.
   Provisioning/activation must not cause a manual test generation. Observe the
   next real scheduled event instead.
4. Confirm the deployed cron, target, time window and secret presence without
   printing secrets. Record the Vercel wake log, accepted backstop request, actual
   backstop run, Daily run receipt, source evidence and editorial PR separately.

The observed Vercel team is Pro. Cron registration has no separate subscription
charge under the cited documentation; function invocations and GitHub Actions
consume ordinary usage. This change does not increase the existing Daily recovery
budget, and does not promise zero incremental usage or eliminate provider outages.

## Acceptance and rollback

External wake success is NOT native event=schedule acceptance. Verify Start, Poll,
Import, Validate and automated PR; source grounding/freshness; editorial approval;
exact-head CI/CodeQL and READY Preview; protected merge; matching READY Production;
live article/index/JSON/RSS; and the authentic Health report. The unchanged Health
workflow may report non_scheduled_handoff for an external/backstop Daily dispatch.
Do not override that classification or close #786 as native recovery.

Keep matching manual-fallback PRs absent during a genuine acceptance window.
If editorial review is pending, report HOLD, not published. A manually authored
fallback always retains manual provenance. A safety failure remains a failure,
not permission to weaken the Treasury source-date guard.

Disable the Production wake flag to stop new wakes; remove the single cron entry
through a reviewed change to stop invocations. Vercel rollback alone is not a
cron-disable procedure. Do not cancel an existing generator or delete evidence.

References:
- https://github.com/usdimpact/usd-impact-site/issues/786
- https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- https://vercel.com/docs/cron-jobs
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs/usage-and-pricing
