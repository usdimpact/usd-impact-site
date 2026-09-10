# OIDC permission baseline reconciliation — September 10, 2026

The installed #558 diagnostic and identity rehearsal declare three job-level
`id-token: write` grants. Their reviewed installation did not update the
watchdog's `2026-09-05.1` permission baseline, so `WORKFLOW-SAFE-PERMISSIONS`
correctly reports three unexpected grants. The [18:28 watchdog
report](https://github.com/usdimpact/usd-impact-site/actions/runs/34514535597#summary-102996567233)
and a local source-only scan reproduce the mismatch.

The proposed `2026-09-10.1` baseline records only those three existing file/scope
pairs. It does not change a workflow, grant a new capability, run a job, or clear
the historical failed report. The governing issue remains [#558](https://github.com/usdimpact/usd-impact-site/issues/558).

## Installation and retained source evidence

Reconciled against `main@de7226c7091f436424dd748939b10c11af5adc0e`:

| Existing workflow | Reviewed installation | Current Git blob |
| --- | --- | --- |
| `.github/workflows/publication-oidc-rehearsal-558.yml` | [#561](https://github.com/usdimpact/usd-impact-site/pull/561), endpoint/pin repair [#565](https://github.com/usdimpact/usd-impact-site/pull/565) | `90f31604e549b3f47bb553ef81c347b9144e874c` |
| `.github/workflows/publication-oidc-rehearsal-runner-558.yml` | [#561](https://github.com/usdimpact/usd-impact-site/pull/561), executable-checksum repair [#565](https://github.com/usdimpact/usd-impact-site/pull/565) | `68df9ff624cd9da7b4af427a086b501ae956e3c1` |
| `.github/workflows/publication-oidc-endpoint-diagnostic-558.yml` | [#564](https://github.com/usdimpact/usd-impact-site/pull/564) | `05f1db506cc01d23fdadebe98b4176db85388106` |

- [#561 installation verification](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5620960063)
  records squash `e609ae1ca497805b04a8472bde5c54a7b827e0fc` and the approved
  seven-file installation, including both identity-job grants.
- [#564 installation verification](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5621980295)
  records squash `e0c988705f60eafb237bfb0a22569746552c7a12` and the diagnostic's
  two-file installation. Its token permission exposes endpoint context; the
  diagnostic application does not request a token.
- [#565 installation verification](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5623294369)
  records squash `ae80da61e0096eed52c97092c189c56374c224b5`, no permission/trigger
  expansion, and preserved diagnostic and historical source records. The caller
  remains pinned to runner `966d3f9ef730ce0a3948be3b7fa292cb58cd5b49`.
- [Completed rehearsal verification](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5623623573)
  records run `34514961715` as identity-only PASS, preserves the installed files,
  and explicitly consumes that one-run authorization. Earlier runs
  `34496519744` and `34503470615` also remain historical, consumed evidence.

## Retention and execution boundaries

Retain the currently installed files and immutable pins as recorded above.
Retirement or workflow edits require their own scoped review, including the
existing source-fingerprint checker. This correction neither extends the
completed one-run approvals nor authorizes another dispatch or token request.

The callers remain manual-only; the reusable runner remains workflow-call-only.
Global permissions remain empty. Existing repository/protected-main/confirmation
and first-attempt checks remain. Exact-main, deadline and one-new-run restrictions
for identity execution are supervised controls, not a durable consumed-approval
mechanism. Permission-baseline PASS cannot establish execution authorization.

The existing collector compares **workflow filename and write scope**, not job
placement, every possible semantic workflow change, or transitive dependency
behavior. Its parser and failure rules are unchanged. The separate pinned-source
and Action-runtime checker remains required; this baseline does not replace it.

## Verification and release boundary

The permission regression suite reads the three installed workflows as data and
uses their baseline entries. It verifies the exact grant set and rejects omitted
entries, additional scopes on each workflow, removal of each expected grant,
OIDC on an unrelated workflow, and relocation to a new filename. Existing broad
permission, privileged-trigger and ambiguous-YAML regressions remain intact.
No fixture dispatches a workflow or requests a real token.

The correction needs normal exact-head checks and separate merge/release approval.
Until installed and freshly checked, the current-main watchdog P0 remains open.
Historical results are not rewritten. Overall calendar enforcement, publication
admission and actual public-response observation remain inactive; #559's separate
security/implementation gates and #558's remaining work are unaffected.
