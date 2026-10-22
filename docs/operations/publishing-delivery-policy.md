# USD Impact publishing delivery policy and operator handoff

Owner-approved direction: October 22, 2026. Maintained in the existing [PR #854](https://github.com/usdimpact/usd-impact-site/pull/854) workstream. This is a documentation-only operating procedure: merging it adopts the procedure, but does not install a scheduler, deadline executor, reviewer assignment, alert channel or automatic publisher.

## 1. Delivery and automation are separate outcomes

Deliver verified publications on a dependable cadence while measuring automation honestly. Record publication delivery, unattended candidate preparation, native schedule provenance and external-wake provenance separately. A reviewed editorial fallback or backstop candidate can satisfy delivery without establishing native scheduled recovery. Green no-ops, skipped substantive steps, synthetic tests, manually repaired copy and green Health workflows alone are not unattended acceptance.

The owner retains publication decisions. The owner's exact-copy approval for the October 22 edition is recorded in [PR #853](https://github.com/usdimpact/usd-impact-site/pull/853); it is not approval of unseen future editions. No standing backup reviewer is established here. A missing human editorial decision means `AWAITING_EDITORIAL_REVIEW`, not permission to self-approve or auto-merge.

## 2. Cadence and clocks

Editorial delivery clock: **Europe/Tirane**, calculated with the IANA timezone on the actual date. Machine schedules remain UTC. Bucharest is a different timezone; never describe Bucharest time as Albania time. All slots below are nominal triggers or editorial targets, not proof of actual execution.

| Product | Editorial delivery commitment | Existing execution/dependencies |
|---|---|---|
| Daily | Monday-Friday: assess at 14:00, target live at 16:00, escalate at 18:00 Tirane | Native 09:17 UTC weekdays; independent wake 09:32 UTC; existing backstops 12:17 and 15:47 UTC; natural Health 18:45 UTC. Existing repair, regeneration and dispatch budgets stay intact. |
| Weekly Score | Completed-Friday edition, protected review for Saturday morning delivery | Existing Friday 22:00 UTC workflow; eight valid inputs, exact-head quality and reproduction evidence, immutable archive and actual human review. Never hand-edit the score or invent inputs. |
| Weekly Report | Sunday, before the next trading week | Existing Sunday 08:17 UTC workflow; five published weekday Dailies and the exact completed-Friday immutable Score archive. |
| Monthly | When four eligible published Weekly Reports support a substantive synthesis | Preserve the current eligibility function: the first four published weekly periods after the latest published Monthly period end. Check continuity and editorial value; do not silently redefine this as a calendar-month report. |

A missed slot is not authority for a new dispatch, unlimited paid regeneration, bypassed source validation or backdated publication. If evidence or human review is unavailable, record a specific late/HOLD outcome and preserve the date of the last genuinely published edition.

## 3. One canonical record per edition

Use the existing dated publication PR as the release record. Before a PR exists, use the existing incident/operations workstream, not a parallel issue or watcher. Other chats must read that same record before acting. The public site workstream owns Daily/Weekly/Monthly publication; the existing `usdimpact/usd-impact-pipeline` workstream owns Score production and its protected review.

Before creating or changing a candidate, inspect actual time, current main, the exact dated file, all matching PRs including draft/closed/merged, and queued/in-progress/recent runs. Missing access or ambiguous dispatch receipts means `UNKNOWN/HOLD`, not absence. Never remove an existing file or PR to force a new opportunity. Do not reopen or replace a rejected candidate without an explicit editorial decision.

Daily duplicate-recognition contract: title `Publish Daily USD Impact — YYYY-MM-DD`; head prefix `automation/daily-usd-impact-YYYY-MM-DD-`; one content file `apps/web/src/content/news/YYYY-MM-DD.md`. An editorial fallback may use an explicit `editorial-` suffix and must declare `manual-editorial-fallback` prominently. Matching identifiers prevent duplicate preparation; they do not prove automated provenance.

These preflight lookups are snapshots, not an atomic lease. Refresh immediately before creating a candidate and before merging. If another candidate or an active/ambiguous paid operation appears, stop and reconcile; do not cancel it or race it. A stronger shared claim mechanism is not installed by this document.

## 4. Deadline decision procedure

The existing bounded acceptance watch remains read-only. The following procedure is for an authorized active publishing session; it is not a promise that an unattended agent will run at these times.

| Observation | Required handoff | Actions not authorized by the observation |
|---|---|---|
| Edition already published | Verify its actual release/deployment and dated live surfaces; record delivery; preserve its provenance | No replay, duplicate article or date rewrite |
| Matching PR exists in any state | Inspect and continue that exact editorial disposition; verify current head and checks | No competing fallback or generation to evade the PR |
| Generation queued, running or receipt ambiguous | Record `ACTIVE` or `UNKNOWN`; preserve its concurrency and budget; reconcile read-only evidence | No cancel, rerun, extra paid call or competing article |
| Attempt definitively failed and no competing candidate/active run exists | Record exact failed stage, then use the approved source-verified editorial route for one candidate | No source waiver, fabricated date, retry-budget reset or claim of native recovery |
| No run/candidate seen at nominal slot | Treat the schedule as possibly delayed; complete the same duplicate/active-run inspection | No assertion that nominal-slot absence proves scheduler failure |
| Candidate ready, no human decision yet | Present the actual text, coverage limitations, exact head, checks and Preview; record `AWAITING_EDITORIAL_REVIEW` | General project approval is not approval of unseen copy |
| Required check, source or Preview fails | Record precise `TECHNICAL_HOLD` or `SOURCE_HOLD` in the canonical candidate | No check bypass, guessed source, forced merge or substitute green run |

**14:00 Tirane:** apply this table and identify the one next responsible action. Prefer a valid native/backstop candidate. If the original attempt is definitively finished, or still no candidate exists after the full state check, the approved editorial fallback may be prepared; it does not purchase another generator request. A later native run can still appear, so preserve the snapshot/race limitation and recheck before writing.

**16:00 target:** deliver only a source-validated, technically green, human-approved candidate. If not ready, record the actual state and blocker; do not manufacture success to meet the target.

**18:00 escalation:** record `DELIVERED`, `LATE_REVIEW`, `LATE_TECHNICAL`, `LATE_SOURCE` or `UNKNOWN`, with the exact unmet gate and responsible human/workstream. The owner is the escalation decision-maker; the backup remains unassigned until the owner names one. Do not send email/customer messages or create additional automations under this procedure.

## 5. Source, review and release gates

Require at least three distinct eligible publisher-document URLs, each with its own verified release or permitted displayed update date, and actual use in retained highlights/catalysts. Search-result counts, discovery indexes, tracking variants and reused report pointers are not substitutes for supporting documents. Keep publication dates, observation periods, future event dates and capture times separate. Preserve Treasury dated-document restrictions. For EIA petroleum cite the verified release-specific archive, not `wpsrall.pdf` as an immutable identity.

Keep 3-7 complete highlights. Every retained source must support a retained claim. Forward CPI/PCE/payroll/FOMC references need matching primary-source-backed catalysts inside edition date through +7 days. No invented live prices/reactions, unsupported absence claims, stale releases presented as today's data, unused source padding or forecasts framed as facts. A quiet-day context edition must disclose its limits and receive human approval of its reader value.

Keep review copy separate from published status. Before release verify the current exact head's normal PR-event Web quality including npm audit, required checks, CodeQL, matching READY Preview and genuine human editorial/compliance disposition. A subsequent content change requires fresh editorial review. A status-only change after exact-copy approval still requires fresh exact-head technical checks. Preserve repository protections and use the expected-head guard for an authorized merge; no automatic merge is added here.

After merge, verify the actual commit/ancestry and READY canonical-alias deployment, dated article, news index, latest JSON and RSS. For Score, verify its own live dashboard and immutable archive rather than substitute Vercel site readiness. Store actual observation times. A draft, review-status file, merged PR alone or deployment without live verification is not complete delivery.

Native acceptance additionally requires the actual latest Daily run on main, `event=schedule`, substantive Start/Poll/Import/Preflight/Open-Validate-PR evidence, current source-defined age limits (12 hours since inspected completed run update at this baseline), and real run-to-PR lineage. Preserve the legitimate recovered-after-review path only for a qualifying publication-step failure with the preceding substantive steps successful and exact matching PR merged afterward. A manual fallback cannot repair failed generation retroactively.

Read the naturally scheduled Health run itself (`event=schedule`), report, successful Inspect step with typed `healthy`, successful Close recovered daily health issue step, and actual recovery record. A label, closed issue or intermediate classification alone is insufficient. This policy does not close #840 or #786.

## 6. Copyable evidence handoff

Fill this in the existing candidate/incident record using fresh evidence. `null/UNKNOWN` is preferable to an invented receipt. The template is not an executable scheduler or permission to write from a read-only watch.

```yaml
product: Daily | WeeklyScore | WeeklyReport | MonthlyReport
edition_or_period: YYYY-MM-DD
captured_at_utc: actual timestamp
captured_at_tirane: actual timezone-aware timestamp
responsible_workstream: existing canonical workstream
record_url: existing PR or incident URL
repository_main_sha: exact refreshed SHA
publication_delivery: NOT_DUE | PREPARING | AWAITING_EDITORIAL_REVIEW | HOLD | DELIVERED
candidate_provenance: native_schedule | backstop_dispatch | manual_editorial | UNKNOWN
run: {url: null, event: null, head_sha: null, attempt: null}
steps: {start: null, poll: null, import: null, content_preflight: null, open_validate_pr: null}
candidate: {url: null, head_sha: null, expected_file: null}
source_review: {receipt: null, eligible_used_documents: null, catalyst_review: null}
checks: {normal_pr_quality: null, audit: null, dependency_review: null, codeql: null, preview: null}
human_review: {reviewer: null, decision_receipt: null, approved_head: null, backup: unassigned}
release: {merge_sha: null, deployment_id: null, deployed_sha: null, ready: null}
live: {dated_article: null, news_index: null, latest_json: null, rss: null}
acceptance: {unattended_candidate: UNKNOWN, native_schedule: UNKNOWN, external_wake: UNKNOWN, health_close_gate: UNKNOWN}
blocker: actual unmet gate or null
next_action: one concrete existing-workstream action
```

The human review receipt must be an actual decision on the actual candidate. Do not fill a person's name or approval status from a guess. Do not include credentials, private request payloads or customer data.

## 7. Friday and weekend handoff: October 23-25, 2026

This is a dated preparation snapshot, not future acceptance. Site source baseline: `362024049efe37383d1e2eac69ea4a4a4d2c9377`; Score source baseline: `1bdd9a47796876e794bb6a24248ced8823f8b719`. Refresh both before execution. Review began October 22 at 16:29:42 UTC / 18:29:42 Tirane.

- October 19, 20, 21 and 22 Daily files were independently reread on site main and each has `status: published`. This is repository input readiness, not a new four-edition live-site audit. October 22 is the owner-approved manual editorial fallback in PR #853; its blob remains `1258f2d415d2beb5d7e7cb865644afc6618c84dc`.
- October 23 Daily file returned 404 at this baseline; an all-state exact-date publication-title search returned zero. It is not yet due at this snapshot. Do not pre-create placeholder content or republish October 22.
- PR #855's source-first improvement is released. Its code tests and deployment are not fresh native acceptance. Keep #840 and #786 open until their actual recovery contracts are satisfied.
- Weekly Report generation already enforces five published Dailies plus `https://score.usd-impact.com/archive/2026-10-23/weekly_input.json`, with eight drivers, eight fresh source-provenance records and no added external-event claims. The future archive is a target to verify after the real Score release, not evidence that it exists now. Do not substitute October 16's archive.
- The latest Monthly file is the published four-week report ending October 16. Its inputs are September 25, October 2, October 9 and October 16. Those periods must not be counted again toward a new Monthly. Re-evaluate the next four eligible published weekly inputs when available; no new Monthly is prepared by this handoff.

| Scheduled event | UTC | Europe/Tirane | Europe/Bucharest |
|---|---|---|---|
| Friday Daily | Oct 23 09:17 | Oct 23 11:17 | Oct 23 12:17 |
| Independent wake | Oct 23 09:32 | Oct 23 11:32 | Oct 23 12:32 |
| First backstop | Oct 23 12:17 | Oct 23 14:17 | Oct 23 15:17 |
| Second backstop | Oct 23 15:47 | Oct 23 17:47 | Oct 23 18:47 |
| Natural Daily Health | Oct 23 18:45 | Oct 23 20:45 | Oct 23 21:45 |
| Completed-Friday Score | Oct 23 22:00 | Oct 24 00:00 | Oct 24 01:00 |
| Sunday Weekly Report | Oct 25 08:17 | Oct 25 09:17 | Oct 25 10:17 |

Local conversions use IANA rules, including the October 25 clock change; do not carry Friday's UTC offsets into Sunday. None of these schedule entries guarantees a run receipt or protected publication.

Score review/reproduction remains owned by the existing pipeline workstream and existing Weekly acceptance watch, including its PR #133/issue #132 boundary. This site policy does not merge that checker or duplicate its pending-week experiment. The Weekly Report follows only after the genuine Friday Score and five Daily inputs are published. Missing/invalid inputs mean HOLD, never estimates or date substitutions.

## 8. Adoption and remaining operational gates

This one-file policy is the scope of PR #854. Its main refresh preserves the original draft history and incorporates already released PR #853/#855 changes without editing their content. Repository adoption requires normal current-head checks and a protected merge. The Git integration may automatically build a documentation-only commit; no manual deployment, provider call or configuration change is introduced.

The manual operator procedure and evidence template are ready for use by an authorized active session. Two continuous-operation gaps remain explicit:

1. **Human coverage:** the owner has demonstrated exact-copy review for October 22; ongoing reviewer availability and a named backup have not been established. Obtain real coverage, not fabricated signoffs.
2. **Deadline executor:** no mechanism is installed by this document to execute the 14:00/16:00/18:00 handoff unattended. Before claiming coverage, review the existing control surface, prove single-edition ownership/concurrency, read-only decision behavior, human-review hold and failure escalation with offline tests, then obtain applicable installation authority. Do not repurpose the read-only acceptance watch or add a duplicate watcher as a shortcut.

Preserve existing schedules and budgets, all source/security/publication protections, published archives, and other chats' ownership. No private Render runtime, database, customer, commerce, email, credential, provider or security change is authorized by this document. The bounded Daily acceptance watch remains read-only and ends under its existing schedule; it is not a permanent publisher.

## Reviewed source contracts

- [Daily workflow](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/.github/workflows/daily-news.yml)
- [Independent wake guard](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/apps/web/src/lib/daily-news-schedule-wake.js)
- [Backstop workflow](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/.github/workflows/daily-news-schedule-backstop.yml)
- [Daily Health](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/.github/workflows/daily-news-health.yml)
- [Weekly Report workflow](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/.github/workflows/weekly-report.yml)
- [Monthly eligibility](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/apps/web/src/lib/report-periods.js)
- [Published Monthly period](https://github.com/usdimpact/usd-impact-site/blob/362024049efe37383d1e2eac69ea4a4a4d2c9377/apps/web/src/content/monthly-reports/2026-10-16.md)
- [Weekly Score workflow](https://github.com/usdimpact/usd-impact-pipeline/blob/1bdd9a47796876e794bb6a24248ced8823f8b719/.github/workflows/weekly.yml)
