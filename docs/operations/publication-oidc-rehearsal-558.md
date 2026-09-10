# USD Impact #558 - non-publishing OIDC rehearsal

## Current endpoint-path repair checkpoint - 2026-09-10

This section supersedes the historical initial-preparation instructions below.
The identity rehearsal was installed by #561; the no-token diagnostic was installed
by #564. Their installations must not be repeated. The original identity run
`34496519744` and diagnostic run `34503470615` remain attempt 1 and are not rerun
under their consumed approvals. Preparation baseline is main
`e0c988705f60eafb237bfb0a22569746552c7a12`.

The diagnostic captured ten passing endpoint predicates and one failing predicate:
`exactLowercaseIdtokenSuffix`. Its own job supplied an HTTPS URL matching the
retained hostname pattern but not the custom `/idtoken` suffix. It disclosed no URL
components and requested no token. This does not recover the historical failed
job's endpoint, verify any identity, or establish that a live repair has succeeded.

### Candidate behavior and safety boundary

The repair treats the path of `ACTIONS_ID_TOKEN_REQUEST_URL` as opaque, following
GitHub's documented runtime-URL interface. It does not invent another suffix or
rewrite the path. Existing URL envelope controls remain: nonempty bounded string,
no CR/LF/tab, parseable URL, HTTPS, the same hostname pattern, and no user information,
nondefault port or fragment. The unchanged URL parser/query normalization behavior
is not a new transport-security guarantee.

The transport captures one validated endpoint at construction. Bearer-bearing
requests must exactly match a URL derived from that endpoint; only the validated
challenge/receipt audience may vary. Other hosts, paths, or non-audience parameters
are rejected before fetch, even on the same permitted hostname. Without an explicit
bound endpoint the transport supports discovery/JWKS only. The live entry reads the
GitHub-provided endpoint once and supplies the same value to preflight and transport;
there is no endpoint command-line or workflow input.

Discovery/JWKS destinations, all signature/audience/identity checks and the copied
verifier stay unchanged. GET-only behavior, no redirects/retries/cookies, four-second
response deadline, 65,536-byte response limit, and 4,096-character final request URL
limit remain. The JSON counters record application attempts, not independent provider
issuance telemetry. A transport refusal may follow a harness attempt increment.
Every report retains false publication/admission/enforcement/public-response flags.
No admission, article, database, cloud-exchange or deployment operation is added.

### Exact integration and review sequence

This follow-up modifies six EXISTING files: run.mjs, test-rehearsal.mjs, both existing
rehearsal YAML files, the existing CI runtime checker, and this runbook. The verifier,
completed diagnostic, #559, and #560 are unchanged. No trigger or permission expands.

A corrected script alone is insufficient because the caller checks out the immutable
runner commit. During separately approved draft staging, create a runner commit R
from the exact approved main containing ONLY run.mjs, test-rehearsal.mjs and the
runner YAML with matching executable checksums. Read its parent and all changed blobs
back from GitHub. Then derive the caller's two pins and the CI pin/fingerprints from
that verified R in a second commit. The CI parser, verified-file-handle safeguards
and policy checks must otherwise remain byte-for-byte unchanged. Publish only the
complete final draft head; do not create an intermediate branch whose caller still
uses the old runner. Retain historical source branches and pins as evidence.

The prepared packet's runner pin is unresolved until that verified commit exists.
Never install a placeholder, fixture SHA, arbitrary branch, or stale runner pin.
Draft CI/Preview, installation and any resulting Production deployment, and a later
single live-token rehearsal remain separately governed. Both previous one-run
approvals are consumed. Do not infer run permission from a green PR or this runbook.
Keep #558 open; the wider calendar-publication guard remains inactive.

### Evidence and references

The local repair suite preserves 58 applicable original groups and adds 43 groups;
the obsolete custom-suffix rejection was replaced by path-compatibility and exact
endpoint-binding tests. Tests use synthetic endpoints and signatures, not the
undisclosed runtime URL. Their execution metadata belongs in the preparation/release
evidence; no live-token success or Production installation is implied here.

