# G2: deploy-free main, protected release-branch offline policy pilot

**DRAFT / OFFLINE / SYNTHETIC ONLY.** The user authorized G2 only: one new `agent/*` Draft PR containing a read-only Option 2 decision model, 37 Q-01--Q-10 negative tests, and documentation. There is **no** authorization to merge, enable deployment, configure Vercel, create a project, dispatch Actions, inspect secrets, pay for Claude, promote, or alter Production. Existing Draft PRs #1199 and #1200 are not modified.

## Scope and intended architecture

The *candidate* architecture uses `main` for integration, with Git-triggered Vercel deployments for `main` disabled, and a separately protected `release/production` branch as Vercel's Production branch. A privileged, provenance-checked controller would update that release branch **only to an exact commit on `main`** after authenticating its source, classifying the complete live-to-candidate commit history and net diff, checking the exact PR tree and CI, preventing duplicates, and enforcing the rollback lock. The daily publisher would dispatch the controller explicitly **after** its guarded squash merge, wait for a trusted completion receipt, then run its existing live article/index/latest.json/RSS check inside the bounded morning lease. This is a **design**, not an installed controller.

The current Production project does not have `main` suppression or a release branch configured. None of the code in this directory calls GitHub, Vercel, network APIs, deploy or merge commands. The only file read is a caller-supplied JSON fixture via the optional CLI. The CLI deliberately returns exit code **2 for every result**, including synthetic model passes, so it cannot be used as a release-authorization gate.

## Files

- `release-policy.mjs`: pure synthetic-only evaluator. Every output contains `mergeAuthorized:false`, `deploymentAuthorized:false`, `workflowDispatchAuthorized:false`, `productionSettingsAuthorized:false`.
- `release-policy.test.mjs`: exactly **37 numbered negative cases** across Q-01--Q-10, plus nine non-release control/adversarial tests. Uses Node's built-in test runner; no external dependencies or network.
- `snapshot.template.json`: deliberately incomplete and invalid for any release. It returns HOLD.
- This README: evidence limitations, test coverage and unresolved owner gates.

Run locally (Node 22 or later):

```sh
node --test docs/operations/deployment-control-g2/release-policy.test.mjs
node docs/operations/deployment-control-g2/release-policy.mjs docs/operations/deployment-control-g2/snapshot.template.json
# The second command exits 2; HOLD is expected.
```

## Modeled release safeguards

1. The simulator accepts only `mode:dry_run`, `provenance:synthetic_fixture`. It has no output that grants operational authority. Missing, malformed, stale, or untrusted data => HOLD. A synthetic owner/emergency release must NEVER inherit the Daily publisher's dispatch authority.
2. It requires a synthetic main-suppression flag and exact production project/branch identities, protected release branch and verified config pin. **These fields are mock inputs**, not observations of the current Vercel installation.
3. It requires a complete, bounded ancestry graph back to the actually live SHA, an identical candidate `main` commit, every changed commit classified, and a net diff containing only enumerated file paths. Unknown, held and cross-workflow paths fail closed.
4. Docs-neutral and owner-approved paths are single **fabricated examples**. They are not production allowlists or approval of G-R5. Approved real path maps must be reviewed separately; never infer a broad `docs/**` allowlist.
5. Required checks are on the reviewed PR head, with its tree exactly matching the main release candidate tree. The squash-merge SHA is **not** assumed to have its own check run. Evidence must be fresh and complete.
6. A simulated lock must be current, bound to the release baseline AND exact candidate SHA, and marked atomic; a simulated lease must be exclusive and keyed by the exact candidate. A passing JSON assertion **does not establish a real GitHub atomic lock or deduplication system**.
7. A rollback-active or unknown state, or live SHA diverging from the release branch, always holds. The design must not automatically promote during rollback. Owner-authorized recovery is a separate future workflow.
8. Daily source/run/bot proof, exact parent SHA and original dated article path, post-merge explicit `workflow_dispatch` receipt from the Daily publisher ONLY (separate from the synthetic owner/emergency release authority), New York 08:30 cutoff (DST-aware), and freshness are modeled. The real publisher still needs changes under G-R4; none are included.
9. Owner/emergency releases require a short-lived, exact-candidate owner receipt in the model; boolean `signed:true` in a fixture is **not a cryptographic signature** and cannot support real operations.
10. Isolation requires no Production-domain changes, secret reads, remote actions or project mutations. G3 separate sandbox test is not authorized by this PR.

## 37 negative cases

