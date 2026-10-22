# Daily deadline evidence collector - review candidate

Status: DRAFT INTEGRATION CANDIDATE. NOT MERGED, SCHEDULED OR ACTIVATED.

This continues the delivery-policy work adopted in PR #854. Baseline inspected through
connected GitHub: `3c57f9737564ffec8deb057be1d0e23e1ce27725`. Existing snapshot PR #837,
Daily/Weekly acceptance watches, generator, source validators, private runtime and Score
workstream are outside this change.

## Files and normal test integration

New files:
- `scripts/publishing-deadline-status.mjs`: the prior pure classifier, with its 117 tests.
- `scripts/test-publishing-deadline-status.mjs`.
- `scripts/publishing-deadline-collector.mjs`: bounded, fixed-destination GET acquisition.
- `scripts/test-publishing-deadline-collector.mjs`: 43 offline collector/CLI tests.
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

All-state PR metadata is paginated. Date-bearing titles/branches are prioritized; changed
files are also inspected to catch off-contract date candidates. If historical file coverage
cannot be completed within the read budget, `prs.coverage` stays incomplete. Remaining
budget is reserved for current-candidate and deployment observations. Large repositories
may therefore legitimately return UNKNOWN; do not remove this hold or silently narrow
coverage to manufacture an empty candidate result. A reviewed incremental index or other
complete bounded coverage strategy is a remaining performance/integration decision.

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

Local Node v22.16.0: 117 classifier groups + 43 collector/CLI groups PASS; no real HTTP
request occurred in these suites. They cover all-state/closed/off-contract candidates,
active older runs, misleading green runs, unknown backstop lineage, HTTP/auth/rate-limit
failures, redirects, byte caps, pagination/read budget, main/PR drift, blob mismatch,
frontmatter ambiguity, credential origin isolation and no top-level command execution.

Hosted Node24/full repository Web quality, Dependency Review, CodeQL and exact-head Preview
must be verified on this draft's exact head; local tests do not establish those gates. A prior
GitHub blob submission was blocked before any branch, commit or PR existed. A subsequent
normal direct-connector attempt succeeded after package review and test verification. No
alternate transport, credential extraction or protection change was used. Keep this candidate
in draft pending actual hosted acceptance; submission is not deployed implementation.

Before scheduled integration, resolve bounded completeness, independently trustworthy
approval/source/merge/live attestation, live-read testing, human reviewer coverage and
existing-system scheduling authority. Preserve all protections and avoid duplicate tasks.
