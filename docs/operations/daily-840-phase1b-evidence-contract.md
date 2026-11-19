# USD Impact Daily #840 - Phase 1b-A evidence and policy contract

> **Documentation-only contract (1b-A).** It records owner policy and requirements for future, separately authorized validators. It is not an executable specification, a threshold approval, a release decision, or authorization to implement, merge, deploy, publish or close an incident. The reviewed byte digest of this file is recorded in its independent review receipt, not in the file.

**Document status:** proposed 1b-A documentation-only contract, 19 November 2026  
**Design verdict:** `POLICY_ARCHITECTURE_READY_FOR_OWNER_DECISION` (not implementation approval)  
**Phase 1a evidence verdict:** `PHASE1A_TECHNICAL_EVIDENCE_PASS_WITH_HOLDS` (630 synthetic cases; no live integration)  
**Canonical owner baseline:** [I-1 through I-14 policy](https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-7018893090), extending [D2-D4](https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-7017678377) and [A1-A4](https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-6930222568).

## 1. Authority, scope and unchanged gates

This contract describes proposed evidence sources, state semantics and negative tests for a future **read-only** Daily Phase 1b design. The current owner approval authorizes **policy and tracker documentation only**. It does not authorize repository edits, a Draft PR, Phase 1a merge, shadow workflow, new CI, live Health changes, Vercel credential, publisher activation, publication, or incident closure.

Baseline at the documentation review:

| Control | Preserved value |
|---|---|
| Protected `main` | `f10a6be3cbfe089a2f882d646972134cc74ee8fe` |
| Phase 1a PR #1279 | Open, Draft, unmerged; head `4563f022303ee65198698606845824e4a2dd4f9c`; original tree `f3fdcb58c6eb07d1087f97eefb49499bc7271007` |
| Daily source PR #1283 | Open, unmerged; November 19 source generation/PR CI do not prove publication |
| Daily incident #840 | Open, P1; a recovered edition never closes the native-scheduler incident |
| Calendar-security issue #1269 | Open, P1 NO-GO; periodic Watchdog checks are not a protected merge-time gate |
| Historic pinned PRs | #916, #939, #1010, #1203, #1206, #1211, #1225 unchanged |
| Auto-publication pause | Owner previously verified `DAILY_NEWS_AUTO_PUBLISH_DISABLED=true`; not independently reread during this design stage; never change it here |
| Other release restrictions | EAA/accessibility #1152, Three Dials #1280, editorial/source/IP, Weekly/EIA/Score, Research/Library buyer and customer rights, privacy/security/commerce and FULL FREE rollout HOLDs remain |

The owner tracker record on #1269 (`issuecomment-7017018667`, 19 November 2026) reports that the #1268 status-write repair was accepted after its first three natural Watchdog runs at `main@f10a6be3` succeeded with zero status writes, and that a later full Watchdog `audit` job reported RED on separate existing blockers. The cited run conclusions are public; the zero-write property is owner-reported. Neither condition removes a Daily or publication-security HOLD.

**Terminology:** `Owner-approved direction` means a policy planning decision, **not** authorization to implement or deploy. `Provisional` marks a value or interpretation that needs further evidence and an explicit owner decision. `Future validator requirement` is a required design/test property, **not** a statement that current JSON Schema or runtime code enforces it.

## 2. Owner-approved I-1 through I-14 planning baseline

