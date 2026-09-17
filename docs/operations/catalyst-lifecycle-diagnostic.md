# Catalyst lifecycle diagnostic - isolated source candidate

## Status and scope

This is an isolated, network-free schema-v2 diagnostic. It is not connected to
Control Center or Watchdog. Source review and CI success do not authorize a merge
or activation. The September 16 FOMC outcome was separately released through #638;
the earlier manual recovery is superseded and must not be executed.

Repository scope:

- `scripts/catalyst-lifecycle-diagnostic.mjs`
- `scripts/test-catalyst-lifecycle-diagnostic.mjs`
- `docs/operations/catalyst-lifecycle-diagnostic.md`
- `apps/web/scripts/validate-publishing.mjs` (offline test hook only)

The normal `npm run validate:publishing` command runs the lifecycle tests in a
separate Node process using the same executable as the parent, no shell and a
30-second timeout. A missing test, nonzero exit, signal, spawn error or timeout
fails validation. The child process prevents its disabled-fetch test mock and
node:test state from leaking into the validator or other imported suites.
Existing publishing checks run unchanged before this appended test hook.

Keep this small change separate from the large, held #615 candidate. Both changes
touch the publishing validator, so a future integration must preserve both test
hooks and obtain fresh checks; neither branch is silently rebased or merged here.

## Why this candidate exists

The governing #558 review found that the latest successful Catalyst workflow and a
current Daily edition do not establish that a particular event's outcome was published.
The standalone diagnostic separates expected scheduled execution, reported execution
result, publication progress, explicit editorial disposition, and supplied-evidence gaps.