- https://docs.github.com/en/actions/reference/security/oidc
- https://github.com/actions/toolkit/blob/main/packages/core/src/oidc-utils.ts
- https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5622207909

The inspected toolkit OIDC source (Git blob
`ac698542f9c5cee04fc5081cacfd8878dba7ecbc`) uses the provided URL without an `/idtoken`
path contract. This repair does not adopt its retry/debug behavior. The original
non-publishing token audience and verifier implementation are not changed.

## Historical initial preparation - superseded for installation/resume

The initial preparation record below is retained for provenance only. Its draft,
main, first-run and six-added-file instructions describe the pre-#561 state. They
must not be used to repeat either completed installation or execution.

# USD Impact #558 - non-publishing OIDC rehearsal preparation

## Status and fixed baseline

Prepared and tested offline on September 10, 2026. Not installed or dispatched.
No real OIDC token was requested. PR #559 remains draft and its publication guard
remains inactive. This packet is not a merge, token-permission or live-run approval.

- Repository: `usdimpact/usd-impact-site` (ID `1265351071`; owner ID `275107298`).
- Current main: `058d4d893ab12ce7ddd51ad43154d02b8536ca59`.
- Current #559 head: `8686bb9258a8c97644c092c47288673f06fe7006`.
- Source verifier Git blob: `864112766fd01079fd01a2827da0176c7342b340`.
- Copied verifier SHA-256: `e65f2f81f376473534cde41262108803515a2a5f5bf798909bd6425ee1163378`.

The verifier is byte-for-byte the reviewed #559 source, renamed to `verifier.mjs`
for a standalone ESM runner. No publication verifier setting is weakened and no
rehearsal code has been added to the live site or PR branch in this continuation.

## Scope: prove identity, not publication

The proposed first live rehearsal requests at most two OIDC tokens in one
GitHub-hosted execution: a synthetic challenge identity and a linked synthetic
receipt identity. It checks real issuer signatures and exact caller/reusable
workflow revisions, protected main, repository IDs and execution continuity.
It does not fetch an article, generate content, call a publication recorder, open
checkout, access Supabase, query Vercel or change public serving.

The synthetic evidence schema is `identity-rehearsal-only/558-v1`, includes a fresh
random nonce, and explicitly records `publicResponseObserved=false`. Evidence hashes
are generated internally; there is no input for an article URL or publication hash.
The existing verifier's custom audience grammar is retained to test that exact
implementation. Isolation is provided by the distinct synthetic evidence and exact
rehearsal-only workflow names and pins. These workflow identities MUST NOT be added
to any future Production witness allowlist. Identity-only token verification is
not an Ed25519 witness receipt, a response observation or admission authorization.

## Exact prospective six-file change

Create a separate draft PR from unchanged main, not from #559. Suggested branch:
`publishing/558-oidc-rehearsal-only`. Do not merge the unfinished 73-file guard PR
just to obtain a main-branch identity test.

| Prospective repository file | Packet source |
| --- | --- |
| `.github/workflows/publication-oidc-rehearsal-runner-558.yml` | `templates/publication-oidc-rehearsal-runner-558.yml.template` |
| `.github/workflows/publication-oidc-rehearsal-558.yml` | Rendered caller template after the runner commit exists |
| `scripts/publication-oidc-rehearsal-558/run.mjs` | `source/run.mjs` |
| `scripts/publication-oidc-rehearsal-558/verifier.mjs` | `source/verifier.mjs` |
| `scripts/publication-oidc-rehearsal-558/test-rehearsal.mjs` | `source/test-rehearsal.mjs` |
| `docs/operations/publication-oidc-rehearsal-558.md` | This runbook |

The local workflow renderer, YAML tests, retained 47-group test and evidence are
packet-only tooling, not additional files in that prospective change. Existing
quality workflows, site files, package files, database contracts, provider settings
and branch protection are out of scope.

## Immutable pin bootstrap - do not invent a SHA

There is deliberately no current live runner-workflow commit pin. The #559 head
contains no such installed workflow and is NOT an acceptable substitute pin.

After explicit approval for draft preparation:

