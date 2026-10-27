# Daily deadline evidence collector - review candidate

## 2026-10-28 current-main refresh

This review candidate has been reconstructed directly on current protected `main`
`431c1efc61023590eb11564145efd981f49543c8` without changing its seven-file scope.

Read-only current-state evidence:

- the October 27 Daily source file exists on current main;
- current Production deployment is `dpl_7yaPHoP4BH45wPG3m1vmkSncBVke`;
- that deployment is READY / target `production` / ref `main` / SHA
  `431c1efc61023590eb11564145efd981f49543c8`;
- the current connected Vercel integration can read exact-main deployment identity without
  decrypting environment values;
- the current GitHub integration can read commit-scoped workflow/check metadata and individual
  workflow-run/job evidence used elsewhere in the Daily acceptance work.

The connector still does not expose the collector's exact generic paginated workflow-list request
as a drop-in executable environment for this Node CLI. Therefore this refresh does **not** claim
that `publishing-deadline-read.mjs --collect` has been executed end-to-end with live GitHub +
Vercel bearer credentials.

That remains a separate integration proof before any scheduler/Control Center attachment. The
review candidate remains explicitly one-shot, read-only, unscheduled and non-authoritative.

Status: DRAFT INTEGRATION CANDIDATE. NOT MERGED, SCHEDULED OR ACTIVATED.

This continues the delivery-policy work adopted in PR #854. Baseline inspected through
connected GitHub on 2026-10-26: `75d06c57889b91c397925edd1c5da97b901537f4`. Existing snapshot PR #837,
Daily/Weekly acceptance watches, generator, source validators, private runtime and Score
workstream are outside this change.

## Files and normal test integration

New files:
- `scripts/publishing-deadline-status.mjs`: the prior pure classifier, with its 117 tests.
- `scripts/test-publishing-deadline-status.mjs`.
- `scripts/publishing-deadline-collector.mjs`: bounded, fixed-destination GET acquisition.
- `scripts/test-publishing-deadline-collector.mjs`: 46 offline collector/CLI tests.
- `scripts/publishing-deadline-read.mjs`: explicit one-shot JSON command, no work on import.
- This document.

Add these two imports after the existing first import in
`scripts/test-control-center-policy.mjs`, retaining every original test:

```js
import './test-publishing-deadline-status.mjs';
import './test-publishing-deadline-collector.mjs';
```

The existing Web quality job already runs that test entrypoint under Node24. No workflow,
package, dependency, lockfile, function, cron or generation command needs to change.

## Implemented boundaries

Requests are GET only, on fixed GitHub repository, Vercel canonical-deployment and four
public news destinations. No URLs from PR bodies, comments or response links are followed.
No redirect or automatic retry is permitted. Authentication is attached only to its own
API origin, never to public pages. Error response bodies and arbitrary exception messages
are not emitted. No credentials are acquired, read from provider settings or stored.
Existing credentials may only be supplied by a separately authorized execution environment.

Bounded limits are 120 requests, 10 pages per collection, 2 MB per response, 10 seconds per
request and 120 seconds per collection. Tests can reduce, not increase, those limits.
No sleep/retry loop, persistent process, timer-based schedule, GitHub write, endpoint
invocation, provider/model request, approval, merge or notification is implemented.

A present article's Git blob checksum is verified. Only the current simple frontmatter
forms are recognized; alternate/ambiguous syntax becomes UNKNOWN. This is not a general
YAML validator. Source/claim validity still belongs to the existing editorial validators.
SHA-1 is used solely to compare Git object identity, not as a credential or signature.

Candidate discovery is deliberately bounded without treating missing reads as absence.
Every open PR targeting `main` is inspected regardless of age. Closed/merged PRs are
inspected when their `updated_at` falls within the 14 days preceding the edition. Changed
files are read for those PRs, so a recent or still-open candidate cannot hide the exact
dated Daily path behind a misleading title or branch name. The closed-window listing must
cross the lower time boundary within the configured pagination cap; otherwise coverage
remains incomplete and classification is UNKNOWN.