| ID | Owner-approved planning direction | Unapproved implementation / open gate |
|---|---|---|
| I-1 | Keep PR #1279 Draft; propose separately reviewed, small engineering changes. | No creation, update, merge or production deployment. |
| I-2 | **S2 certification prohibited.** All recovery stays `RECOVERY_PROVISIONAL` or HOLD, never native. Future eligible proof: an authentic structured original job-**log** receipt, optionally paired with a digest-bound artifact; never an unreadable job-summary-only receipt. | Separate classifier review, real-evidence validation and explicit owner GO before any future state transition. |
| I-3 | Evaluate deadlines of 10 s per request, 15 s per ordinary reader, about 30 s for publication reader, 90 s total. | All numeric settings **PROVISIONAL**; none enabled. |
| I-4 | Evaluate a 10 s maximum clock skew with uncertainty bounds; a 60 s absolute ceiling is also a candidate. | Both numeric settings **PROVISIONAL**; no deployed clock approval. |
| I-5 | Prefer authenticated original source-snapshot timestamp; attempt-1 job completion can corroborate/bound but not replace unknown source freshness. | Timestamp-basis selection and handling **PROVISIONAL** pending independent evidence; the existing 43,200 s Health source-freshness policy remains. |
| I-6 | Late Health evaluation due to scheduler delay ⇒ `UNKNOWN`/HOLD (`HEALTH_EVALUATION_DELAYED`), not `UNHEALTHY` evidence against edition correctness (operationalized in §3.1 item 6). | No live Health changes. |
| I-7 | `editionIntegrity.HEALTHY` and `nativeHealthy` are different claims. | A recovered edition is never native healthy. |
| I-8 | `PENDING` only with one uniquely bound valid open edition PR and no contrary evidence; missing or contradictory bindings ⇒ `UNKNOWN`/HOLD. | A skipped publisher ⇒ `PUBLISHER_NOT_SUCCESS`/HOLD regardless of edition integrity. |
| I-9 | Token-free evidence reads first; absent authenticated current production-alias proof -> HOLD. | No Vercel token or secret; historical alias arrays are not current aliases. |
| I-10 | Minimize artifact fields; no raw provider responses or credentials; 14-day retention is the planning baseline. | No artifact upload or retention configuration change. |
| I-11 | Design a dedicated advisory Phase 1a 630+ case CI gate. | No workflow, rule or required-check change. |
| I-12 | `DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED` remains **not independently verified**; the owner inspects its value only, without editing. Propose separate future live-Health changes for original failure-path log evidence, an explicit #840 issue number, attempt/actor bindings and stopping issue-body overwrites. | Each live-Health change needs its own approval; no variable, issue-body or workflow change here. |
| I-13 | Five naturally observed weekdays **minimum** as a proposed shadow-validation protocol, plus offline replay of 17 November and coverage-based extension. Five failure-free days are not a reliability claim. | No shadow job, schedule or kill switch now; while the publication pause holds, these cannot establish native publishing success. |
| I-14 | Owner-token external wake and bare dispatches remain **PROVISIONAL**, with no upgrade to machine-certified origin. | A distinct GitHub App identity is only a future security proposal. |

No numbered row above is a GO for corresponding source code.

## 3. Three strictly separate decision dimensions

Future records may express:

1. **Edition integrity:** `WAITING`, `PENDING`, `HEALTHY`, `UNHEALTHY`, `UNKNOWN`. This describes observed, *served* edition state, not origin of the publishing action.
2. **Publication mechanism:** raw Phase 1a classifier claim (`NATIVE_AUTO_VERIFIED`, `UNATTENDED_RECOVERY_VERIFIED`, `RECOVERY_PROVISIONAL`, `HOLD` or classifier `UNKNOWN`) **and** a separately policy-capped class. In this stage S2 cannot be certified, so the cap must not allow `UNATTENDED_RECOVERY_VERIFIED`; any incomplete evidence yields HOLD.
3. **Incident authority:** `mayCloseIncident=false` and no issue mutation for all 1b-A/1b phases. A healthy recovered edition does not demonstrate reliable native GitHub scheduling.

`nativeHealthy` may be true only when `editionIntegrity=HEALTHY` **and** the policy-capped mechanism is `NATIVE_AUTO_VERIFIED` with every independent original-source and Health binding verified. These are necessary, not sufficient, conditions for *future* owner acceptance. No Phase 1b artifact may declare incident #840 closed.

### 3.1 Fail-closed state evaluation order (future semantics)

1. **Collection or trust failure:** any reader error/timeout, corrupted or dropped error envelope, untrusted/missing clock, overall deadline, incomplete pagination, ambiguous provenance, missing required exact-head identity -> `editionIntegrity=UNKNOWN`, mechanism `HOLD`.
2. **Before expected edition source slot:** `WAITING`; no automated success claim.
3. **One uniquely bound open/unmerged Daily edition PR, nothing contradictory:** `PENDING`, mechanism HOLD when publisher is skipped/not successful or protected merge is absent.
4. **Published surfaces bound but original Health not terminal:** `PENDING`, never native healthy.
5. **All edition-binding checks pass** (one merged edition PR in `main` lineage with the approved single-file change set, authenticated current production alias and deployment for that merge commit, all four public surfaces consistent, and a terminal, healthy original Health result bound to this edition): `editionIntegrity` may be `HEALTHY`. Edition integrity does not depend on whether the native publisher succeeded; the mechanism is determined separately, and recovery-day terminal Health remains `RECOVERY_TERMINAL_HEALTH_HOLD` until another owner decision.
6. **Health late because of scheduler delay (I-6), evaluated before item 7:** if the original Health evaluation started after its scheduled slot and its only failing check is source age (checks not executed because of an earlier exit count as not evaluated), and the 43,200 s bound would have held at the slot time but not at the actual evaluation start, record `editionIntegrity=UNKNOWN`, mechanism `HOLD`, reason `HEALTH_EVALUATION_DELAYED`. Never `UNHEALTHY` on timing alone. Any delay tolerance beyond this objective test is PROVISIONAL and needs an owner decision. Whether a passing but materially late Health evaluation may support `HEALTHY` is an open owner question (I-6); item 5 currently permits it under D2.4's evaluation-end rule.
7. **Authenticated edition defect:** `UNHEALTHY`/HOLD only for a contradiction that is itself authenticated and does not depend on Health timing (for example a verified public-surface or production-deployment mismatch), or for an explicitly unhealthy original Health result that item 6 does not explain.
8. **Missing, forged, stale, contradictory or mutable-only evidence:** `UNKNOWN`/HOLD.

