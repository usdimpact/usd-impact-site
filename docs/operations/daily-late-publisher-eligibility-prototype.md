# Daily late publication: review-bound candidate eligibility (Draft only, 2026-11-06)

**Status: policy prototype, NO controller and NO merge authority.** This work is independent of the already deployed no-paid afternoon candidate generator in PR #1183. It must not be enabled automatically or treated as an unattended delivery receipt.

## Required candidate evidence

Before even proposing a protected merge, a trusted controller would need all of the following independently re-read immediately before the action:

1. An original, successful first-attempt run of the exact `daily-news-late-carryforward.yml` workflow on protected `main`, with a date matching the current UTC and New York weekday. The run event may be native `schedule` or an identified Vercel-triggered `workflow_dispatch`; the event type must be reported accurately and never impersonate native scheduling.
   A successful workflow run is insufficient if its candidate-preparation job skipped or failed the actual editorial PR-creation steps. The exact original source-run job must show successful preflight, candidate creation, main-SHA verification, GitHub App minting and PR creation, without duplicate step names.
2. Exactly one open, non-Draft PR whose title, original source run ID, `automation/daily-carryforward-YYYY-MM-DD-RUNID` branch, repository, base and head SHA match the immutable run. A one-commit, one-file addition of `apps/web/src/content/news/YYYY-MM-DD.md`, without any deletions, configuration edits or source file mutations.
3. A clearly labeled `Carry-forward context` article. Every source must match a previously reviewed main-branch article ledger record, including original URL, date, title, publisher and source type. All sources must be primary, independently dated, immutable and no more than 14 days old. No BLS monthly calendar or rolling EIA pointer may replace dated evidence. At least three source-grounded highlights remain mandatory.
4. The three required checks as **genuine successful `pull_request`** runs on the exact head, not workflow_dispatch successes with matching job names. A READY Vercel Preview at that exact SHA is separately required.
5. A positive editorial review by the repository owner of that exact head SHA, with no later owner change request or dismissal. Neither synthetic generation, CI, issue label nor previous approval grants this permission.
6. A normal protected merge with unchanged main SHA, unchanged PR head, and no branch-protection override, followed by an independently verified matching SHA READY Vercel Production and the four live news outputs. A missing output is not a publication. Never claim `PUBLISHED_AUTO_ON_TIME` for an after-cutoff carry-forward.

## Technical boundary

`apps/web/scripts/daily-news-late-publish-policy.mjs` evaluates an offline snapshot and returns `eligible: false` by default. It performs **no network operations**, uses **no tokens**, has no GitHub write/merge/dispatch code and cannot promote content. The caller must explicitly provide `enabled: true` even to receive an affirmative eligibility assessment; this is not a Production activation flag. Its deterministic tests include forged check events, stale SHAs, disallowed source identities, missing owner approval, changed PR state and extra modified files.

## Remaining independent acceptance

- Validate the policy on the exact PR head with real `pull_request` Web quality, Dependency review, migration guard and CodeQL; verify READY Preview.
- Test with sanitized real late-candidate receipts after a naturally scheduled missing-edition day. Do not manufacture a real missing edition or delete a published article to exercise the fallback.
- Review whether the owner wants unattended **merging after an explicit exact-head editorial approval**, rather than the existing manual protected merge. That is a separate production authority decision; this Draft does not grant it.
- Keep incident #840 OPEN until a genuine normal generator and trusted publisher or a separately defined equivalent natural acceptance path has actually run end-to-end and all required public receipts exist.

Do not change rights, payments, secrets, rulesets, database policies or unrelated release gates.
