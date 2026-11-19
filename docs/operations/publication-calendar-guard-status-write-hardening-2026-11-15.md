# Publication-calendar freshness: status-write hardening and residual release gate
_Date: 15 November 2026. Draft-only engineering record; no Production or release authority._

## Identity and observations
- Protected site `main`: `1856c41f3f5907527eababd11e534de1b6be72f5`. Initial Vercel Production: `READY` at this SHA. No release authorized by this document.
- Configured schedule: Integrity Watchdog requests special freshness sweeps on a five-minute cadence; **actual GitHub scheduled runs are irregular** and must not be treated as a five-minute guarantee. Claude's 15 November source review found a 2.87-hour median gap across 100 observed runs. GitHub officially documents delayed/dropped scheduled triggers. Guard inspection alone is not merge-time enforcement.
- Read-only GitHub enumeration on 15 Nov: **220 open PRs** (100 + 100 + 20). Previously, `setStatus` posted `publication-calendar-freshness` success on every PR, including unrelated PRs. At 12 runs/hour this implies **up to 2,640 status POSTs/hour**, excluding manual runs and other possible contexts. This is an upper-bound estimate, not measured accepted writes.
- Two observed 15 Nov watchdog failures (GitHub runs `43665319876`, `43699193536`) included `HOLD_GITHUB_API_POST_502` from the status endpoint. A 502 is **not proof** this traffic caused GitHub's failure.
- The current **active main ruleset #19557112** requires `validate-and-build`, `Dependency review`, and `Reject Development-only Production migration files`, but **does not require `publication-calendar-freshness`**.
- The BLS guard nominally recognizes `CPI`, `PPI`, `EMPSIT`, **but its literal-name/calendar matching misses valid unlabelled previews**, and self-declared calendar shape is not official-source verification. BLS Employment Cost Index, BEA and Treasury previews are not covered. Existing classifier limitations remain a separate P1.

## Narrow Draft change
1. Continue inspecting **all** open PRs and their changed file paths. Do **not** filter by branch name, author, age, issuer in PR title, or `agent/*` prefix: a manual PR could contain a dangerous BLS preview.
2. For `PASS_NOT_APPLICABLE` (zero relevant guarded changes), emit no redundant success status. For a guarded BLS preview, retain a `success` or `failure` status as appropriate. For malformed guarded content, continue posting `failure` even if `relevantCount=0`.
3. Fetch the newest status for the SHA/context before posting; **write only on change** (state, explanation or target PR URL). On ambiguous status write failures (HTTP 502 etc.), record HOLD with PR number; **do not retry** an uncertain POST and **do not** auto-close that PR. Continue independently checking other SHAs, then fail the sweep.
4. Fail closed on bounded page exhaustion, duplicated PR IDs or incomplete file scanning, but **continue inspecting available PRs** and conservatively post failure for affected SHAs when status access allows. For an incomplete global PR scan, suppress positive statuses. Do not automatically close PRs based only on infrastructure incompleteness. Keep the original BLS classifier and head-SHA safeguards unchanged.
5. Extend the synthetic, network-mocked enforcer tests to 15 scenarios including status-read outage, unrelated PR, uncovered EIA, ambiguous 502, >400 files, >500 PRs, independent continuation after a failure, shared-SHA BLOCK precedence, write-on-change and original five no-exception controls.

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
- Reproduce 15 offline, no-network fixture scenarios; confirm the original five still assert that no exceptions occurred. Check failure isolation across PRs and grouped shared-SHA precedence.
- Specifically attack: malformed preview with zero relevant count; expired BLS branch still BLOCK and auto-close only after status success; ambiguous 502/no retry; >400 files and >500 open PRs refuse to claim full inspection; unrelated shared-SHA PR cannot overwrite an active BLS failure status; rule-set absence cannot be described as closed.
- Inspect automatically initiated GitHub PR CI at new exact SHA, including `validate-and-build`; distinguish CI PASS from hosted Production or release permission.
- Report P0/P1/P2 findings and residual operational risk. Leave Draft/HOLD.

## Monday Daily acceptance (separate issue #840)
Monday 16 Nov 2026 natural-source workflow, trusted author PR, exact-head required checks, protected merge, READY Production and article/index/latest.json/feed parity must be verified independently. The scheduled Daily Health workflow runs at 18:45 UTC / 20:45 Athens on that Monday. Do not dispatch paid generation to manufacture the acceptance.

## Independent Claude review disposition (17:36–17:59Z)
Claude's supplied review of initial head `58b69e32` was **PASS_WITH_QUALIFICATIONS**, with release still BLOCKED. This amended Draft targets F2 (error isolation), F4 (shared-SHA status order), F5 (test exceptions and documentation), and redundant guarded-preview status writes. The independent F3 classifier/source-provenance limitations, release-time enforcement F1, offset-pagination snapshot drift, non-atomic close read/PATCH, and status cap after historical writes remain documented risks. A **new independent delta review at the exact amended SHA** is mandatory. No production merge permitted solely by CI success.

### Stale non-Draft candidate inventory (read-only confirmation)
On 15 Nov seven old preview PRs were still non-Draft and open: #916, #1010 (BLS Employment Cost Index); #939 (BEA GDP); #1203, #1206, #1211, #1225 (Treasury auctions). They remain **owner decision pending**: do not close or convert without separate authorization. No proof of an actual stale merge was found.

### Remaining gap and recommended next architecture
Design a separate exact-SHA, real-release-time merge controller + official-source calendar checks, or a separately approved and independently tested always-required release gate. A new GitHub status that is not part of an actual enforced, non-expiring merge gate cannot protect delayed PRs, and simply adding the current optional status to main ruleset would deadlock unrelated PRs. Do not perform ruleset/permissions/org-ownership or Production changes as part of this Draft. Explicit negative tests must cover source evidence failure, clock crossing, revised official schedule, bypass/merge permissions, missed GitHub scheduler, shared SHA, offset pagination drift and crash after the check but before merge.