A report that only proves source generation, a green CI suite, a PR head, or a skipped publisher is **not** `NATIVE_AUTO_VERIFIED` and does not close #840.

## 4. Evidence trust boundaries and collection plan (not implemented)

Every future reader must construct its own authentication/binding flags from authenticated provider responses, original-attempt run/job metadata and digest checks. It must not trust fixture/config fields such as `authenticated: true`, `immutable: true` or caller-provided timestamps. Use GET/read actions only, bound to a frozen edition date. Never follow redirects, except GitHub's documented job-log download redirect to an allow-listed storage host; never forward the `Authorization` header there, and record the host only. Any other redirect is a reader error. Never log any token or secret. Preserve the complete ordered errors array.

| Reader | Proposed original input and minimum independent bindings | Fail-closed signal |
|---|---|---|
| R1: source run | GitHub original `daily-news.yml` run, event, `run_attempt=1`, path/blob at the run SHA, run/job IDs, steps, creation/end UTC, original log SHA-256, edition/source digest | `SOURCE_ORIGINAL_ATTEMPT_UNVERIFIED` or `SOURCE_PROVENANCE_MISSING` |
| R2: backstop | Original `daily-news-schedule-backstop.yml` run `event=schedule`, `main`, attempt 1, job ID, original structured log receipt and raw log digest, exactly bound downstream dispatch run ID and edition | `BACKSTOP_RECEIPT_UNAVAILABLE` / `RECOVERY_PROVISIONAL`; no S2 certification |
| R3: publication | Publisher original attempt and conclusion, exact edition PR changed-file set, required checks on its exact head, reviewed bot merge and `main` lineage, original publisher-run identity binding | `PUBLISHER_NOT_SUCCESS` / `PR_PROTECTED_LINEAGE_NOT_VERIFIED` |
| R4: deployment | GitHub Production deployment and statuses, reviewed commit SHA, Vercel READY target and **current** alias lookup (not historical alias array) if authenticated access exists | `CANONICAL_PRODUCTION_ALIAS_NOT_VERIFIED` |
| R5: public surfaces | Exactly the canonical URLs pinned by a reviewed test: `https://www.usd-impact.com/news/<date>`, `/news`, `/news/latest.json`, `/news/feed.xml` (the site sets `trailingSlash: false` and `cleanUrls: true`, so a trailing-slash request redirects); status 200 with no redirect followed; expected date, title, slug and link, with all four surfaces agreeing with each other and with the merged file's frontmatter; response `Date`, `Age` and cache headers; raw-byte SHA-256 recorded as a receipt of that read only (byte equality across reads is not assumed) | `PUBLIC_SURFACES_MISSING_OR_MISMATCHED` |
| R6: Health | Original scheduled Health run and attempt, job ID, workflow blob, original Health success **or failure** evidence, selected source snapshot digest/time, original evaluation interval and Health conclusion | `HEALTH_SOURCE_UNBOUND`, `HEALTH_EVALUATION_DELAYED`, `HEALTH_ORIGINAL_ATTEMPT_MISSING` |
| R7: UTC clock | Server time from at least two distinct providers (GitHub API `Date`; Vercel edge `Date` on the custom domain), cross-checked with GitHub job timestamps and the runner clock; request start/end/latency; declared uncertainty bounds | `CLOCK_UNTRUSTED`, `CLOCK_SKEW_UNKNOWN` |

For R3, reject any extra or missing changed file relative to the approved single-edition content contract. Required exact files must be pinned by a future reviewed test, **not guessed from a live PR**. A current production alias that is not read through an authenticated provider lookup stays unverified. Vercel documents bearer-token authentication for `GET /v4/aliases/{idOrAlias}`, and this project's `*.vercel.app` deployment URLs are SSO-protected for all deployments except custom domains. Token-free mode therefore cannot produce current-alias proof, and under I-9 R4 always returns `CANONICAL_PRODUCTION_ALIAS_NOT_VERIFIED` (mechanism HOLD). Token-free mode is never a reason to weaken R4.

### 4.1 Current-source limitations (observed in the independent Phase 1b review)

