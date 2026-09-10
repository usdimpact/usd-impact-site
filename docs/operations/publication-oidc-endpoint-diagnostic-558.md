# Publication OIDC endpoint diagnostic 558

## Purpose

Diagnose the predicates behind the first rehearsal's
`HOLD_REHEARSAL_TOKEN_ENDPOINT` without requesting an OIDC token, making an
application HTTP request, exposing the endpoint or changing its allowlist.
This is a separate diagnostic, not a retry or replacement of the failed rehearsal.

Preparation baseline: main `e609ae1ca497805b04a8472bde5c54a7b827e0fc`.
Preserved failed run: `34496519744`, attempt 1, job `102936253165`.
Preserved original runner: `10ed538c1005ff268dfa82277b1d9db2f9a6a1e1`.
Original `run.mjs` Git blob: `dd778bf6611e7d695949f982033226bb510a2e5b`.
Original source SHA-256: `c46b4bf78f743e97d72a0abd1358258cea9df8f623d35fc716aba65a7d9a7033`.

The first run used the correct caller, main, runner and confirmation. It passed
59 retained synthetic tests, then emitted preflight HOLD with zero application
requests and zero OIDC tokens requested. The precise failing endpoint predicate
was not included in its log. Neither the cause nor a compatible allowlist change
has been established. A synthetic fixture is never the actual failed endpoint.

## Exactly two prospective repository files

- `.github/workflows/publication-oidc-endpoint-diagnostic-558.yml`
- `docs/operations/publication-oidc-endpoint-diagnostic-558.md`

The new workflow is standalone. It does not call the old runner, modify its
checksum-pinned sources, or add a new reusable-workflow exception. It uses the
existing reviewed setup-node commit. No checker, package, SQL, application,
content, existing workflow, #559 branch, or #560 branch change is necessary.
Local diagnostic modules, tests and rendering tools belong only to the review
packet. The workflow contains the exact embedded program verified by those tests.

This preparation does not install either file or authorize a run. A draft PR,
its exact-head installation and any resulting automatic Production deployment,
and the later one-time diagnostic execution remain separate review boundaries.
Do not reuse the consumed identity-rehearsal authorization.

## Permission and execution boundary

Global permissions are empty. The only job permission is `id-token: write`.
There is no `contents: read` declaration, checkout, package install, repository
write permission, environment attachment, inherited secret, or cloud client.

The protected token permission is needed to obtain the runner-provided endpoint
context; it is not approval to request a token. It must be expressly reviewed
before staging/installing this workflow. The diagnostic does not call getIDToken,
fetch, curl, a signing-key endpoint, a token endpoint, or any callback.
Immediately before starting Node, the shell unsets
`ACTIONS_ID_TOKEN_REQUEST_TOKEN`. The JavaScript does not read this bearer or any
unrelated environment value. There is no path from a diagnostic success to the
original `--live` rehearsal. Any other invocation mode is refused.

The pinned setup-node action and GitHub's job provisioning/logging may use their
normal platform network. Zero application requests is not a runner-wide egress
firewall claim, nor a statement that the platform has no temporary credentials.

Manual dispatch is the sole trigger. The job requires the exact repository and
owner IDs, protected main, run attempt 1 and explicit confirmation. It shares the
original rehearsal's serial concurrency group and does not cancel other runs.
The maximum job lifetime is two minutes. Node uses the existing 24.x policy.

## Three required inputs

- `confirmed`: defaults false; set true only for the separately approved diagnostic.
- `approved-main-sha`: the actual post-install main commit approved for that run.
  It must match the run's GITHUB_SHA and GITHUB_WORKFLOW_SHA. The preparation
  baseline is not a substitute for the new installation commit.
- `approval-until-utc`: UTC `YYYY-MM-DDTHH:mm:ssZ`, strictly in the future and at
  most 15 minutes away when the diagnostic starts. The deadline is checked again
  after classification. Backward/invalid clocks and exact expiry cause HOLD.

Inputs are passed through environment values, not interpolated into shell code.
There is no user input for an endpoint, URL, audience, token or publication hash.
The script obtains the endpoint only from ACTIONS_ID_TOKEN_REQUEST_URL after
context and deadline checks. Debug flags cause HOLD where exposed in the process.
NODE_OPTIONS is cleared so inherited preloads cannot alter the diagnostic.