1. Re-read main and #559. Stop on drift. Check that all six new paths and the
   proposed branch do not conflict with existing work.
2. On the separate draft branch, create one commit R containing the runner
   `workflow_call` YAML, the three exact scripts and this runbook. No caller is
   present in R. Do not dispatch or invoke it.
3. Read R back from GitHub and verify its parent, five-file scope and every Git
   blob. R now gives a real immutable reference to the reviewed runner workflow.
4. Run `node source/render-workflows.mjs <R> <local-output-directory>` from the
   packet. It generates the caller with literal `uses: ...@R` and matching
   `runner-sha: R`. Add only that generated caller in a second commit C. Do not
   substitute a branch, tag, #559 head or synthetic test SHA.
5. Open/keep the new PR draft, verify the six-file diff, current-head CI and any
   automatic Preview, and record R/C plus hashes in #558/#559. Stop before merge,
   manual dispatch or token generation. Do not force push or rebase.

The default-branch requirement for `workflow_dispatch` is a real installation
constraint. A later exact merge approval for the isolated PR is separate from this
preparation; an existing Git-to-Vercel integration may create a Production deployment
on that merge even though site code is unchanged. Do not silently allow or suppress
that deployment. Main movement also invalidates prior exact-base release approvals
for #559; it does not authorize rebasing #559.

## Permission and execution contract

Both YAML files start with `permissions: {}`. Only the calling and called
`identity-only` jobs receive `contents: read` and `id-token: write`. No contents,
Actions, pull-request, deployment, package or administration write scope is granted.
No secrets are inherited or supplied, no environment is attached, and no repository
or provider secret is created. `id-token: write` is nevertheless a protected
permission change and must be approved before installing either YAML file.

The caller has only `workflow_dispatch`, a required confirmation defaulting to
false, and a serial concurrency group. The runner has only `workflow_call`. Both
require the exact repository, a manual main-branch event, protected main, confirmed
input and `run_attempt=1`. There are no push, PR, schedule or `workflow_run` triggers.
Only `ubuntu-24.04` GitHub-hosted execution is proposed, with a two-minute job timeout.
Node stays on the project's reviewed `24.x` policy. Checkout/setup actions use
exact commits already present in main's quality workflow.

Checkout is sparse, uses the literal caller-supplied R pin, and does not persist
Git credentials. The runner hashes ALL three executable source files before
executing any of them. Thus even a different checkout cannot replace executable
code without failing that check. The token must independently attest the same
reusable workflow SHA as R. Offline tests execute before the live runner.

A confirmation input and serial concurrency are not a durable global one-use
approval store. A later run authorization must cover exactly one manual dispatch;
the operator must not dispatch a second run or retry an uncertain result. The
script makes no automatic token retry, and `run_attempt=1` refuses GitHub reruns.

## Network and token handling

Application-level HTTP destinations are limited to:

- `GET https://token.actions.githubusercontent.com/.well-known/openid-configuration`;
- `GET https://token.actions.githubusercontent.com/.well-known/jwks`;
- at most two GETs to the runtime-injected `ACTIONS_ID_TOKEN_REQUEST_URL`, after
  requiring HTTPS, a GitHub-owned `*.actions.githubusercontent.com` host, an
  `/idtoken` path ending, and no credentials, non-default port or fragment.

The runtime request URL's existing audience is replaced, never accumulated. The
runtime request bearer is sent only to that validated endpoint. Redirects are
errors; there are no retries, cookies, URL overrides, article destinations, callback
URLs or cloud-exchange endpoints. Each response is limited to 65,536 bytes and a
four-second timeout covering headers and body. Unexpected HTTP status, response
shape, content type, truncation, stale keys or token verification causes HOLD.

These are code-level restrictions, not a configured runner-wide egress firewall.
GitHub's runner/checkout/setup-node/logging infrastructure necessarily uses its own
platform network. No statement is made that all runner traffic is restricted to
the three application endpoint categories above. The precise injected runtime
endpoint and live response format are still unverified; unexpected formats must
HOLD rather than trigger a relaxed retry.