- Sampled scheduled backstop and Health runs show the owner's User account as `actor` and `triggering_actor`, as do the sampled scheduled Watchdog runs, so the actor field cannot attest a machine actor. D3.1 lists a "machine actor" among S2 eligibility elements. Substituting GitHub-asserted `event=schedule`, `run_attempt=1`, the reviewed workflow path and blob at the run SHA, and the original job record is a **proposal requiring an owner decision**, not an approved change to D3.1. S2 remains prohibited either way.
- The existing backstop writes essential decision receipts to `$GITHUB_STEP_SUMMARY`, which is not independently obtainable through the proposed REST reader. The current Phase 1a receipt-kind validation expects a summary receipt; no genuine S2 promotion is possible as-is.
- The current Health workflow (blob `bf8cebba…`) declares workflow-level `issues: write`. Its failure exits do not print the report to the job log: the report reaches only the body of the exact-title open incident (#840, overwritten with `gh issue edit --body-file`) or a comment on #184 when #184 is open. Its success and pending paths print an unstructured Markdown report with no source-snapshot time, evaluation window or attempt binding. The Daily failure gate (`daily-news.yml` blob `c3694626…`) also overwrites the body of the first search-matched open incident without an exact-title check. The gated auto-close step requires `github.event_name == 'schedule'` (a re-run of a scheduled Health run is expected to keep that event), `DAILY_NEWS_INCIDENT_AUTOCLOSE_APPROVED == 'true'` (value not independently verified) and a successful `workflow_run` publisher run for the date, which cannot occur while the publisher is paused. Closure authority for #840 remains with the owner; no Phase 1b record grants it. This workflow must not be reused as a read-only shadow.
- A historical Vercel deployment's `alias` list is not proof of the alias serving the *current* production commit.

### 4.2 Proposed original receipts (schemas NOT implemented)

**Backstop**: propose exactly one machine-readable line, emitted by a designated final step, with marker `USDIMPACT_BACKSTOP_RECEIPT_V1`: version, repository, edition date, run ID, run attempt, job ID (from `job.check_run_id`), observed `github.event_name`, ref, workflow path and blob, decision, dispatched workflow and dispatched run ID, and emission UTC. A digest field, if present, covers a defined canonical serialization of the other fields; it detects corruption only and authenticates nothing. The collector accepts the marker only from that step's section of the authenticated original job log, rejects any second occurrence, truncation or replay, and requires every self-reported field to equal the provider's REST run and job records. A summary-only receipt is never sufficient.

**Health**: propose an original log line `USDIMPACT_HEALTH_EVIDENCE_V1` emitted on **all paths before any issue write**, with Health run/job/attempt/event, source run/attempt, selected source-snapshot time/basis/digest, evaluationStartUtc and evaluationEndUtc, report conclusion, edition date and raw evidence digest. Its fields must be cross-checked against the actual original provider records, not simply copied into a `verified` Boolean. A late run can be UNKNOWN/HOLD, and an original unhealthy edition should not be mislabeled as stale source solely because of scheduler delay.

**Receipt integrity note:** A SHA-256 digest attests observed bytes only; it does not by itself prove that the bytes came from a genuine scheduled run or are fresh. Provider identity, original attempt, unique association, ordering and server time must be independently bound. A digest of a mutable issue comment or the latest job summary is not acceptable original proof.

## 5. Source and Health freshness (existing 43,200 s bound unchanged; source basis and all new numeric thresholds PROVISIONAL)

**Current Health rule (observed at `main@f10a6be3…`, `daily-news-health.yml` blob `bf8cebba356a1219a482eae673110f82e80d4bd6`):** the inspection step selects the latest scheduled `daily-news.yml` run on `main` with `gh run list --event schedule --limit 1`, without requesting the attempt; takes that run's REST `updatedAt` (falling back to `createdAt`); and fails only when `now − updatedAt` is negative or exceeds 43,200 s, where `now` is the Health runner clock read once during the step. Exactly 43,200 s passes. The rule uses no source-snapshot timestamp, no evaluation window and no attempt binding, and `updatedAt` is a mutable run timestamp (a re-run of the scheduled Daily run is expected to change it). It is therefore not original freshness evidence under D2.4.

**Unchanged:** the 43,200 s bound value (I-5). **Proposed future basis (PROVISIONAL, I-5):** evaluate that bound against the authenticated original source-snapshot time and the original Health evaluation window defined below. The owner has not approved this basis, a different bound or any other numeric threshold.

- **Proposed S (PROVISIONAL, I-5):** the authenticated original source-snapshot time, with its basis recorded. If S is unknown, the attempt-1 source job `completed_at` (C) bounds S only from above (S ≤ C), so `U − C` is a lower bound on age: it can prove staleness but never freshness. That attempt-1 `completed_at` stays fixed after the attempt completes is expected but not documented by GitHub; treat it as a design assumption to verify.
- **Proposed [L, U]:** the original Health evaluation start and end, each with declared clock uncertainty `uL` and `uU` (and `uS` for S), cross-checked against the provider's job-step timestamps. Later mutable `updated_at` values and shadow collection time cannot refresh historical evidence.
- **Proposed conservative age interval (integer seconds):** `minimumAge = floor((L − uL) − (S + uS))`, `maximumAge = ceil((U + uU) − (S − uS))`. Pass only when `minimumAge ≥ 0` and `maximumAge ≤ 43,200`; exactly 43,200 passes, as in the current Health rule and the V5 rule of the unmerged Phase 1a classifier (Draft PR #1279). If `minimumAge > 43,200`, apply §3.1 item 6 first; the source is stale only if item 6 does not apply. If `minimumAge ≤ 43,200 < maximumAge`, record boundary uncertainty and HOLD. A missing or future-dated S, or `U < L`, is HOLD.
- **Delay attribution:** distinguish `HEALTH_EVALUATION_DELAYED` (`UNKNOWN`/HOLD) from authenticated evidence of an actually unhealthy published edition, as §3.1 items 6 and 7 specify.
- Proposed implementation-time clock limits: 10 s skew candidate, 60 s ceiling candidate and explicit uncertainty guard bands. **Neither is operationally approved**.
- Proposed implementation-time readers: 10 s per request, 15 s ordinary reader, 30 s publication reader, 90 s total. **None is an approved or deployed timeout**. A hung clock or reader must ultimately produce a terminal structured HOLD, not an indefinitely pending promise.

## 6. Privacy, least privilege and deployment boundaries

- Prefer token-free public reads and a future GitHub Actions read-scoped token only within an explicitly reviewed dedicated shadow design. No new token, GitHub App, Vercel secret or repository permission grant is part of 1b-A.
- A future shadow workflow must declare `permissions: {}` at workflow level and only `contents: read` and `actions: read` at job level. It must have no issue, pull-request, contents, actions, checks, statuses, deployments, `id-token`, packages, pages, security-events or attestations write; no workflow dispatch; no `pull_request_target` or secret-bearing `workflow_run` trigger; checkout with `persist-credentials: false`; and no call to the existing Health workflow. It may emit an allow-listed evidence artifact only after a future D5 GO.
- Allow-list artifact fields: schema version, date, commit/workflow IDs, event/attempt, normalized status and reason codes, timestamps/uncertainty, Git blob IDs and SHA-256s, read URL path templates (no query tokens), redacted request provenance, and explicit completeness flags.
- Never include raw GitHub/Vercel response bodies, Vercel alias `email`, bypass secret, token, Authorization header, cookie, signed URL or private customer/provider data. Redaction must happen before serialization and before errors are recorded.
- 14-day artifact retention is approved as a **planning baseline only**; no retention settings are being changed in this stage. Public artifact availability and fork/PR access must be reviewed before any upload.
- Full-free content, historic buyer access and all original source/IP, accessibility and Score rights remain governed by their separate HOLDs. Nothing here changes pricing or entitlements.

## 7. Required future semantic validator rules (NOT IMPLEMENTED)

### SC-01: collector error-list/count integrity

- `collector.errors` (an ordered array of error codes) is authoritative; `collector.errorsCount` is a redundant consistency field.
- A record with `errorsCount ≠ errors.length` is invalid. It is rejected and never repaired or reinterpreted. Consumers treat the edition as `UNKNOWN` and the mechanism as `HOLD`, and retain the rejected record's digest and its full redacted error array for diagnosis.
- Any non-empty `errors` forces `editionIntegrity=UNKNOWN` and `policyCappedClass=HOLD`. Every reader with status `ERROR`, `TIMEOUT` or `INVALID` must appear in `errors`, and an error naming a reader is inconsistent with that reader's status `OK`.
- The future caller must pass the complete envelope through unchanged; never destructure away `errors` and present a successful read count in isolation.
- Synthetic reject cases: (a) `errors=["READER_TIMEOUT"]`, `errorsCount=0`; (b) `errors=[]`, `errorsCount=1`, rejected even though the outcome would already be HOLD.

### SC-02: publisher conclusion versus native certification

- Fields in the proposal shape: `evidence.publication.publisherRun.{status, conclusion, runAttempt, originalJob}`; raw class `classification.publicationMechanism.classifierClass`; policy cap `classification.publicationMechanism.policyCappedClass`.
- **Allow-list rule.** The effective or policy-capped class may be `NATIVE_AUTO_VERIFIED` only if the publisher run is present, `status=completed`, `conclusion=success`, `runAttempt=1`, carries an authenticated original job/log binding, and is bound to the same original scheduled source run and edition. Every other state rejects a native classification, including `skipped`, `failure`, `cancelled`, `timed_out`, `neutral`, `action_required`, `stale`, `startup_failure`, an in-progress or null conclusion, an absent run, a re-run, or unresolved provenance. A raw `classifierClass=NATIVE_AUTO_VERIFIED` in any of these states is itself a contradiction and is rejected.
- A `skipped` publisher yields `PUBLISHER_NOT_SUCCESS` and policy-capped `HOLD` regardless of source generation, PR CI or edition integrity (I-8).
- Synthetic reject cases (each must fail validation): (a) `publisherRun.conclusion="skipped"` with `policyCappedClass="NATIVE_AUTO_VERIFIED"`; (b) `publisherRun.conclusion="timed_out"` with `policyCappedClass="NATIVE_AUTO_VERIFIED"`.

### Additional future semantic rejects

| ID | Contradiction to reject (synthetic test only) | Safe outcome |
|---|---|---|
| SC-03 | Source or Health `run_attempt > 1` represented as genuine native attempt-1 evidence | HOLD; reject native classification |
| SC-04 | Backstop receipt exists only in an unreadable job summary, is duplicated or is bound to wrong downstream run | HOLD / recovery provisional; never S2 |
| SC-05 | `NATIVE_AUTO_VERIFIED` inferred from any `workflow_dispatch` source run (manual, external wake or backstop-dispatched), from a source run that is not completed/success, or from a missing source origin | HOLD or recovery provisional only |
| SC-06 | Original Health timestamp/evaluation window missing, future-dated, contradictory or sourced only from later API `updated_at` | `UNKNOWN` / HOLD |
| SC-07 | Reader pagination incomplete, source PR ambiguous, publisher original attempt missing, or historical status reused | `UNKNOWN` / HOLD |
| SC-08 | Vercel historical alias list presented as *current* alias, or alias points to another SHA, or the production deployment is not `READY` with target production | HOLD |
| SC-09 | Any of four public surfaces missing or bound to different edition/date/title/slug | `UNHEALTHY`/HOLD only if verified discrepancy, otherwise `UNKNOWN`/HOLD |
| SC-10 | Clock unsupported, diverged beyond independently approved limit or reader deadline exceeded | `UNKNOWN` / HOLD |
| SC-11 | `mayCloseIncident=true` or issue mutation in any Phase 1b record | Reject; no incident action |
| SC-12 | A syntactically valid JSON Schema artifact used to claim live GitHub, Vercel or Health provenance without authenticated reads | Reject certification |
| SC-13 | `policyCappedClass` more certifying than `classifierClass` (a cap may equal or lower the raw class and may always be `HOLD`; it may never raise it), or raw `NATIVE_AUTO_VERIFIED` while any SC-02, SC-03 or SC-05 condition holds. Order, most to least certifying: `NATIVE_AUTO_VERIFIED` > `UNATTENDED_RECOVERY_VERIFIED` > `RECOVERY_PROVISIONAL` > `UNKNOWN` = `HOLD`. | Reject |
| SC-14 | Native publication binding incomplete: edition PR not merged into `main` lineage; merge not bound to the specific allow-listed publisher run (`github-actions[bot]` alone is a shared identity); extra or missing changed file; required checks incomplete or not on the exact head SHA; or the source run has any attempt greater than 1 (branch names and run-names carry the run ID, not the attempt) | HOLD; reject native |
| SC-15 | Health binding incomplete for `HEALTHY` or native: report absent, non-terminal, from a manually dispatched or re-run Health, selected source not equal to the bound source run, or evaluation window not bound to provider job-step timestamps | `UNKNOWN`/HOLD |
| SC-16 | Edition date differs across the record date, source-run date, PR title/branch, merged file path, frontmatter, the four public surfaces or the Health report | Reject / HOLD |
| SC-17 | Any approval or threshold taken from the record (`s2CertificationApproved=true`, `thresholdsApproved=true`, record-supplied skew or deadline values), or any threshold-dependent `TRUSTED` or deadline result used for certification while I-3 and I-4 remain provisional | Reject certification; approvals and thresholds come only from reviewed code and owner decisions |
| SC-18 | Recovery-sourced record with a terminal Health result that does not carry `RECOVERY_TERMINAL_HEALTH_HOLD` (D2.3) | Reject; HOLD |
| SC-19 | Payload or evidence digest not reproducible from the record; request path containing a credential, a signature or any query parameter outside a reviewed allow-list of non-secret parameters (for example `ref`, `per_page`, `page`, `event`, `created`, `state`); raw provider body, e-mail address or bypass secret present | Reject artifact |

The provided `daily840-phase1b-evidence-schema-v1.json` was a **synthetic design artifact**, not a committed or fully semantically validated runtime schema. No machine-readable schema or validator will be committed under 1b-A. SC-01/SC-02 document requirements for future schema changes and separate code review only.

An independent offline probe found that this synthetic schema (SHA-256 `12afcc19…`) accepts both the SC-01 and SC-02 contradictory records, and 62 of 68 synthetic contradictory records overall. Schema validity is therefore not evidence of semantic correctness or provenance.

## 8. Negative-test acceptance matrix for future separately approved code

| Class | Minimum synthetic checks | Mandatory result |
|---|---|---|
| Collection | Error array/count mismatch, dropped errors, timed-out reader, hung clock and expired overall deadline | HOLD; no silent downgrade |
| Source | Missing attempt, rerun, wrong workflow SHA, date mismatch, source log truncation or unknown snapshot time | HOLD |
| Recovery | No structured original job log, wrong backstop event, attempt 2, duplicate wake, manual dispatch, spoofed actor, ambiguous receipt | S2 prohibited; never native |
| Publication | Skipped publisher, failed/cancelled original publisher, wrong edition PR, green check on wrong SHA, unmerged PR | HOLD |
| Health | Failure path without original log, delayed scheduler, false source age, future timestamp, mutable `updated_at`, Health re-run reported native | `UNKNOWN`/HOLD or verified `UNHEALTHY`/HOLD |
| Vercel | Historical aliases without current proof, incorrect production SHA, alias moved between two reads, redirect, missing token-free proof | HOLD |
| Surfaces | Wrong dated article, missing index link, latest JSON/RSS disagreement, unexpected redirect or content fingerprint mismatch | HOLD |
| Privacy | Provider response with email/bypass secret, token-bearing URL, raw logs, retention over plan without review | Reject artifact |
| Status | Syntactically passing but contradictory mechanism, `nativeHealthy` inferred from recovery, `mayCloseIncident=true` | Reject artifact / HOLD |

These are **requirements to be implemented and independently exercised later**. No tests are added to the repository by this Markdown document.

## 9. Reserved implementation stages and authorization boundaries

A future independent architecture/engineering change can be considered only in separately authorized, exact-head scoped stages:

- **1b-A (this document):** exactly one added Markdown file at the intended path; no schema JSON, no runtime or workflow. The proposed Draft PR needs separate owner authorization. This document is not that PR.
- **1b-B (D6):** dedicated advisory Phase 1a CI, skipped-publisher regression and explicit counts; separate authorization. Do not make it a required ruleset check without another decision.
- **1b-C/D:** collector error-preserving timeout envelope and independent trusted clock; offline tests, independently reviewed numbers.
- **1b-E:** Phase 1a receipt-kind/classifier amendments to original log evidence and explicit policy cap; full independent re-review.
- **1b-F/G:** authenticated GitHub readers, then token-free-first deployment/public readers, with actual provider provenance checks.
- **1b-H:** separate Health and backstop **live** workflow changes, each on its own security approval. Existing `issues: write` Health is not an acceptable shadow.
- **1b-I (D5):** separate read-only shadow workflow with versioned allow-listed artifact, kill switch and natural weekday side-by-side comparisons. No live deployment or publication authorization implied.

Never use a successful static suite, a previously recovered edition, or a green periodic Watchdog freshness check as a substitute for a fully verified natural end-to-end publisher/Health cycle.

## 10. Future 1b-A Draft PR acceptance checklist (not yet authorized)

**Exact scope:** one commit that adds exactly one file, `docs/operations/daily-840-phase1b-evidence-contract.md` (mode `100644`), on top of an owner-authorized base. Nothing else changes: no README, package, lockfile, workflow, script, deployment file, schema, test, issue metadata, labels or settings. The PR stays Draft and unmerged.

Every item is a fail-closed gate. If any check fails, stop, report the evidence and do not repair.

**Before creation**
1. **Owner authorization.** A new, explicit owner message names the file path, the final document SHA-256, the base SHA, the branch name and Draft-only status. It also states whether the PR description may reference issues, and that no deployment of any kind is authorized.
2. **Final bytes re-reviewed.** The revised document carries the corrections for every blocking finding of the independent reviews. Its SHA-256 differs from `49553a3b…` and is recorded. An independent delta review of exactly those bytes returns `1B_A_DOCS_CONTRACT_READY_FOR_SEPARATE_OWNER_AUTHORIZATION`. The SHA-256 and git blob ID of the file to be committed are computed offline and equal the re-reviewed values.
3. **Fresh baseline (GET only, immediately before creation):**
   - `main` equals the authorized base SHA.
   - #1279 is open, Draft and unmerged at `4563f022…`, with its four blobs unchanged.
   - #1283 is open and unmerged; #840 is open; #1269 is open and contains NO-GO; all seven pinned heads are unchanged.
   - The target path returns 404 at the base.
   - No branch or PR for this document exists.
   - Any drift means stop.
4. **No-deployment branch.** The branch name begins with `agent/`. `apps/web/vercel.json` at the base still contains `"agent/*": false` under `git.deploymentEnabled` (blob `ffe227d6…` or a re-reviewed successor). Otherwise stop: Vercel deploys any branch it does not exclude, and a docs-only commit on a `docs/…` branch created a Preview deployment (PR #869, commit `05a59e45…`).

**Creation**
5. **One commit, one added file.** `git diff --name-status <base>..<head>` prints exactly `A<TAB>docs/operations/daily-840-phase1b-evidence-contract.md` (status `A`, one path). There are no other paths, modes, renames or deletions.
6. **No closing keywords and no unintended issue links.**
   - The commit message, PR title and PR body contain none of `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves` or `resolved` (any case, with or without a colon) next to an issue reference. Note that the document itself contains "does not close #840"; do not paste it.
   - Issue references (`#N` or issue URLs) appear only if the owner accepts the resulting cross-reference events.
   - No labels, assignees, reviewers, milestone, project or Development-sidebar links.
7. **Guarded push and Draft only.** Create the new branch at the authorized base with an expected-head guard, without force. Open the PR as **Draft** against `main`. Do not mark it Ready, enable auto-merge, dispatch or re-run workflows manually, or approve pending runs.

**After creation (GET only)**
8. **PR identity.** The PR is open with `draft=true`, base `main` at the authorized SHA and head equal to the pushed SHA. It has `changed_files=1`, `deletions=0`, and `additions` equal to the file's line count. The file blob equals the expected blob.
9. **No deployment.** `GET /repos/usdimpact/usd-impact-site/deployments?sha=<head>` returns no records. If any appear, stop and report; do not delete or alter them.
10. **Natural CI only.** Record the conclusions of naturally triggered checks on the exact head. At `main@f10a6be3` these are expected to be Web Quality (`quality.yml`), Dependency Review, Supabase Production migration intake guard and CodeQL; confirm the list at the time. Report failures; do not fix them in this stage.
11. **Baseline unchanged after creation.** `main`, #1279, #1283, #1269 and the pins are as in item 3. #840 is open with no new closing link. The publication pause is untouched.
12. **Separate decisions remain.** Any Ready transition, merge, publication or runtime activation needs a further explicit owner GO. A merge would also deploy to Vercel Production: docs-only commit `c8923daa…` (PR #1012) has a Production deployment record.

## 11. Primary references and interpretation boundaries

- [Owner I-1 through I-14 policy](https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-7018893090); [Owner D2-D4](https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-7017678377); [Owner A1-A4](https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-6930222568).
- [Phase 1a Draft PR #1279](https://github.com/usdimpact/usd-impact-site/pull/1279), exact head at this review `4563f022303ee65198698606845824e4a2dd4f9c`.
- [Daily Health workflow](https://github.com/usdimpact/usd-impact-site/blob/f10a6be3cbfe089a2f882d646972134cc74ee8fe/.github/workflows/daily-news-health.yml) (blob `bf8cebba356a1219a482eae673110f82e80d4bd6`).
- [Backstop workflow](https://github.com/usdimpact/usd-impact-site/blob/f10a6be3cbfe089a2f882d646972134cc74ee8fe/.github/workflows/daily-news-schedule-backstop.yml) (blob `721dfabde3ce25a79448ed315aa443bb29439d2f`).
- [Native Daily workflow](https://github.com/usdimpact/usd-impact-site/blob/f10a6be3cbfe089a2f882d646972134cc74ee8fe/.github/workflows/daily-news.yml) (blob `c369462629c2b82c7e34f021bc4f874b82138be9`).
- [Publisher workflow](https://github.com/usdimpact/usd-impact-site/blob/f10a6be3cbfe089a2f882d646972134cc74ee8fe/.github/workflows/daily-news-auto-publish.yml) (blob `6f9234b4cd19c295ced31eb86c2dddf6cce4481d`).
- Independent Claude design report `PHASE1B-ARCH-REVIEW-claude-D2-D4-20261119.md` (SHA-256 `438d0b08a40e1d0fb4d0124964af315d1b50db83530a48d46dc3604235043649`), its receipt (`d65bd2d5ff0a5e23d4c12d04984f6dba966dd828869a3fd1b2f7b2b52c140b7d`) and the SYNTHETIC proposal schema `daily840-phase1b-evidence-schema-v1.json` (`12afcc192753eb6f6dd69a45e7591f2348e81d62a44cab1f92eee22111c253b5`), as recorded in the owner comment; and the independent 1b-A contract review (report SHA-256 `502cf0d209c5944897f4592455e980806bf4a729b09e0092e289e2c690a631ad`, receipt SHA-256 `bef29d8257eac3fe68c0c4af3d75fe59c0e1af16ffc1916249beabbd0ed70b11`). These files are not in the repository. They support design decisions, not live execution or publication claims.

**Final boundary:** This document is a documentation-only proposal. Its review or addition to the repository does not change any release HOLD, production variable, workflow, PR, issue, customer entitlement or publication result.