The explicit main/deadline gates are not a durable consumed approval store. A
human or supervising tool must still prevent a second dispatch, verify current
main immediately before launch and review the actual run revision afterward.
Do not rerun a failed, skipped, cancelled or uncertain execution.

## Output and interpretation

Only one JSON report is printed. Its schema is
`oidc-endpoint-diagnostic/558-v1`. All field names and failure categories are fixed.

Eleven installed-policy checks are booleans or null (not evaluated): string
value, nonempty value, bounded length, no control whitespace, URL parseability,
HTTPS, no user information, no nondefault port, no fragment, the original hostname
pattern, and the exact lowercase `/idtoken` path suffix.

Three boolean shape hints distinguish a case-insensitive suffix match, a match
after removing one trailing slash, or a hostname match after removing one trailing
dot. They are diagnostic observations only and never broaden acceptance.

The report contains no raw URL, hostname, path, query, user information, token,
bearer, claims, identifiers derived from endpoint content, exact lengths, input
hashes, or exception messages. Values longer than 4096 characters are not parsed
or scanned for further detail. Unsupported values are not converted to strings.

`DIAGNOSTIC_CAPTURED` means only that this bounded classification completed.
It exits 0 even when `endpointAcceptedByInstalledValidator` is false: that is the
expected useful output for this investigation, not an identity or publication PASS.
The failure list names only tested predicates. Unevaluated predicates remain null.

All reports retain these invariants:

```
identityAuthenticated=false
publicationAuthorized=false
admissionRecorded=false
enforcementActive=false
publicResponseObserved=false
requestsAttempted=0
tokensRequested=0
tokensVerified=0
```

A HOLD report exits 2 and contains no endpoint classification. A skipped job or
missing report is not a completed diagnostic. A synthetic test in the preparation
packet is not evidence of the runtime endpoint's shape.

## Verification before staging

Local Node 22.16.0 executed 74 diagnostic test groups. They check parity with the
unchanged checksum-verified original validator, output restrictions, bounded
inputs, context/revision/deadline controls, blocked bearer reads, and the exact
rendered workflow program. One group contains 480 combinatorial parity fixtures;
these are not 480 extra test groups. The new program was not tested on Node 24
in a real GitHub job during preparation.

Twenty-one separate YAML/embedded-shell checks passed, including actual execution
of the exact shell with synthetic context and rejection of unauthorized context.
Five deliberately unsafe variants were caught: broadened hostname acceptance,
case-insensitive path acceptance, removed deadline ceiling, a bearer read, and raw
endpoint reflection. Defective variants were discarded. These are local tests,
not new remote CI coverage or a live diagnostic result.

The original classifier's URL normalization behavior is deliberately mirrored
for diagnosis; these tests are not a new authorization to rely on that policy.
Any later compatibility repair requires its own primary-source justification
and negative tests after the actual diagnostic result is available.

## Supervised execution after separate approvals

Use only the installed diagnostic workflow, not the original identity rehearsal.
Verify the reviewed code/permissions and current main; confirm no previous run has
already used the approval. Dispatch once on main with the exact SHA and a fresh
bounded UTC deadline. Inspect the run ID, attempt, workflow SHA and one sanitized
report. Preserve the result even when the original endpoint policy rejects it.

Stop on drift, duplicate execution, missing/ambiguous output, or unexpected
capability. Do not request a real token, retry the identity rehearsal, update
#559/#560, alter the endpoint allowlist, dismiss security alerts, merge additional
code, install SQL, change provider credentials/configuration, or distribute content.

## References and unresolved limits

- GitHub OIDC permission/environment-variable reference:
  https://docs.github.com/en/actions/reference/security/oidc
- Original failure evidence:
  https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5621321038
- Original run:
  https://github.com/usdimpact/usd-impact-site/actions/runs/34496519744

The earlier CodeQL #68 alert-result caveat is unchanged; no alert is dismissed by
this diagnostic. Calendar publication enforcement remains inactive under #558/#559.
