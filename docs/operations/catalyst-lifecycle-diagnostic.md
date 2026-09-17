# Catalyst lifecycle diagnostic - isolated source candidate

## Status and scope

This is an isolated, network-free diagnostic. It is not connected to Control Center
or Watchdog and does not implement the approved but unexecuted outcome-recovery
workflow. Source review and CI success do not authorize a merge or activation.

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

Reviewed baseline: `usdimpact/usd-impact-site` main
`df175c72baa2c4b80eaec8bb372e92e43c18c76e`.
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

The caller supplies the repository, exact source revision, workflow, branch, event
identity/date, expected phase, full scheduled UTC instant and evidence-age budget.
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

Observed local runtime: Node v22.16.0. Final suite: 109 tests passed, 0 failures.
Four deliberate broken variants must be detected: false publication authority, accepting
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

The single September 17 outcome dispatch remains approved but not executed through the
exposed tools. This monitor does not generate the missing September 16 article. The
historical Fed raw-capture task remains deferred and is not an owner action. No merge,
Production deployment, provider setup, credentials, firewall change, email, automatic
retry, methodology change, archived-article rewrite or issue auto-close is included.

## CI and verification scope

The retained 108 behavior tests are supplemented by one test of the normal
publishing-validator hook. All data are synthetic normalized observations. Local
execution under Node 22 is not a full application build or proof of live-source
collection. Exact-head Node 24 CI, when run, supplies separate build evidence.
No workflow definition, dependency, package script, runtime collector, dispatch,
publication, provider configuration or application route is modified by this scope.

The module expects normalized plain records, not arbitrary executable JavaScript
objects or hostile raw JSON. It is not a security sandbox or independent evidence
authenticator. The integration boundary must validate raw response parsing and
normalization before using such records. Literal-source checks and synthetic tests
do not constitute proof against every possible indirect runtime invocation.
