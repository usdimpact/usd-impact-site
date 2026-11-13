# Daily Issue #840 — native scheduler reliability, provenance, and unattended acceptance

**Evidence cut:** 2026-11-09, after owner-approved publication and publisher reliability releases.  
**Owner:** existing Daily workstream exclusively; E1 remains an archived offline evidence lane.  
**Status:** REVIEW-ONLY engineering and operations plan. **NO-GO** for new routes, schedule/credential/permission changes, automatic incident completion, new model requests, or revised publication eligibility. This document does not authorize any operational change.

## 1. Protected baseline and released corrections

- The November 9 edition is **PUBLISHED_MANUAL_LATE** at [the dated article](https://www.usd-impact.com/news/2026-11-09/). A one-file editorial recovery [PR #1212](https://github.com/usdimpact/usd-impact-site/pull/1212) used an owner-approved protected merge at \`84a4fc10563957cacc7988f4e36ca559b164e319\`; that was not an unattended publisher pass.
- The fail-closed publisher check-readiness correction [PR #1213](https://github.com/usdimpact/usd-impact-site/pull/1213) merged at \`89a6a43a23f17732c37f6a209247ebd145c9e3c5\`, with 4/4 exact-head PR CI success and successful post-merge Vercel Production verification.
- The future late carry-forward PR incident-closure keyword fix [PR #1214](https://github.com/usdimpact/usd-impact-site/pull/1214) merged at \`b845f841ce9f9d4b915b9c4a04a8548a3604c311\`; 4/4 exact-head PR CI success; READY Production deployment \`dpl_B1nqWGMYXmpqevtykQ1KUf1XytVR\` and alias \`www.usd-impact.com\` match that exact SHA. The change is precisely one fallback PR template line and its regression assertion.
- After the #1214 Production deployment, independent read-only retrieval again found November 9 on [article](https://www.usd-impact.com/news/2026-11-09/), [News index](https://www.usd-impact.com/news/), [latest.json](https://www.usd-impact.com/news/latest.json), and [RSS](https://www.usd-impact.com/news/feed.xml).
- **Keep Issue #840 OPEN.** Neither a manually approved article nor green engineering CI establishes a genuine native unattended publication.

## 2. Exact historical native GitHub schedule evidence

The default-branch [generator workflow](https://github.com/usdimpact/usd-impact-site/blob/main/.github/workflows/daily-news.yml) declares \`17 9 * * 1-5\`, or 09:17 UTC weekdays. GitHub Actions' dated \`event=schedule\` run collection was read, not inferred from PR, Vercel or workflow-dispatch timestamps.

| Date (UTC) | Expected generator cron | Actual native generator run | Created-at delay | Event/result |
|---|---|---|---|---|
| 2026-11-04 | 09:17:00 | [#41876443856](https://github.com/usdimpact/usd-impact-site/actions/runs/41876443856) at 17:19:16 | 8h 02m 16s | \`schedule\` / success |
| 2026-11-05 | 09:17:00 | [#42074747229](https://github.com/usdimpact/usd-impact-site/actions/runs/42074747229) at 17:27:10 | 8h 10m 10s | \`schedule\` / success |
| 2026-11-06 | 09:17:00 | [#42255797444](https://github.com/usdimpact/usd-impact-site/actions/runs/42255797444) at 16:48:31 | 7h 31m 31s | \`schedule\` / success |
| 2026-11-09 | 09:17:00 | No matching native event in the complete dated scheduled-run response (11 total scheduled events for other workflows) | Missing, not quantifiable | **No native generator proof** |

The default-branch [Health workflow](https://github.com/usdimpact/usd-impact-site/blob/main/.github/workflows/daily-news-health.yml) declares \`45 18 * * 1-5\`, or 18:45 UTC weekdays:

| Date | Expected Health | Actual native Health created | Delay |
|---|---|---|---|
| Nov 4 | 18:45 UTC | [#41937589697](https://github.com/usdimpact/usd-impact-site/actions/runs/41937589697), 23:56:31 UTC | 5h 11m 31s |
| Nov 5 | 18:45 UTC | [#42132481520](https://github.com/usdimpact/usd-impact-site/actions/runs/42132481520), 23:50:52 UTC | 5h 05m 52s |
| Nov 6 | 18:45 UTC | [#42312543928](https://github.com/usdimpact/usd-impact-site/actions/runs/42312543928), 23:32:08 UTC | 4h 47m 08s |
| Nov 9 | 18:45 UTC | No matching native scheduled Health record in complete dated query | **Unverified / missing** |

The official GitHub [scheduled-event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) confirms that some scheduled jobs can be delayed or dropped under load. These observations are consistent with a scheduler-delivery problem **but do not identify GitHub's internal root cause**. GitHub workflow actor/enablement, run creation, native schedule-event records, and GitHub Support diagnosis require separate checks. Do not attribute to workflow YAML/test code merely because scheduled runs are absent.

## 3. Distinct triggers — never collapse provenance

| Lane | Trigger and configured time (UTC) | Permitted activity | What it establishes |
|---|---|---|---|
| A. Original GitHub scheduler | \`daily-news.yml\` \`schedule\`, 09:17 Mon–Fri | One normal source run subject to preflight, budget and source gates | Eligible **native scheduler** lineage only if true \`event=schedule\` and real content steps |
| B. Vercel independent wake | \`apps/web/vercel.json\` cron \`32 9 * * 1-5\`, 09:32 | Authenticated \`/api/daily-news-grounded-background\` wake adapter may dispatch existing GitHub backstop | External Vercel wake lineage, **not** GitHub native schedule |
| C. GitHub recovery backstops | \`daily-news-schedule-backstop.yml\`, 10:47 and 11:07 weekdays | Fail-closed one-recovery-budget dispatch to Daily after checking main/article/PR/runs | Recovery, even if originating from GitHub native backstop schedule |
| D. Late, editorial only | GitHub carry-forward 15:47 UTC; Vercel late wake 15:47 UTC | One safe carry-forward PR candidate, no paid model request and never auto-merge | **Manual-late candidate**, never original Daily proof |
| E. Monitoring | Early advisory 14:00 UTC; Health 18:45 UTC | Read and report real state, optionally comment; Health incident state is separately owner-gated | Independent observation; not a source event or an approved publication |

Nov 9 actual events: Vercel/GitHub-independent recovery path is consistent with [backstop workflow_dispatch #42594180420](https://github.com/usdimpact/usd-impact-site/actions/runs/42594180420) at 09:32:11 UTC, [Daily generator workflow_dispatch #42594199765](https://github.com/usdimpact/usd-impact-site/actions/runs/42594199765) at 09:32:20 UTC, and [publisher workflow_dispatch #42594777663](https://github.com/usdimpact/usd-impact-site/actions/runs/42594777663) at 09:36:54 UTC. These are immutable GitHub receipts; **the exact originating Vercel Cron invocation was not independently recovered from runtime logs**. Bot-triggered workflow_dispatch is not equivalent to original schedule. No Vercel schedule success claim should be inferred only from these dispatches.

Current wake source \`apps/web/src/lib/daily-news-schedule-wake.js\` requires Production, explicit opt-in, trusted Bearer cron secret, fixed repo/branch, no extra draft/PR, budget and status checks; no new secret was inspected in this review. Existing route \`apps/web/api/daily-news-grounded-background.js\` returns to the wake handler on the Vercel cron user-agent before any model provider code. **User-agent alone is never authentication or sufficient provenance.** Refer to [prior staged wake runbook](https://github.com/usdimpact/usd-impact-site/blob/main/docs/daily-independent-wake-rollout.md) without re-running its activation instructions.

## 4. Cutoff, timezone and real acceptance constraints

The publisher hard-stop is **strictly before 08:30 America/New_York**. On Nov 10, 2026 Eastern is EST (UTC−05:00) and Europe/Tirane is CET (UTC+01:00), hence the cutoff is 13:30 UTC / 14:30 Tirana. The configured 09:17 UTC Daily and 09:32 UTC Vercel wake have time to start ahead of this cutoff; delayed 16–17 UTC GitHub native starts do not.

The owner-requested automated read-only acceptance check is scheduled for Tuesday Nov 10 at **21:00 Europe/Tirane** (20:00 UTC), after the *nominal* 18:45 UTC Health start. However, Health was created after 23:30 UTC on several recent days. A 20:00 UTC review therefore **must report HEALTH NOT YET VERIFIED** if the true Health event has not occurred; it must not claim the absence of a final Health report proves no later scheduled run can occur. Preserve run IDs for a later retrospective.

## 5. End-to-end acceptance checklist (Nov 10 edition)

1. **Identity:** repo \`usdimpact/usd-impact-site\`, workflow path, default \`main\`, event \`schedule\`, original run attempt \`1\`, source-day in UTC weekday, actor, and created_at before permitted cutoff; no manual replay masquerading as a new natural run.
2. **Budget:** inspect every dated Daily run and any Vercel/backstop dispatch, all existing publication PRs in all states, and dated file on \`main\`. No duplicate paid generation. If source run has \`preflight: no-op\`, classify no-op, not substantive generation.
3. **Source pipeline:** real success of Start/Poll/Import/Content Validation and Open-Validate-PR steps; exact source hashes, 3+ distinct primary publisher documents, date-verified publication/forward catalysts, source rights and educational note. No invented official auction outcome or rolling PDF pointer.
4. **Original bot PR:** one non-Draft App-created PR, exact \`automation/daily-usd-impact-YYYY-MM-DD-RUN_ID\` ref and original single-file commit; unchanged head and base SHAs, no human edits or rebuilt synthetic PR replacing evidence.
5. **Exact-head PR quality/security:** successful native \`validate-and-build\`, \`Dependency review\`, Production migration guard, CodeQL; verify check-run identity and SHA rather than only separately dispatched CI success. Vercel Preview READY at reviewed SHA.
6. **Protected merge:** trusted publisher runs naturally via source \`workflow_run\` and has immutable source/PR receipts, no drift, final clean mergeability, normal branch protections, 08:30 ET hard cutoff and protected exact-head squash merge. For a separate authorized backstop path, record \`workflow_dispatch\` explicitly, **not as native acceptance**.
7. **Production:** Vercel Production deployment READY at exact new protected-main merge SHA and \`www.usd-impact.com\` alias mapped to it. No checked Preview can substitute.
8. **Public parity:** HTTP-served date \`2026-11-10\` at the article, News index, \`/news/latest.json\`, and \`/news/feed.xml\`; confirm title/date match; do not infer from Markdown frontmatter \`status=published\`.
9. **Health:** independently inspect early advisory and authentic \`event=schedule\` Health run, source lineage, outcomes, and the owner-controlled \`DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED\` flag **without reading any secret**. If scheduled Health is absent/delayed, mark pending. Never mark Health healthy because a manual or backstop edition exists.
10. **Disposition:** \`PUBLISHED_AUTO_NATIVE_ON_TIME\` only with all above native proofs; \`PUBLISHED_AUTO_EXTERNAL_ON_TIME\` only if a separately owner-approved Vercel-specific provenance contract exists (not approved here); \`PUBLISHED_MANUAL_LATE\` for owner-approved late copy; \`HOLD\` otherwise. Keep Issue #840 OPEN absent the genuine agreed acceptance proof.

## 6. Failure-first negative tests required for any future scheduling remedy

No new runtime code is proposed in this document. Any candidate to make a non-GitHub wake qualify for unattended acceptance must include at least these **independent, executable** negative cases, tested on isolated fixtures:

| ID | Failure case | Required outcome |
|---|---|---|
| S01 | Schedule event absent; only valid bot workflow_dispatch | NOT native schedule acceptance |
| S02 | Manual or rerun \`run_attempt > 1\` | HOLD |
| S03 | Native source created after 08:30 ET | HOLD for auto publication |
| S04 | Created_at day differs from publication date | HOLD |
| S05 | Duplicate source request / Vercel wake / backstop acceptance | Single budget; no extra paid generation |
| S06 | Unknown GitHub API response, 401, 403, 429 or 500 | HOLD, not absence |
| S07 | PR already exists in closed, Draft or merged state | Do not duplicate |
| S08 | Existing file exists on main | NOOP; preserve provenance |
| S09 | Source start/poll/import/validate incomplete | HOLD |
| S10 | Less than three distinct official dated documents | HOLD |
| S11 | Source URL fabricated or rolling undated index | HOLD |
| S12 | GitHub App author identity cannot be established | HOLD |
| S13 | PR head/main/base moved during check wait | HOLD |
| S14 | Required check missing, wrong App or wrong exact SHA | HOLD |
| S15 | Vercel Preview READY but Production wrong SHA | HOLD |
| S16 | Branch conflict, blocked, dirty, unstable or merge disallowed | HOLD |
| S17 | Cutoff passes while waiting for native checks | HOLD |
| S18 | Deployment READY but latest JSON/index/feed out of sync | HOLD |
| S19 | No natural scheduled Health; manual Health succeeded | HEALTH NOT VERIFIED |
| S20 | Vercel cron user-agent forged, missing/bad secret | 401/403, no dispatch |
| S21 | Ambiguous dispatch acknowledgement or service failure | HOLD; never blind retry |
| S22 | PR body includes negated GitHub issue-closing keyword | Reject generated PR text |
| S23 | Prior late carry-forward branch/PR exists without receipt | HOLD; no retry |
| S24 | Manual owner recovery merged after source cutoff | Manual-late only; incident stays OPEN |

Tests must prove forbidden side effects never occur. Do not run the real paid generator, mutate Production, or relax source rights during test setup.

## 7. Ranked next actions and decision gates

**G0 — next natural observation, read-only and approved:** On Nov 10, collect actual GitHub event runs; Vercel wake evidence if available through supported deployment observability; one-file PR lineage; exact protected merge; Production parity; early advisory and Health. Record first blocker in Issue #840. Do not manufacture a source run or reset the recovery budget.

**G1 — GitHub delivery escalation, read-only:** Ask GitHub Support why schedule events for daily-news.yml created 7h31m–8h10m late Nov 4–6 and absent Nov 9, while other scheduled workflows existed. Include workflow path, cron, actor from REST receipts, run IDs above and omitted run-date query results. GitHub documents possible delays/drops but no repository-specific root cause was established. Verify scheduler enabled/default-branch/actor status without changing settings or committing a schedule to resync it.

**G2 — independent source receipt design (NEW OWNER APPROVAL REQUIRED):** Evaluate an immutable, minimal Vercel Cron request delivery receipt with timestamp, request ID and authenticated execution context, plus exact GitHub backstop/source dispatch lineage and once-per-date budget. Keep the current \`schedule\` vs \`workflow_dispatch\` distinctions intact. Any new acceptance label or Health auto-closure logic would require a separate Draft code candidate, 24+ fail-closed negative tests, security/provenance review and explicit approval. Do not infer trust from User-Agent, an unscoped GitHub token, a caller-controlled source run ID, or a successful generator alone. Do not relax 08:30 ET.

**G3 — only if G2 remains impossible:** Preserve current fallback as separately classified service continuity; continue editor-reviewed late publication without qualifying it as native unattended. Consider provider-managed scheduling changes only after independent reliability measurements and cost/permissions review. GitHub's cron-minute offset alone is not proof of reliable delivery.

**G4 — incident lifecycle:** Allow closing Issue #840 only after the owner-approved definition of natural end-to-end acceptance is actually demonstrated. The existing Health workflow's auto-close owner variable is a separate control, not authority to bypass acceptance. E1, Score rights, Research, data migration, #950, G3 sandbox and all unrelated holds stay unchanged.

## 8. Support-case evidence template (no secrets)

Repository: \`usdimpact/usd-impact-site\` (default branch \`main\`). Workflows: \`daily-news.yml\` scheduled \`17 9 * * 1-5\`, \`daily-news-health.yml\` scheduled \`45 18 * * 1-5\`. Dates and immutable links: Nov 4 [generator run 41876443856](https://github.com/usdimpact/usd-impact-site/actions/runs/41876443856), Nov 5 [42074747229](https://github.com/usdimpact/usd-impact-site/actions/runs/42074747229), Nov 6 [42255797444](https://github.com/usdimpact/usd-impact-site/actions/runs/42255797444). On Nov 9, no matching native schedule run in the complete dated scheduled-run query, while other scheduled workflows ran. Health runs created around 23:32–23:56 UTC Nov 4–6. Request root-cause/queue visibility, workflow active status, actor eligibility and any provider-side scheduler registration or delay issue; **do not request disabling branch protections or creating duplicate scheduled runs**.

This document is review evidence only. Any subsequent implementation must be isolated under a new Draft branch and re-reviewed against live main before a protected release.
