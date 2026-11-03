# USD Impact — UI-36 / N1b dynamic News/Catalyst rights policy and F2 independent check
**Status:** DRAFT / private engineering review only — **all public release holds remain active**  
**Session:** 2026-11-03  
**Repository baseline:** protected `main` `d1740214f5737996f321a037efe3f2f7d21ecd64`  
**Related:** [Draft F1d #1089](https://github.com/usdimpact/usd-impact-site/pull/1089), [Daily 2026-11-03 #1092](https://github.com/usdimpact/usd-impact-site/pull/1092), [Original Score rights Issue #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155)

## 1. The N1b problem

The F1d 775-input freeze intentionally exempts `apps/web/src/content/news/` and `apps/web/src/content/catalyst-briefs/` so Daily News and time-sensitive official releases can continue without editing a giant manifest. This is **not a licence to re-publish original or component-derived Score values** in these exempt files. Claude QA7 found that a new original Score numeric/regime claim can be inserted without changing any frozen F1d file. The main-body hash receipt for the existing 16 historical Weekly/Monthly reports does not detect that different destination.

Source format matters:
- News `marketRegime` is a descriptive editorial field; it does not automatically mean a newly calculated original Weekly Score.
- Catalyst `impactScore` is the existing importance ranking (1–5), **not** the original Weekly Score. Blocking these keys would break unrelated, legitimate publishing.
- Treasury, Fed, BLS, BEA, EIA and other independently verified/licensed source facts can include numbers. The number itself is not a rights violation.
- General explanation of the 3-dials methodology and instructions to calculate an **independent** score from licensed, time-aligned inputs should remain permitted.
- Direct original-Score component/derived data paths and affirmative original Score value or regime claims should remain on HOLD until source-specific distribution rights and approval exist.

## 2. Recommended owner editorial rule — not yet activated

**Proposed option A (preferred for review):** While original Score Issue #155 is HOLD, do not publish affirmative original USD Impact Weekly Score numbers, component-derived Score regimes or direct held-artifact links in newly added or materially edited News/Catalyst content. Permit generic educational references to the framework, sourced macro releases, catalyst importance, and independently reconstructed methodology using provider-licensed data **without representing them as licensed original Score outputs**.

Owner must record the exact intended definition of “original Score claim,” allowed independent/third-party scores, citations/rights receipt obligations, and whether a negative statement quoting a held Score number is permitted. The reviewer must assess context, not only text patterns.

**Alternative option B:** Explicitly accept N1b residual risk with a named owner, expiry/reassessment date and retained original Score/publication HOLD. Neither option is implied by prior F1d engineering approvals.

## 3. What this Draft implements

- `.github/scripts/n1b-held-score-dynamic-review.mjs`: read-only comparison of exact pinned main `apps/web` and candidate `apps/web` Markdown **as data**, not executed code. Checks new/modified documents only. Rejects unsafe symlinks, unexpected files, malformed UTF-8 and inaccessible directories. Flags **high-confidence** original Score values/regimes, Three Dials numeric readings and known protected component-derived data links. Emits manual-review notices for ambiguous numeric references.
- `.github/scripts/test-n1b-held-score-dynamic-review.mjs`: positive and negative fixtures for the separation described above, including Unicode normalization and path safety.
- `.github/workflows/n1b-held-score-news-review.yml`: isolated, read-only CI demonstration. Checks the classifier against the pinned protected-main source and the **existing Nov 3 Daily PR #1092 exact head**; it does not mutate or merge that PR.

**Not implemented:** no changes to `apps/web/package.json`, `validate-news.mjs`, `validate-catalyst-briefs.mjs`, publication importers, News/Catalyst content, publishing Actions, original Score/rights gates, site routes, branch rulesets, Vercel settings, pricing or customer permissions. This analysis is PR-owned and **not** a required or independently trusted check. Even a clean result does not prove zero semantic Score leaks. Non-obvious paraphrases, copied figures without original labels, and independently licensed figures require actual editorial/source review.

**Pre-activation acceptance:** Independent QA must review a real recent Daily and Catalyst baseline, malicious inserted values, legitimate `impactScore`, source attribution and false positives. Specify allowed transformations and a rights ledger for any independently reconstructed score. Only after explicit owner approval should a *separate* integration wire a reviewed policy into real publication gates; do not silently impose it on live Daily.

## 4. F2 protected-base enforcement — architecture decision only

**Current risk:** F1d #1089 owns its guard code, test files, built-output body-digest baseline, workflow and future `--root` evaluator. A contributor able to edit these in a PR can re-pin changed source and self-produce a green same-PR Actions check (N4). The three existing required mainline contexts are `validate-and-build`, `Dependency review`, and `Reject Development-only Production migration files` from integration ID **15368**; none is yet an independently owned Score rights policy.

**Minimum trusted-check design proposed:**

1. Owner selects the immutable policy source maintained outside the candidate PR trust boundary — preferably a separately protected review policy repository or installed GitHub App release, or a rigorously protected default-main policy with no unreviewed same-PR evaluation changes. Record the exact policy source commit and published SHA-256; no implicit fallback to the PR's script/baseline. The policy reads PR files as **untrusted bytes**.
2. On PR open/synchronize/reopen, capture repository identity, PR number, **exact candidate head SHA**, protected target branch SHA and the approved evaluator version. Pin the initial checked state; if the PR head or protected policy changes, old success is stale and re-evaluation is mandatory.
3. Run a trusted, read-only evaluator on that exact candidate source tree in an isolated environment. **Never invoke npm, Astro, candidate shell scripts or arbitrary PR-defined workflows using write tokens/secrets**. Read only allowed directories/files, enforce symlink/type/path and size limits, and validate frozen original-Score source and 16 historical body constraints under a genuinely trusted policy.
4. Publish `USD Impact / Score Rights Trusted Policy` as a **GitHub App** Checks API check run on the exact candidate head SHA. Configure an owner-verified App integration ID distinct from the untrusted PR-owned Actions check. No custom check success should be accepted without matching repository, policy version, test evidence, head SHA and **the App identity**. Timeouts, pending, missing or inconclusive verdicts must block.
5. Independently review the proposed rule and a safe bootstrap/migration process for a solo maintainer, without enabling a self-approving CODEOWNERS pattern. Any exception must have an auditable owner decision, limited scope, dated expiry and no unrelated content changes.
6. **Only after** reviewer/owner approval and negative tests, optionally add the App-owned check to the protected `main` required ruleset, preserve its existing three check contexts, test strict exact-head behavior, and confirm legitimate Daily publishing still succeeds. **Do not add a required context before it actually reports on every relevant PR.**

**Controls not equivalent to F2:** requiring an untrusted `pull_request` job, marking a PR-owned generated baseline as “trusted,” simply adding a second PR-owned workflow, checking only a test result instead of the exact evaluated SHA, or executing an untrusted head in `pull_request_target`/privileged `workflow_run`.

The current branch **does not** create a GitHub App, grant tokens, run a privileged workflow, update CODEOWNERS, require a check or modify any protected ruleset.

Relevant current platform security references: [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub Checks REST API](https://docs.github.com/en/rest/checks/runs), [GitHub pull_request_target security](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).

## 5. Required independent decisions and preserved workstreams

| Issue | Current disposition | Next accountable decision |
|---|---|---|
| N1b lexical claims in excluded News/Catalyst | Draft review only | Owner approves narrowly scoped option A, revises it, or formally accepts risk B |
| N1b semantic paraphrases/source rights | HOLD | Editorial+licensing clearance; no automatic classifier is comprehensive |
| F2 exact head and App-owned required check | HOLD | Owner selects protected policy/App, safe bootstrap and trusted job |
| F3 Preview custom domain `passkeys-dev.usd-impact.com` | HOLD | Read-only anonymous browser/protection evidence, no global auth toggles |
| F1d main integration | HOLD | Preserve #1088/#1089, #1078 Monthly and independent Spanish accessibility PRs; independent CodeQL and required checks after separate approval |
| Original Score Issue #155, H-15/H-16, media, commerce and indexing | HOLD | Separate documentary rights and release approvals |

No public release, automatic publishing, Production deployment, migration, membership or payment activation is authorized by this document or any CI outcome.

## 6. QA8 adversarial review clarifications (additional Draft-only scope)

The first N1b QA-only version contained false-PASS risks unrelated to F1d: it scanned only the first 4,096 characters of a Markdown line; skipped an entire \`impactScore:\` line even if a separate held Score claim followed; ignored score values placed on an immediately following line; did not normalize Spanish original Score terminology; and reported ambiguous numeric claim or document removal for manual review while returning a boolean PASS. It also needed checks for intermediate source-folder symlinks and \`.gitkeep\` symlinks.

The hardened Draft scanner examines bounded complete lines, preserves ordinary Catalyst \`impactScore\` by matching original Score labels rather than ignoring a line, recognizes selected Spanish claim labels, detects immediately adjacent Score values, and treats manual-review items and deletions as **review required** rather than PASS. It refuses source-parent symlinks. These are targeted syntactic tests, not a comprehensive semantic rights detector. Longer-distance paraphrases, externally sourced score-like numbers, model-translated text, markdown rendered from embedded scripts, and claims with omitted original labels still require a human rights reviewer.

This still does **not** activate a publication gate or bind the classifier to protected-main checks. The F2 App-owned source/policy requirement, F3 anonymous-domain verification, original Score provider rights, all H-15/H-16 and media/commerce/indexing holds are unchanged.


## 7. F2 implementation-ready trust bootstrap — independently held policy, not activated

**Last read-only ruleset receipt (2026-11-03):** [Protect main #19557112](https://github.com/usdimpact/usd-impact-site/rules/19557112) is active with strict status checks. It requires \`validate-and-build\`, \`Dependency review\`, and \`Reject Development-only Production migration files\` from integration \`15368\`. The ruleset has no independently App-owned Score-rights check. Branch-protection REST is separately integration-restricted (403), so use the ruleset receipt rather than claiming branch-protection API access.

**Security boundary to establish:** candidate repository content is untrusted, including candidate versions of this policy, workflow YAML, tests, SHA baseline and release manifest. The check-publishing identity and the policy that determines its verdict must be loaded from a separately authorized control plane. A different GitHub Actions context from the same candidate repository does not establish F2 independence.

### 7.1 Minimum viable, low-cost architecture for a solo owner

1. **Protected policy home:** standalone private policy repository (or independently deployed immutable package) dedicated to Score rights, administered separately from candidate PR review. Maintain a tagged, byte-pinned policy version, exact source tree and 16 historical full-body reference receipts. Require explicit recorded owner approval for each policy version or allow-list change; never derive the baseline from the candidate PR. Establish controls so writing to the site PR cannot edit the trusted policy release or runner configuration.
2. **GitHub App identity:** create a dedicated \`USD Impact Score Rights\` App with only the minimum installation permissions for repository metadata/content read, pull requests read and checks write, limited to the target repository. Record installation identity and numeric app integration ID from GitHub, not a guessed value. Keep the App private key in the external evaluator's secret store, not site repository secrets or workflow environment. App ownership/administrator access must not be granted to PR automation.
3. **Event source and validation:** externally receive signed GitHub \`pull_request\` webhook events (opened, synchronize, reopened, edited as appropriate). Validate HMAC with constant-time comparison, repository ID/owner/name, event type and exact PR head/target. Fetch the current head through the GitHub API after receiving the event to avoid trusting stale or caller-supplied branch names. Protect against replay and processing duplicates.
4. **Candidate acquisition:** fetch Git trees/blob bytes from GitHub at **exact head SHA** via read-only API or pinned archive. Never checkout and then run site-defined npm/Node/Astro scripts; do not execute hooks, submodules or external URLs embedded in content. Reject symlinks, oversized files, unexpected modes, path escapes, malformed UTF-8 and incomplete fetch/coverage.
5. **Evaluation:** execute the trusted pinned evaluator with the approved policy hash, frozen historical-file digest list, closed set of Score sources/aliases, and N1b review rules against candidate bytes. Always distinguish \`DENY\`, \`MANUAL_REVIEW\` and \`ALLOW\`; a machine score of \`ALLOW\` cannot assert provider licence. Source-rights receipt must include provider and licensed use, redistribution/derivatives restrictions, observation vintage and document approver when necessary.
6. **Check publication:** publish \`USD Impact / Score Rights Trusted Policy\` from the **App** to the **exact candidate SHA** using Checks API. Output a concise audit record: repository/PR IDs, head SHA, protected target SHA, policy release hash, evaluator version, evaluated paths and counts, verdict, evidence reference and timestamp. Use \`neutral\` or \`action_required\` for unresolved editorial review and \`failure\` for hard violations, never \`success\` on ambiguous cases. Refuse missing evidence, network error and policy mismatch.
7. **Race closure:** before posting success, re-fetch PR head and protected target; if either changed, mark result stale and reschedule current-head evaluation. Ensure that a later status from an old head cannot satisfy a strict required check for a new head. Re-evaluate any PR after a trusted policy update that invalidates earlier decisions.

### 7.2 Mandatory independent negative tests before enabling any required check

| Attack or scenario | Expected trusted result |
|---|---|
| N4: candidate changes both source and own evaluator/test/baseline to say PASS | **DENY** using independently pinned evaluator, even if PR-owned Actions is green |
| Edit one of 16 held historical report body outputs through template or source | **DENY** from trusted original baseline / rendered-output or immutable snapshot receipt |
| Create new disguised Score route or derived JSON/HTML | **DENY** or documented manual review based on trusted route/file coverage |
| News/Catalyst has affirmative original Score value or held component link | **DENY** irrespective of local \`impactScore\` / \`marketRegime\` |
| News/Catalyst paraphrases alleged original regime with no label | **MANUAL_REVIEW**, not automatic green |
| BLS / Treasury sourced numeric data and pure methodology language | **ALLOW** only as review-logic outcome, not independent licensing certificate |
| Candidate force-pushes after external evaluation starts | **STALE** old run and re-evaluate new exact head |
| Policy SHA changes, App permission revoked, webhook missing or evaluation times out | **NO SUCCESS**; monitoring and manual response required |
| Spoofed same-name check from ordinary Actions integration \`15368\` | **NOT ACCEPTED** as App-owned required context |
| Benign Nov 3 Daily / ordinary Catalyst importance fields | **ALLOW** after independent fixture and genuine-content comparison |

### 7.3 Activation sequence — separate explicit change control

**Stage S0 — current:** N1b/QA9 remains review-only Draft, F1d independent comparison pending; existing ruleset unchanged.

**Stage S1 — external shadow:** owner creates and secures the standalone policy source and dedicated GitHub App; evaluator runs privately without writing checks. Verify HMAC, event identity, exact-SHA evaluation, policy-hash and N4 self-repin negatives, plus source-rights ledger handling. This stage requires external setup and independently maintained secrets; cannot be completed by modifying the site repository alone.

**Stage S2 — App check in shadow:** publish a non-required App-owned check on actual PR heads, confirm identity (numeric integration ID), consistent delivery on all active PR types and valid failure/timeout outcomes. Do not use privileged \`pull_request_target\` on untrusted code.

**Stage S3 — independent acceptance:** record two separate negative-test executions and a legitimate Daily/Catalyst acceptance receipt. Ensure the 16 held historical bodies and all build outputs are covered by a genuinely trusted evaluator. Verify provenance, source terms and documented manual exceptions. Recheck F1d latest main-compatible candidate independently, without merging overlapping branches.

**Stage S4 — protected ruleset change:** only after an explicit follow-up owner authorization for the exact App integration ID and check name, add the new App-owned context to [ruleset #19557112](https://github.com/usdimpact/usd-impact-site/rules/19557112) while preserving all three existing contexts and strict matching. Record before/after JSON, exercise a malicious and benign PR, prove no freeze/deadlock and prepare reversible rollback. Owner-approved rollback must remove only the newly added App check.

**Stage S5 — independent release:** rights Issue #155, original Score, publishing routes, media, indexing, Source licences, F1d and commerce are separate gates; a green F2 check grants **none** of these rights.

**Hard stop:** do not deploy an App, touch secrets, change branch rules, grant provider rights, merge or activate publication based solely on this design. Approval to continue Draft engineering is not permission to change Production or enforcement.

### 7.4 Minimum attributable evidence record

\`\`\`json
{
  "schema": 1,
  "repo_id": "verified GitHub repository ID",
  "pr": "verified PR number",
  "head_sha": "40-hex Git commit",
  "target_base_sha": "40-hex protected target commit",
  "policy_release_sha256": "64-hex immutable policy checksum",
  "evaluator_version": "trusted release ID",
  "app_integration_id": "verified GitHub App numeric ID",
  "checked_paths": "bounded manifest digest + count",
  "historical_body_receipt": "external immutable baseline receipt ID",
  "verdict": "ALLOW | DENY | MANUAL_REVIEW | ERROR",
  "rights_receipts": "approved source references or unresolved",
  "event_id": "GitHub delivery ID",
  "created_at": "UTC time"
}
\`\`\`

Evidence without a verified external policy hash and App identity must be labeled **PR-owned review only** rather than F2.
