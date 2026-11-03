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
