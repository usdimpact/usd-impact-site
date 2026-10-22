# USD Impact publishing delivery policy

Owner approved the delivery-first direction on October 22, 2026 and authorized applying the prepared packet in the existing publishing conversation. This repository review candidate records that direction; it is **not an installed scheduler, a named human review, or a guarantee of future execution**. Companion October 22 editorial candidate: [PR #853](https://github.com/usdimpact/usd-impact-site/pull/853).

## Objective and two independent outcomes

Deliver useful, verified publication on a dependable cadence while measuring automation honestly. For each edition record (1) publication delivery and (2) native automation acceptance separately. A reviewed editorial fallback or backstop candidate can satisfy delivery but cannot establish native scheduled recovery. A green no-op, test fixture, manually patched publication PR, or green Health run without the actual closure contract is not unattended acceptance.

## Approved cadence

Delivery clock: **Europe/Tirane**, using the IANA timezone rather than a permanent UTC offset. Existing machine schedules remain UTC and are not changed by this document. Bucharest is a different timezone; do not label its time as Albania time.

| Product | Delivery direction | Existing source schedule / dependencies |
|---|---|---|
| Daily | Monday-Friday; assess candidate at 14:00, target live at 16:00, escalate incomplete delivery at 18:00 Tirane | Native 09:17 UTC weekdays; independent wake 09:32 UTC; existing backstops 12:17 and 15:47 UTC. Bounded repair/regeneration and one-dispatch controls remain intact. |
| Weekly Score | Completed-Friday edition, reviewed for Saturday morning release | Friday 22:00 UTC existing Score workflow; eight valid inputs, exact candidate quality and reproduction evidence, protected review. Never hand-edit the score or manufacture inputs. |
| Weekly Report | Sunday, before the next trading week | Sunday 08:17 UTC existing workflow; five published weekday Dailies plus the immutable completed-Friday Score archive. Missing inputs mean HOLD, not invented or backdated content. |
| Monthly | After four eligible published Weekly Reports and a meaningful synthesis review | Preserve period eligibility: four published weeklies after the latest published monthly period end. Review reporting-period completeness explicitly. |

Nominal trigger time is not proof of actual execution. Deadlines are editorial escalation targets, not instructions to remove safeguards. If authoritative data or review is unavailable, record a late/held publication openly rather than fabricate content.

## One record and one owner per edition

Use the existing repository/workstream as the durable record. Key each record by product and exact date/period. Record responsible workstream, actual run/event/head, source review, candidate PR/head, required checks, named human editorial/compliance review, publication approval, merge SHA, actual alias deployment and live checks. Do not create a parallel investigation, repeated monitoring task, or competing PR.

The account owner retains delivery decisions. Named editorial reviewer and backup reviewer are **not established by this document** and must be assigned in the actual publishing process. No assistant may represent its own source checks or a general owner approval as an independent human signoff on unseen copy.

## Daily 14:00 handoff and fallback

1. Read actual time, current main, exact-date article, all exact-date PR states, and active/recent runs before deciding anything. Preserve closed/draft/merged editorial dispositions.
2. Prefer an already valid native or backstop candidate. Verify sources, 3-7 highlights, source/date fidelity, structured in-window catalysts and normal exact-head checks. Do not rerun solely to change provenance.
3. If the attempt definitively failed, or no candidate exists at the handoff, prepare one source-verified editorial fallback under the approved delivery policy. This is editorial work, not another paid generator request. Paid regeneration/dispatch budgets are not reset.
4. An active or ambiguously completed paid run is a HOLD for competing publication work. Reconcile receipts rather than cancel, dispatch, rerun, delete an article, or remove a PR to force an opportunity.
5. Preserve actual edition, capture and publication times. Older releases may provide explicitly dated context; they must not be represented as newly released today. A selective context edition needs editorial approval of reader value and limitations. No unsupported claim that nothing was published is permitted.
6. Retain the same content/security/build/Preview gates and human review as the normal route. Set publication status only through the authorized candidate release. No automatic merge is added.

### Existing guard limitation

The Daily preflight matches the exact title `Publish Daily USD Impact — YYYY-MM-DD` and branch prefix `automation/daily-usd-impact-YYYY-MM-DD-`. An editorial PR with unrelated identifiers is not proven to reserve that date against a delayed native run. A recognized prefix with an explicit `editorial-` suffix may be used only with unambiguous manual provenance in its body and record; it never constitutes automated-generation evidence.

The lookup is a snapshot, not an atomic editorial claim. Refresh active runs immediately before opening a candidate and again before merging. If another candidate/run appears, hold and reconcile without replacing it. A stronger shared claim/lease mechanism would require a separately tested source change; it is not installed by this document.

## Source and claim standards

Require at least three distinct eligible publisher-document URLs with their own verified release or displayed update dates and substantive use in highlights/catalysts. Discovery indexes, reused report pointers and edition/access dates cannot substitute for dated documents. Keep release dates, observation periods, event dates and retrieval times separate. For EIA petroleum use the verified exact dated release archive, never `wpsrall.pdf` as an immutable identity. Preserve Treasury dated-document restrictions.

Every retained source must support a retained claim. Keep 3-7 complete highlights. Forward CPI, PCE, payroll or FOMC references must match a primary-source-backed catalyst inside the edition through +7-day window. No invented market prices/reactions, unsupported absence claims, incomplete source padding or forecast framed as fact.

## Release acceptance

Check the unchanged candidate head: Web quality including npm audit, normal required PR checks, CodeQL and matching READY Preview. Independent human editorial review remains mandatory. After an authorized merge verify main/merge ancestry, exact READY alias deployment, dated article, latest JSON, news index and RSS. Record actual verification timestamps. A draft or review-status file is not delivered publication.

Native acceptance additionally requires a real `event=schedule` Daily run with substantive Start/Poll/Import/Preflight/Open-Validate-PR evidence and source-defined latest-run/age requirements. Preserve the legitimate recovered-after-review path only when its exact run-to-PR lineage qualifies; manual fallback does not transform failed generation into success. Read the naturally scheduled Health report, typed healthy state and executed close gate. Incidents #840 and #786 are not closed by this document or by manual delivery.

## Weekly and Monthly handoff

Resolve all five weekday delivery records before the Sunday report. Release the genuine completed-Friday Score through its existing reproducible process. Generate the report only from those published inputs. Preserve immutable Score archives. A missing/invalid Score blocks the dependent report rather than permitting an estimate. Monthly synthesis follows its existing four-week eligibility and protected editorial process; do not silently change the definition into calendar-month reporting.

## Acceptance watch versus execution

Reuse the existing bounded Daily Acceptance watch as read-only observation only. It is not a fallback publisher and must not be treated as an operational executor after its final scheduled check. No watch, cron, notification setting, provider configuration, credential or deployment is created or changed by this document.

## Current implementation boundaries

- Delivery policy: owner-approved direction submitted as this documentation-only review candidate. Repository adoption requires its own protected merge.
- October 22 delivery: [PR #853](https://github.com/usdimpact/usd-impact-site/pull/853) is the canonical candidate record. Read its actual current head, review disposition and checks; do not duplicate it or assume it is published.
- Named editorial/backup roles and a durable deadline executor remain unresolved. A Markdown policy does not implement either.
- Existing schedules, retry budgets, source validators, protected publication, private Render runtime, customer/email/commerce and security settings remain unchanged.

## Reviewed source contracts

Baseline: `fc86e692e8cfac182c265313e9f1ecb02fd9db12`. Refresh current code before any operation.

- [Daily workflow](https://github.com/usdimpact/usd-impact-site/blob/fc86e692e8cfac182c265313e9f1ecb02fd9db12/.github/workflows/daily-news.yml)
- [Backstop workflow](https://github.com/usdimpact/usd-impact-site/blob/fc86e692e8cfac182c265313e9f1ecb02fd9db12/.github/workflows/daily-news-schedule-backstop.yml)
- [Weekly Report workflow](https://github.com/usdimpact/usd-impact-site/blob/fc86e692e8cfac182c265313e9f1ecb02fd9db12/.github/workflows/weekly-report.yml)
- [Monthly eligibility](https://github.com/usdimpact/usd-impact-site/blob/fc86e692e8cfac182c265313e9f1ecb02fd9db12/apps/web/src/lib/report-periods.js)
- [Weekly Score workflow](https://github.com/usdimpact/usd-impact-pipeline/blob/main/.github/workflows/weekly.yml) (read-only reference; refresh that repository before any Score operation).
