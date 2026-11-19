# Publication-calendar freshness: status-write hardening and residual release gate
_Date: 15 November 2026. Draft-only engineering record; no Production or release authority._

## Identity and observations
- Protected site `main`: `1856c41f3f5907527eababd11e534de1b6be72f5`. Initial Vercel Production: `READY` at this SHA. No release authorized by this document.
- Existing schedule: Integrity Watchdog runs a special freshness sweep approximately every 5 minutes; the guard examines all open PRs.
- Read-only GitHub enumeration on 15 Nov: **220 open PRs** (100 + 100 + 20). Previously, `setStatus` posted `publication-calendar-freshness` success on every PR, including unrelated PRs. At 12 runs/hour this implies **up to 2,640 status POSTs/hour**, excluding manual runs and other possible contexts. This is an upper-bound estimate, not measured accepted writes.
- Two observed 15 Nov watchdog failures (GitHub runs `43665319876`, `43699193536`) included `HOLD_GITHUB_API_POST_502` from the status endpoint. A 502 is **not proof** this traffic caused GitHub's failure.
- The current **active main ruleset #19557112** requires `validate-and-build`, `Dependency review`, and `Reject Development-only Production migration files`, but **does not require `publication-calendar-freshness`**.
- The BLS guard currently covers `CPI`, `PPI`, `EMPSIT` configured preview records only, not every possible event or all publishing surfaces.

## Narrow Draft change
1. Continue inspecting **all** open PRs and their changed file paths. Do **not** filter by branch name, author, age, issuer in PR title, or `agent/*` prefix: a manual PR could contain a dangerous BLS preview.
2. For `PASS_NOT_APPLICABLE` (zero relevant guarded changes), emit no redundant success status. For a guarded BLS preview, retain a `success` or `failure` status as appropriate. For malformed guarded content, continue posting `failure` even if `relevantCount=0`.
3. On ambiguous status write failures (HTTP 502 etc.), throw an identifying HOLD with the PR number; **do not retry** an uncertain POST and do **not** auto-close that PR.
4. Fail closed if bounded pagination exhausts five pages of 100 open PRs or four pages of 100 file changes without proving completeness. Keep all current source, time-window, and head-SHA checks; no change to the BLS guard classification itself.
5. Extend the current synthetic, network-mocked enforcer tests with unrelated PR, uncovered EIA event, ambiguous 502, >400 changed-file, and >500 open-PR cases. Original five scenarios remain.

**Explicit non-goals:** This change reduces recurring status writes on unrelated PRs but **does not remove the full PR/file read sweep**. It does not establish that a status is enforced at merge time, fix missed GitHub schedules, alter source-rights decisions, or prove that every source URL is authoritative.

## Critical residual gate — NO-GO for claiming stale-preview protection complete
The active protected `main` ruleset does not require the freshness status, and a previously green status/check can persist when a scheduled sweep is delayed, fails, or stops. A status check by itself is not a time-bound release lease. Therefore **do not conclude that this Draft closes delayed-PR publication or issue #558's full acceptance criteria**.

Before any owner-authorized deployment or broadening of enforcement, independently choose and verify a release-time fail-closed control. Options for separate design review:
- **Merge-time enforcement:** an audited release controller or merge-queue gate that recomputes exact current BLS calendar/source, current trusted time, new/changed content and exact head/base before merging; denies any unmatched or unverified path. Needs an independently proven protected-merge bypass matrix and separate owner approval.
- **Required-status architecture:** add the exact guard context to ruleset only together with complete coverage for every PR and a proven freshness/expiry control. Simply requiring this optional status would strand unrelated PRs and would not invalidate old green checks after missed schedules. **Do not change the ruleset now**.
- **Safer immediate default:** preserve review/Draft holds for any time-critical preview, prohibit direct/bypass release and obtain manual exact-head current-date acceptance, pending a complete enforceable design.

Never silently change the existing main ruleset, repo permissions, Vercel, scheduled workflow YAML, Production, IndexNow, source content, open EIA/Weekly/Score/Research holds, secrets, payments, or external services. No manual dispatch or paid regeneration.

## Independent reviewer acceptance
- Verify the **exact new commit SHA** and `main` ancestry, with only two JS files and this document changed.
- Reproduce 10 offline, no-network fixture scenarios; confirm source normal and negative controls were not weakened.
- Specifically attack: malformed preview with zero relevant count; expired BLS branch still BLOCK and auto-close only after status success; ambiguous 502/no retry; >400 files and >500 open PRs refuse to claim full inspection; unrelated shared-SHA PR cannot overwrite an active BLS failure status; rule-set absence cannot be described as closed.
- Inspect automatically initiated GitHub PR CI at new exact SHA, including `validate-and-build`; distinguish CI PASS from hosted Production or release permission.
- Report P0/P1/P2 findings and residual operational risk. Leave Draft/HOLD.

## Monday Daily acceptance (separate issue #840)
Monday 16 Nov 2026 natural-source workflow, trusted author PR, exact-head required checks, protected merge, READY Production and article/index/latest.json/feed parity must be verified independently. The scheduled Daily Health workflow runs at 18:45 UTC / 20:45 Athens on that Monday. Do not dispatch paid generation to manufacture the acceptance.