| Group | Cases | Required failure coverage |
| --- | ---: | --- |
| Q-01 | 4 | Main suppression absent, wrong Production branch, existing candidate deployment, unapproved docs path |
| Q-02 | 4 | Bad Daily source, wrong date, missing explicit dispatch, human actor |
| Q-03 | 3 | Forged dispatch issuer, replayed attempt, unsuccessful publisher |
| Q-04 | 5 | Truncated DAG, no live ancestry, held migration, duplicate commit, omitted net diff |
| Q-05 | 4 | Missing required check, failed check, PR-vs-main tree mismatch, stale CI |
| Q-06 | 3 | Missing exclusive lease, competing release, already-released SHA |
| Q-07 | 3 | Rollback active, live/release divergence, unknown rollback status |
| Q-08 | 4 | Owner approval missing, wrong SHA, expired approval, forbidden bypass |
| Q-09 | 4 | DST-aware Daily cutoff, non-atomic lock, stale lock, source-main drift |
| Q-10 | 3 | Wrong project, unverified separation, non-dry-run request |
| **Total** | **37** | All numbered cases assert HOLD and all action authorizations false |

Three original model sanity checks exercise synthetic Daily/docs verdicts and DST cutoff; a fourth checks the CLI's mandatory fail-closed exit, a fifth verifies invalid clocks return HOLD, and four added adversarial/owner controls verify independent dispatch authority and exact-candidate lock binding. The owner workflow path is SYNTHETIC, not installed in GitHub, and grants no permission. Model results (`MODEL_RELEASE_CANDIDATE`, `MODEL_DOCS_NO_DEPLOY`) are **not** GO decisions.

## Outstanding P1 risks / G2 limitations

- **Held changes in the release tree:** every commit plus net diff since live must be verified by a privileged collector; real DAG pagination, tree hash, held-path inventory, owner approvals and merge commits need independent validation. A supplied JSON file alone is not trusted evidence.
- **`vercel.json` re-enabling automatic deployments:** current GitHub ruleset has zero required approving reviewers and no CODEOWNERS requirement. The sole owner cannot approve their own PR; G-R1 needs a separate owner-controlled attestation and trusted required check without loosening existing protection. The project config is untouched in G2.
- **Daily window race:** a precomputed GitHub required status check can be reused after the clock changes. G-R3 needs a proven atomic pre-merge exclusion tied to the current main and publisher lease, not merely a timestamp check.
- **Real workflow_dispatch:** GitHub `GITHUB_TOKEN`-originated ordinary pushes do not trigger workflows; `workflow_dispatch` is an exception. An exact authenticated post-merge dispatch/acknowledgement is not yet installed. The current publisher waits about 22 live checks and could fail after a successful merge if no release occurs.
- **Duplicate Production deployments:** a prior main commit produced two READY Production deployments. A synthetic dedupe flag is insufficient; G3 must test a real atomic release receipt, lease and repeat behavior.
- **Rollback:** promoting or building during rollback can inadvertently restore a bad release. G3 must prove a lock derived from authoritative Vercel state before any promotion.
- **Issue #840 and live parity:** Health validates the expected dated article/index/JSON/RSS, not arbitrary `main` SHA equality. Keeping the current Daily live checks and incident lifecycle intact remains mandatory.
- **Merge commits and real repository state:** synthetic commit DAG examples are not proof that all GitHub merge topologies or Vercel release-source references are covered. This model conservatively holds on any missing parent/ancestry evidence.

## Evidence and approval boundaries

Pinned source export (nine exact GitHub files, including Daily Health and current Vercel config):
https://docs.google.com/document/d/1OnHSPAYgtt_SRkzXblTTUGI5AIMWz_HRh5fAURYHpJY/edit

Decision runbook, including independent Claude review reconciliation:
https://docs.google.com/document/d/1BX9jBVHI-sBODkYFkpp-VWqjFXHnxmzm2EYdkAeNVtM/edit

Owner-supplied updated Claude architecture ADR:
https://claude.ai/artifact/5TrwSr3H9qQmjVzfeETbZJ

G1: Option 2 selected for isolated *evaluation only*. G2: this offline Draft is approved. **G3 sandbox/project/budget, G4 independent sandbox review, G5 cutover, G6 post-cutover proof and G-R1 through G-R5 remain on HOLD.** All Research/F2/Score/Issue #950/Daily/privacy/media/commerce holds remain. No workflow dispatch, real deployment, merge, credential use or billing authorization is conveyed by this PR.