This matches the Daily publication contract: publication PRs are same-day artifacts, while
an old closed off-contract branch is not active editorial state for a later edition. The
collector reports `open-all-closed-14d-complete` only after all open PRs and the full
closed-window boundary have been observed. It still reserves request budget for candidate
checks, canonical deployment observations, public pages and the final main-stability read.
Do not enlarge the request ceiling or weaken the coverage gate to manufacture a result.

Daily/backstop run metadata includes all five active statuses across dates as well as the
edition-date receipts. Created-at dates are observation labels, not authenticated dispatch
input lineage. A workflow-dispatch backstop remains an unresolved external-wake receipt;
a successful acknowledgement is not silently promoted to recovery.

The collector reads the canonical apex/www deployments independently when authorized
read access is supplied, checks project identity, and compares their IDs/SHAs with main.
It records public-page availability and digests, not verified article claim fidelity or
proof that a response came from a specific deployment. Final main readback invalidates a
snapshot that changed or became inaccessible. This is still a snapshot, not an atomic lease.

## Deliberately not attested

The collector does not manufacture source review, human editorial approval, status-only
unchanged-copy attestations, exact-head audit-step/Preview release proof, protected merge
or live-content-to-deployment binding. It does not parse a PR description saying approved
into a human signoff. These omissions are explicit gaps, not successful gates.

Consequently this initial acquisition adapter does not produce a fully attested DELIVERED
or native-recovery result. Existing published files are observations; release acceptance
still needs independent evidence. The pure classifier's DELIVERED tests use synthetic
bound receipts and do not imply that the collector has independently proved them.

Every report retains `executionAllowed:false`, `scheduledActivation:false`, and native /
external-wake acceptance NOT_EVALUATED. Even FALLBACK_ASSESSMENT is advice to the existing
editorial process, not permission to write. An incomplete history, unknown access or active
operation must never trigger competing generation.

## Execution and tests

Offline, no credentials or network required:

```sh
node scripts/test-publishing-deadline-status.mjs
node scripts/test-publishing-deadline-collector.mjs
```

Explicit one-shot command, only after separately reviewing live-read scope:

```sh
node scripts/publishing-deadline-read.mjs --collect YYYY-MM-DD
```

The command requires that exact flag/date and writes JSON to stdout only. Exit 0 means JSON
was produced with no collection gaps, NOT approval to publish. Exit 3 means JSON with gaps;
exit 2 means input/collection failure. No invocation has been attached to Control Center,
GitHub Actions, a ChatGPT task or any provider schedule.

## Validation receipt and current blocker

Local Node v22.16.0: 117 classifier groups + 46 collector/CLI groups expected; no real HTTP
request occurred in these suites. They cover all-state/closed/off-contract candidates,
active older runs, misleading green runs, unknown backstop lineage, HTTP/auth/rate-limit
failures, redirects, byte caps, pagination/read budget, main/PR drift, blob mismatch,
frontmatter ambiguity, credential origin isolation and no top-level command execution.

After the 2026-10-26 current-main refresh and bounded-discovery change, hosted Node24/full
repository Web quality, Dependency Review, CodeQL and exact-head Preview must be re-verified
on the new exact head; earlier green checks do not establish the refreshed head. A prior
GitHub blob submission was blocked before any branch, commit or PR existed. A subsequent
normal direct-connector attempt succeeded after package review and test verification. No
alternate transport, credential extraction or protection change was used. Keep this candidate
in draft pending actual hosted acceptance; submission is not deployed implementation.

Before scheduled integration, verify the refreshed bounded-discovery implementation,
independently trustworthy approval/source/merge/live attestation, live-read testing, human
reviewer coverage and existing-system scheduling authority. Preserve all protections and avoid duplicate tasks.
