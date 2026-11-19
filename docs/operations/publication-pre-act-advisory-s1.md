# S-1 — USD Impact publication pre-act advisory (manual only)

**Status: DRAFT DESIGN / NOT RELEASE AUTHORIZED.** This page accompanies an unmerged Draft PR. It never grants merge, deployment, alias, or publishing permission. `#1269` remains P1 NO-GO; `#1268` remains Draft/REVIEW_READY_HOLD. Existing Daily #840, rights, and Production restrictions are unchanged.

## What it can and cannot do

S-1 performs an on-demand read-only **advisory** for an exact PR head and `main` base, or a target commit and current `main` before a separately authorized Production alias action. It reads the official BLS schedule via the *existing* bounded adapter and requires at least **60 minutes** until release for a new preview. It covers BLS national monthly CPI, PPI and Employment Situation; unsupported issuers and missing official evidence HOLD. It rechecks the head/base and evidence freshness, and prints a content SHA-256 and source timestamps. No local install or tokens are needed from the owner.

S-1 **does not** enforce a merge or deployment, inspect which deployment is actually serving Production (S-2), verify Daily releases (Daily #840), prevent owner/admin bypass, provide a clock guarantee during the subsequent human action, or resolve issue #1269. Its `workflow_dispatch` check is never a required merge check. The only allowed output is job log and job summary; no status writes, comments, labels, dispatches, emails, Vercel actions, IndexNow or publication.

## Separate approval gates

1. **Draft stage:** source authoring and offline synthetic tests only; do not run the workflow, merge or deploy.
2. **Independent review:** exact-SHA diff (at most the four new authorized files), local offline fixture execution, no regression to C01–C31/C20b, D09–D13/D15/D18–D22, archive and unrelated PR positives. Verify no secrets, privileges, write actions, other workflow triggers, or existing-file edits.
3. **Merge:** requires another explicit owner release decision after the independent report and current-main integration checks. A successful Draft CI check is not merge approval.
4. **Operational use:** a *further*, explicit owner approval is required for the first `workflow_dispatch` run. Before then, do not click **Run workflow** on any similarly named workflow, especially the write-capable **Publication calendar PR freshness** fallback.

## After future independent approval and protected merge — browser instructions (not authorized now)

1. Open [GitHub Actions for USD Impact](https://github.com/usdimpact/usd-impact-site/actions). Select only **USD Impact publication pre-act advisory (manual only)** in the left workflow list. Check that the selected workflow is read-only with just `contents: read` and `pull-requests: read` permissions.
2. Click **Run workflow**. **Branch must be `main`**. Choose `pre-merge` or `pre-alias`.
3. For **pre-merge**: on [Pull requests](https://github.com/usdimpact/usd-impact-site/pulls), copy the **PR number**, full **head SHA** and **current main SHA**, then fill `pr_number`, `expected_head_sha`, `expected_base_sha`. Leave pre-alias fields blank. The base must match live `main`.
4. For **pre-alias**: copy the **target commit SHA** from the proposed Vercel deployment's Git metadata, and the **current main SHA** from [GitHub main commits](https://github.com/usdimpact/usd-impact-site/commits/main). Fill `target_sha`, `expected_main_sha`. Leave pre-merge fields blank.
5. If the action is separately authorized, open the workflow run and read **Summary**. Copy the decision, exact bound SHAs, content SHA-256, checked time, official URLs, release UTC/New York time, margin, and expiration into the release tracker. A success is **not** authorization.
6. Any `HOLD_*` or `BLOCK_PREVIEW_EXPIRED`, stale check, unsupported event, changed SHA, missing source, unexpected content, or delayed runner means **stop**. Even a `PASS` is valid only for its pinned revision and until its earliest expiry. A new commit, schedule update, or more than 15 minutes requires a rerun.
7. **Production aliases are never changed by S-1.** Until S-2 is approved, after any *separately authorized* alias action, manually verify the deployment holding `www.usd-impact.com` and `usd-impact.com` through Vercel. Do not infer the live deployment from the newest-created record.

**First live use** (only after gate 4): one non-publication PR expecting `NO_PUBLICATION_DECISION` and one synthetic/past BLS preview expecting `BLOCK_PREVIEW_EXPIRED`, without merging, deploying, commenting or modifying content. If GitHub-hosted runners cannot reach BLS, the check HOLDs; use the separately approved manual primary-source procedure, not a bypass.

## Technical boundaries

- One `workflow_dispatch` trigger, job guard `github.ref == 'refs/heads/main'`, unique job/check name, no `secrets.` or `environment:`, no elevated privileges. Runs trusted `main` code only, never checks out or runs PR-head code.
- GitHub queries are GET-only with bounded timeouts, body sizes, changed-file pagination and blob verification. A missing/truncated file listing or missing tree HOLDs. The script never invokes a mutation endpoint.
- The *real* BLS adapter makes one fresh official read per candidate, and the in-memory decision must pass the existing freshness check. The result binds `repository`, `base`, `head`, and sorted per-file content hashes. There is no input clock, cached evidence, safety-margin override or bypass flag.
- `NO_PUBLICATION_DECISION`, `ARCHIVE_EDIT`, and `NO_CONTENT_CHANGE` are informational successes, not release approval. Changed Daily files appear in the summary only as `OUT_OF_SCOPE_DAILY` and cannot authorize Daily work.
- `pre-alias` reads source trees for both the proposed target and `main`; missing newer catalyst content or unknown changes HOLD. A same-SHA redeploy yields `NO_CONTENT_CHANGE` but may still produce different build-time output.
- This advisory has **no auto-execution trigger**. The new offline tests are **not wired into existing CI**, because this Draft is prohibited from editing `quality.yml` or `package.json`. Independent offline test execution is a mandatory separate gate.

## Known limitations / HOLDs

- **TM-1 only:** a PR contributor or owner may change code or skip the advisory. A checked decision does not bind to a later GitHub merge API or Vercel alias action. No TM-2/root-of-trust claim.
- GitHub may delay `workflow_dispatch`, and the official BLS site may block GitHub runners (including 403, 429, robots, timeout or malformed HTML); all are HOLD.
- No Vercel activity attribution, session privileges, rollback protection, serving-time veto or alias-drift detection. D-02 remains `ORIGIN UNVERIFIED`, and S-2/S-3/TM-2/E1 need separate decisions.
- `#1269` P1 NO-GO; scheduler gaps, outdated green statuses, publication classifier/series gaps, head-recheck residuals, RS-3/RS-4 and historical strict-head preservation remain outside S-1.
