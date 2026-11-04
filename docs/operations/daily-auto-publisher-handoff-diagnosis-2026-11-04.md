# Daily #840 — November 4 unattended publication handoff / release gate design

**Created:** 2026-11-04. **Scope:** documentation-only, standalone Draft from protected main
`bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`.

**NO release/activation:** This file changes no workflow, controller, rights gate, token, GitHub App,
configuration, Production page, SQL, news article, checkout or paid generator. It is a review artifact,
not a fix. Do not merge or deploy on the strength of these observations.

## 1. Verified source and downstream sequence

- Independent [schedule backstop #41808313000](https://github.com/usdimpact/usd-impact-site/actions/runs/41808313000)
  began 09:32:11 UTC and finished SUCCESS. The trusted backstop workflow uses the repository's
  `GITHUB_TOKEN` to dispatch `daily-news.yml` as a `workflow_dispatch`.
- [Daily generator #41808333994](https://github.com/usdimpact/usd-impact-site/actions/runs/41808333994)
  began 09:32:20 UTC and completed SUCCESS by 09:34:51 UTC. Source start/poll/import,
  content preflight, one-file PR and Web quality dispatch succeeded.
- [PR #1110](https://github.com/usdimpact/usd-impact-site/pull/1110) is still OPEN, non-Draft,
  unmerged, source HEAD `c011ddd1a3060e0b324a38f9b3474320880241fe`,
  base main `bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea`.
  The sole content is `apps/web/src/content/news/2026-11-04.md`.
- [Web quality #41808591121](https://github.com/usdimpact/usd-impact-site/actions/runs/41808591121)
  exact-head `validate-and-build` SUCCESS; Vercel Preview SUCCESS.
- Separate PR-triggered Web quality/Dependency/Supabase intake runs have
  `action_required` and zero jobs due to GitHub token-created PR policy;
  there is NO verified exact-head required Dependency/migration PASS for #1110.
- The separate trusted-main [bounded auto-publication controller](https://github.com/usdimpact/usd-impact-site/blob/bb6fb9b5cd6212c6a4bbed3069c2cba6a5b17eea/.github/workflows/daily-news-auto-publish.yml)
  subscribes to `workflow_run` completion of `Daily USD Impact publication`. No
  controller run appeared in the 100 recent repository runs, and an API query
  with `event=workflow_run` returned `total_count=0`.
- Therefore zero-touch publication DID NOT complete. No protected-main merge,
  matching Production deploy, dated article, News index, latest JSON and RSS
  parity has been proven. The front-matter `status: "published"` in a PR is
  not evidence of public publication.

## 2. Root cause — strongest hypothesis, NOT proved

Official GitHub documentation:
https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow

- Events triggered by a workflow's `GITHUB_TOKEN` generally do not start
  another workflow. Exceptions include explicit `workflow_dispatch` and
  `repository_dispatch`, plus approval-required PR workflows.
- A similar public GitHub community reproduction exists for a
  `GITHUB_TOKEN`-dispatched child workflow whose own completion does NOT
  generate the expected `workflow_run` controller:
  https://github.com/orgs/community/discussions/48748
- This mechanism closely matches the Nov 4 chain, BUT the exact server-side
  suppression/registration status is not visible through the connector and
  MUST NOT be claimed proven. An authenticated GitHub Actions UI check is
  required to determine whether the controller is enabled/registered and
  if any event delivery was rejected.
- Absence of the controller run and approval-required bot-PR CI are two
  separate failures. Fixing one does not satisfy the other.
- Current same-repo source and exact-head checks are necessary but not
  sufficient to infer trusted provenance across workflow hops.

## 3. Editorial/source FAIL-CLOSED, independent of CI

The auto-generated November 4 article's catalysts and watchlist list the
**EIA Weekly Petroleum Status Report for Friday, November 6, 2026**.
The agency's official schedule says normal release is **Wednesday at
10:30 Eastern**, with **Thursday, November 12** the next holiday exception
for the week ending Nov 6:
https://www.eia.gov/petroleum/supply/weekly/schedule.php

The November 4 regular WPSR therefore falls on Wednesday, November 4,
NOT Friday Nov 6. Verify the actual EIA source/table edition and publishedAt
before proposing a corrected article. The BLS October Employment Situation
release on **Friday Nov 6 at 08:30 Eastern** is independently correct:
https://www.bls.gov/schedule/news_release/empsit.htm

The October 28 Fed hold at 3.75–4.00% is confirmed by:
https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm

**No source-paired editorial correction has been approved.** A changed Daily
PR HEAD would also violate the controller's one-original-generator-commit
and exact-immutable-head gate, so do not edit #1110 as an auto-merge shortcut.
Do not assume a valid article after correcting only one date; remaining
release/source rights must be rechecked.

## 4. Safe architectural options — decision record only

### Option A — trusted same-workflow post-generator job

Add a separate trusted-main, isolated job after the Daily generator that
re-verifies the exact source run, immutable bot PR, source at original SHA,
required exact-head checks, Vercel Preview and morning cutoff without ever
checking out PR HEAD code to run scripts. The job's permissions and trust
model must be reviewed independently. Current auto-publisher expects a
`workflow_run` event payload; it cannot be blindly reused from a
`workflow_dispatch` job. Failure must result in HOLD, not a best-effort
merge. Do not reuse a privileged generator token without explicit review.

### Option B — independent explicit dispatch with narrowly scoped identity

Use a dedicated authenticated, narrowly authorized and short-lived GitHub
App token to explicitly `workflow_dispatch` a trusted controller (rather than
trusting implicit `workflow_run`). The controller must bind immutable source
run ID/sha, PR HEAD/base, date, and no-duplicate guard, validate all of them
from API instead of accepting inputs as authority. This requires new owner
approval for app permissions/credentials, privilege boundaries and release
gates. Never use a broad personal-access token as an unreviewed workaround.

### Option C — independent bounded scheduled controller

A separate protected scheduled/wake controller can discover one unique,
fully eligible original Daily artifact and run existing strict validations,
but schedule latency can skip the 08:30 ET cutoff. It must fail closed if
created too late or ambiguous. Do not use a late catch-up to claim on-time
zero-touch publication. No additional scheduled workflow is created here.

**No option is authorized.** Prefer an independently reviewed design that
does not require new secrets and preserves the previous trust boundary, but
do not weaken provenance, scope or post-cutoff protections to fit it.

## 5. Required negative and release acceptance tests

All requirements below are FUTURE tests; no active controller changed.

- Source is a trusted native `schedule` or one proven, same-day independent
  backstop `workflow_dispatch`; otherwise fail closed.
- The source run and its required generator steps all succeeded at one
  immutable protected-main SHA; source-run ID is not caller-chosen authority.
- Exactly one open non-Draft original Daily PR matching source-run ID, correct
  account/repository and branch naming; exactly one file added by generator.
- Head equals original generator output, base equals verified main, zero
  extra commits, no PR-head code executed by privileged job.
- Exact HEAD: Web Quality, Dependency, Supabase migration guard all completed
  SUCCESS from trusted GitHub Actions, not `action_required` or skipped;
  Vercel Preview at exact HEAD is independently READY.
- Editorial primary sources, release dates, asset impact and compliance pass;
  the Nov 4 EIA misdate fails its agency release-calendar check.
- No GITHUB_TOKEN-only PR-created run is treated as an approved release check.
- No after-08:30 ET automatic merge; no duplicate edition, stale source run,
  ambiguous dispatch, changed main or unchanged-but-malicious PR.
- No merge unless checks are re-read immediately before SHA-leased merge.
- If a merge is separately owner-authorized, proof requires exact
  Protected-main merge SHA + Production Vercel READY + live article, News
  index, latest JSON and RSS surfaces. No success claim from content metadata.
- Next eligible natural unattended run must pass the entire chain before
  #840 can be considered accepted; an after-cutoff manual review cannot
  retroactively certify zero-touch acceptance for November 4.

## 6. Owner and reviewer handoff

**First:** Authenticate in GitHub Actions UI and verify controller registration,
enabled state, and the source-run trigger delivery history. Compare actual
workflow event lineage with GitHub's token recursion rule; do not assume
the missing controller is solely a YAML bug.

**Second:** Choose A/B/C design for a separate **Draft-only** implementation
with no credentials and explicit negative tests. Do not amend or merge
protected main until the design is independently reviewed and a specific
owner release approval is recorded.

**Third:** Review the Nov 4 EIA calendar and current EIA table as primary
sources. Prepare a separately source-paired editorial correction for owner
review; do not edit the original generator HEAD as an auto-publisher bypass.

**Fourth:** Continue Daily #840 operational monitoring. Keep Research #1103,
Score/F2 rights, customer email and commerce Production HOLDs untouched.

Evidence: https://github.com/usdimpact/usd-impact-site/issues/840#issuecomment-6633534969

**Status: DRAFT REVIEW ONLY / #840 P0 OPEN / NO WORKFLOW OR ARTICLE CHANGE /
NO PRODUCTION PUBLICATION / ALL RELEASE GATES HOLD.**