Raw tokens, bearer values, full claims, subjects and token IDs are not logged,
written to files, exported as workflow outputs or uploaded as artifacts. Tokens
exist only in process memory. No debugger action, shell trace or `secrets: inherit`
is used. The protected report is an allowlisted summary, not raw provider output.

## Result contract and acceptance criteria

`oidc-rehearsal-report/558-v1` reports a fixed decision, stage, request/token counts,
repository and exact workflow SHAs, run ID/attempt, two continuity booleans and a
verification timestamp on success. It ALWAYS reports:

```
rehearsalOnly=true
publicationAuthorized=false
admissionRecorded=false
enforcementActive=false
publicResponseObserved=false
```

`PASS_IDENTITY_REHEARSAL_ONLY` requires both verified token signatures, protected
main, exact caller/reusable workflow refs and SHAs, the same run/attempt/check-run,
distinct token IDs, correct evidence audiences, bounded token/key freshness, and
no more than two token requests. Only sanitized JSON and fixed test-result lines
are printed. HOLD exits with status 2 and has no retry path. An absent report,
cancelled job, skipped confirmation or uncertain acknowledgement is NOT PASS.

A live acceptance review must tie the sanitized report to the exact observed run,
job permissions, main SHA and pinned runner SHA. The report is not independently
signed provider evidence. No live outcome or exact total run duration is promised
by these offline tests.

## Verification completed in this preparation

- 47 retained verifier regression groups passed against the exact copied module.
- 59 new offline harness/transport/CLI groups passed with ephemeral synthetic RSA
  signatures and injected responses. No actual GitHub tokens or network calls.
- 21 workflow preparation checks passed, including YAML structure, two syntax
  checks, pin rejection and ten deliberately unsafe workflow variants.
- Two additional negative controls (allowing a rerun and allowing redirects) caused
  the appropriate harness tests to fail. Unsafe variants were not retained as
  candidates.
- Five standalone JavaScript syntax checks passed.
- A local `--live` invocation without authorized GitHub context returned
  `HOLD_REHEARSAL_NOT_AUTHORIZED`, with zero requests and zero tokens.

The 21 workflow checks include the ten YAML negative controls; do not count them
again. The 59/21 preparation checks are NOT added to #559's 886-group CI milestone.
No current-head CI rerun, managed database rehearsal or live witness test occurred.

Reproduce locally from the packet root:

```bash
node source/test-retained-identity.mjs
OIDC_REHEARSAL_TEST_REPORT=evidence/rehearsal-tests.json node source/test-rehearsal.mjs
python source/test-workflows.py
```

The Python structural tests require PyYAML; that is local verification tooling,
not a future runtime dependency. Neither command enables GitHub token permissions.

## Approval gates

A. **Next: create the isolated draft PR only.** Exact six-file scope above; job-only
`contents: read` and `id-token: write`; runner commit R then caller pin R; existing
automatic CI/Preview only. No merge, manual dispatch, real token request, managed
DB, provider setting, new secret or Production activation. Record evidence and stop.

B. **Later: separately approve its exact-head/exact-base merge and deployment
side effect**, after scope/checks are known. Keep #559 unmerged. Do not bypass
protection or accept a moved base.

C. **Later: separately approve one identity-only manual dispatch** at the verified
post-merge main and exact R, at most two tokens, no retries and no database or public
publication capability. Read the result and stop on an unknown state.

The original calendar guard still needs its authenticated receipt/evidence bridge,
managed installation approval, serving integration across all publication surfaces,
provider control evidence, broader calendar adapters and delayed-publication tests.
Do not close #558 or claim the calendar protection is active from this rehearsal.

## Primary references checked September 10, 2026

- https://docs.github.com/en/actions/reference/security/oidc
- https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://token.actions.githubusercontent.com/.well-known/openid-configuration

GitHub's live documentation describes custom audiences and job-scoped token
permission; reusable workflow references may be pinned to a SHA; a manual caller
must exist on the default branch. The discovery document lists the required
`ref_protected`, `check_run_id` and reusable-workflow identity claims. This is
reference/schema verification, not verification of a real job token.