Original schema-v1 baseline: `usdimpact/usd-impact-site` main
`df175c72baa2c4b80eaec8bb372e92e43c18c76e`.
Schema-v2 refresh baseline: `9b143b7bd5619145403270fec036fbe201aa70d5`
(the separately released #638). #637 is refreshed by a history-preserving merge
into its draft branch; the released article and existing test hook are unchanged.
Preserved #615 head: `bc5c894ce540facc434660dd786dfdb907b9198d`.

Source review record:
https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5706543228

GitHub describes schedule-event context separately from workflow-dispatch inputs:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
Do not reconstruct the expected phase from a run's creation hour. A delayed run can
cross midnight. A manual recovery must not turn into evidence that its scheduled slot ran.

## API and trust boundary

`diagnoseCatalystLifecycle(snapshot)` accepts an already-decoded, plain normalized
record. The module imports nothing and performs no IO, dispatch, fetching, environment
reads, current-time acquisition, mutation of the input, publication, or incident closure.
It returns a deeply frozen report. The input clock is explicitly supplied for offline
classification, not promoted to a trusted release clock.

The validator checks exact object keys, primitive types, UTC timestamp round-trips,
valid dates, safe integer IDs, supported enums, run-attempt/source bindings, bounded
record counts, pagination completion, time-window coverage, observation freshness,
repository scope and canonical publication bindings. Unknown object fields fail closed.
It does not parse raw JSON or detect duplicate keys that a previous decoder discarded.
A future collector must check raw-response parsing separately.

**Every report is about supplied records, not independently authenticated evidence.**
The following fields always remain false, including for fully matching synthetic data:

- `observationAuthenticityVerified`
- `publicationVerified`
- `publicationAuthorized`
- `workflowDispatched`
- `incidentClosureAuthorized`
- `enforcementActive`

`diagnosticOnly` is always true. No report contains a release-approved flag or automatic
recovery instruction. A matching final state is named `LIVE_MATCH_REPORTED_NOT_VERIFIED`.

## Explicit input policy

The caller supplies the repository, separate generation and observation revisions,
workflow, branch, event identity/date, expected phase, full scheduled UTC instant
and evidence-age budget.
No deployment or event identity is inferred from a title, slug alone, a date alone, or a
green workflow conclusion.

`executionGraceMs` and `publicationDueAt` must be explicitly present. A null value
means `POLICY_UNSPECIFIED`; the module does not invent a production grace period or
publication deadline. Numeric values in the tests are synthetic policy inputs only.
The deployed workflow's 35-minute job timeout is not silently repurposed as an SLO.

An optional editorial hold has exact event/phase binding, a record reference and an
explicit expiry. It is reported separately and never erases a missing-run observation.
An expired hold is not extended. A hold and a reported live match are surfaced as a
conflict rather than silently reconciled.

## Schema v2: separate historical and current revision roles

The validator accepts only numeric `schemaVersion: 2`; every report, including an
invalid-input report, also identifies schema version 2. Version 1 is not silently
converted. Legacy `expected.sourceSha` and `observations.repositoryHeadSha` keys,
including mixtures of old and new keys, produce `INVALID_SNAPSHOT`.

Four explicit lowercase 40-character Git SHA fields are mandatory:

| Field | Meaning and comparison |
| --- | --- |
| `expected.generationSourceSha` | Historical source expected for the matched run; compared only with each matched run's `sourceSha`. |
| `expected.observationHeadSha` | Repository head frozen for the present observation, independently supplied by the future collector. |
| `observations.repositoryHeadStartSha` | Head reportedly read before collection; must equal the frozen observation head. |
| `observations.repositoryHeadEndSha` | Head reportedly read after collection; must equal the same frozen observation head. |

A syntactically valid start or end mismatch returns `SCOPE_DRIFT` with all stages
UNKNOWN. Two equal head reads are insufficient when both differ from the frozen
scope. Missing, malformed or accessor-based fields return `INVALID_SNAPSHOT`.
The module does not perform these reads or attest that they really occurred; a
future collector must bracket acquisition and independently bind this evidence.
Start/end equality alone cannot detect a change away and back between the reads.

A historical generation at A, editorial quality on B, merge/deployment at C and
current observation at C can coexist without false revision drift. A run whose
source differs from `generationSourceSha` still produces `RUN_SOURCE_DRIFT` on
the execution/scheduler axes; that does not erase separate supplied publication
evidence or turn it into verified evidence. Generation and observation SHAs may
also coincide. Do not repin the historical source to today's main to hide drift.

This change does not imply an ancestry relation between revisions. In particular,
the existing exact `deployment.gitSha === publication.mergeSha` restriction is
unchanged; a later deployment still requires separately designed ancestry and
content-continuity proof. Current-main, editorial-head, merge and serving-deployment
roles remain distinct. No release approval or publication gate is weakened.

`catalyst-projection-v1` remains the same provisional synthetic digest label; the
snapshot's v2 version does not implement or upgrade an article-content projection.
All non-authorizing safety fields remain false. The module still imports nothing,
acquires no clock, performs no IO and leaves its supplied input unchanged.

Design checkpoint:
https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5713855842

## Independent output axes

| Axis | Representative states |
| --- | --- |
| Evidence | SUPPLIED_RECORDS_ONLY, INVALID_SNAPSHOT, SCOPE_DRIFT, HOLD_PUBLICATION_CONFLICT |
| Scheduled slot | NOT_DUE, EXPECTED_RUN_NOT_OBSERVED, SCHEDULED_RUN_REPORTED, RUN_ASSOCIATION_UNKNOWN, EXECUTION_EVIDENCE_INCOMPLETE, DUPLICATE_SCHEDULED_RUNS |
| Execution | QUEUED_OR_WAITING, IN_PROGRESS, COMPLETED_WITHOUT_SUCCESS, SOURCE_HOLD_REPORTED, NO_CANDIDATE_REPORTED, GENERATION_REPORTED, SUCCESS_WITHOUT_PUBLICATION_EVIDENCE |
| Publication | PUBLICATION_EVIDENCE_INCOMPLETE, CANDIDATE_AWAITING_REVIEW, EXACT_HEAD_QUALITY_NOT_CONFIRMED, MERGED_DEPLOYMENT_EVIDENCE_MISSING, MERGED_AWAITING_MATCHING_PRODUCTION, DEPLOYED_LIVE_EVIDENCE_MISSING, LIVE_BINDING_MISMATCH, LIVE_MATCH_REPORTED_NOT_VERIFIED |

Matched run IDs, attempts and raw conclusions are preserved separately. Known unrelated
previews are ignored, while unassociated potentially relevant runs produce UNKNOWN.
Multiple candidates or competing matching executions are surfaced instead of choosing
an arbitrary first item. A successfully reported manual recovery can coexist with an
unobserved scheduled run.

## Future collector contract - not implemented

This candidate deliberately has no trusted observation loader. Before integration:

1. Obtain independently attributable, fresh, complete GitHub run pages and prove the
   expected slot and phase from event/step evidence. A `run:id:attempt:n` reference in
   a supplied snapshot is not itself proof. Preserve uncertain associations as unknown.
2. Bind a publication record to its actual reviewed content, PR head, exact-head quality,
   merge commit, canonical route, current Production deployment and anonymous page read.
3. Implement and review a shared canonical article projection before using the provisional
   `catalyst-projection-v1` digest label outside synthetic tests. A Markdown hash is not
   interchangeable with an HTML-body hash. No projection implementation is supplied here.
4. Review how later valid descendant deployments are proven. The first candidate accepts
   only an exact supplied merge/deployment SHA match; it does not implement ancestry proof.
5. Define evidence-age, job-grace, publication-deadline, hold and polling policies through
   normal governance. No currently deployed policy was changed or certified here.
6. Preserve the reviewed normal CI child-process hook in later changes. Do not let the
   test harness's network-disabled global leak into unrelated tests or operational code.

Do not bypass a missing collector, partial page, inaccessible provider response or missing
source by supplying a verification Boolean. All positive examples here are synthetic.

## Offline verification

The Node built-in test runner executes the complete new local module (not copied function
fragments). The test script disables fetching. No dependencies are installed.

```
node --check scripts/catalyst-lifecycle-diagnostic.mjs
node --test scripts/test-catalyst-lifecycle-diagnostic.mjs
```

Original schema-v1 baseline under Node v22.16.0: 109 tests passed, 0 failures.
The v2 suite preserves these scenarios using the explicit v2 field names, and adds
56 revision/schema regressions: 165 local tests passed, 0 failures or skips.
Original regression protections remain required: false publication authority, accepting
an earlier preview, ignoring run pagination, and a manual recovery erasing the schedule
gap. Mutation copies run in temporary directories; the original module is not modified.

Tests cover midnight rollover, exact grace/freshness boundaries, stale/partial/future
observations, malformed records, booleans represented as strings, repeated/unknown runs,
source HOLD and no-candidate decisions, wrong events/phases, quality on an old head,
Preview versus Production, mismatched URLs/digests/deployments, login-like pages,
editorial holds and the permanent non-authorization flags.

The static module scan is narrowly defined; it is not a whole-repository import scan,
full application build, Node 24 CI result, live-source test or Production acceptance test.

## Current operational boundary

The September 16 outcome was released through #638 on September 17: merge
`9b143b7bd5619145403270fec036fbe201aa70d5`, reviewed editorial head
`4d90c01808767fc8826a714519dd220e73836839`. Its scheduled generator used
`df175c72baa2c4b80eaec8bb372e92e43c18c76e`. These distinct source roles motivated
v2; the old manual recovery must not be run. See the release receipt:
https://github.com/usdimpact/usd-impact-site/pull/638#issuecomment-5712883521

#637 remains draft and unreleased. Its branch refresh is not a merge into main.
The historical Fed raw-capture task remains deferred and is not an owner action.
#631 and its read-only watch remain separate; this source change does not repair
cron authorization. No Production deployment, provider setup, credentials, firewall
change, email, automatic retry, methodology change, archived-article rewrite or
issue auto-close is included.

## CI and verification scope

The retained 108 behavior tests and publishing-validator hook assertion remain,
with 56 additional v2 cases. All data are synthetic normalized observations. Local
execution under Node 22 is not a full application build or proof of live-source
collection. Exact-head Node 24 CI, when run, supplies separate build evidence.
No workflow definition, dependency, package script, runtime collector, dispatch,
publication, provider configuration or application route is modified by this scope.

The module expects normalized plain records, not arbitrary executable JavaScript
objects or hostile raw JSON. It is not a security sandbox or independent evidence
authenticator. The integration boundary must validate raw response parsing and
normalization before using such records. Literal-source checks and synthetic tests
do not constitute proof against every possible indirect runtime invocation.
