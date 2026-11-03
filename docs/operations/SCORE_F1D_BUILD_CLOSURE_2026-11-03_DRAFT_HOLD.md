# USD Impact F1d — conservative build-input closure (Draft / rights HOLD)

**Scope:** isolated Draft child of main-compatible [PR #1088](https://github.com/usdimpact/usd-impact-site/pull/1088) at exact `2588ce25c61e574ad6ce84ec99a557edfcfa2cf1`. Original Score rights Issue [#155](https://github.com/usdimpact/usd-impact-pipeline/issues/155) remains unresolved. **Do not merge, deploy, index, change payments, waive rights or change GitHub/Vercel protection.**

## What Claude QA5 established

The last read-only QA5 recorded successful negative cases A–D, but demonstrated *false PASS* against the prior #1087 guard in disposable Astro builds: E/E3 alter existing-date Score HTML via a page/template or postbuild hook; F changes the Astro `srcDir`; G creates a new Score-derived page under `/archivo/semanal/[date]` rather than the two known `/reports` families. These show draft validators are not complete; **no Production exposure was established**. [Master Tracker row 205](https://docs.google.com/spreadsheets/d/1uDvVlmbqPONI6a7YWrbhQlwGt9QSn4qBtnYSx87NlcA/edit#gid=1142194642&range=A205:G205) and [Fundraising row 95](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit#gid=1446632488&range=A95:G95) are newer evidence than #1088's earlier technical PASS summary.

## Additional isolated engineering fence

1. A reviewed Git-tree-derived manifest records **775 exact build-input Git blob hashes** from #1088's current approved technical tree, with only `package.json` replaced by the new fail-closed script wiring. It includes every current nonvolatile file under `apps/web`, including all pages, layouts, Astro configuration, rendering/build scripts, templates, public assets, web API and content other than explicitly exempt live News and Catalyst Markdown.
**Deterministic font outputs:** The existing pinned `prepare-font-assets.mjs` copies six self-hosted Inter/Playfair font and OFL-license assets after dependency install. A Production-classified build generates them before a second Preview-classified build. F1d permits those six exact paths **only when their SHA-256 bytes match the existing six hashes in the pinned font preparation script**. Unexpected font paths or mismatched bytes still fail; a clean run before font generation also passes. No broad public-assets exclusion is introduced.

2. Every file in the manifest must be unchanged and present; any new file anywhere else in `apps/web` fails. Extra Astro routes, `srcDir` changes, altered existing-date templates, postbuild hooks and new source directories therefore fail **before** an Astro build starts. Special filesystem nodes, symlinks and oversized files fail. Opens use file descriptors and `O_NOFOLLOW` for regular files.
3. Only `src/content/news/` and `src/content/catalyst-briefs/` remain outside this additional freeze so ordinary Daily News and Catalyst work can continue under their existing validators. The three new F1d auditor/test/manifest files are excluded to avoid a self-referential inventory. All three are required by the new package/build and CI check. This is intentionally a conservative integration-proof freeze: a future legitimate site code change needs a separately reviewed manifest update.
4. `apps/web/package.json` now runs the closure **and existing Score rights guard in `npm run validate`**, rechecks the closure **before `npm run build`**, and runs the existing built-artifact Score guard **after build**. The unchanged Vercel `buildCommand: npm run validate && npm run build` consequently executes the hold checks, instead of relying only on a PR-owned GitHub Actions workflow.
5. The isolated test uses an actual disposable file tree, not only hardcoded path names. Positives: clean source and new News/Catalyst Markdown. Negatives: E same-date template edits, E3 new/modified build hooks, F modified Astro `srcDir` and new alternate source tree, G alternate route, file symlink, missing baseline input and tampered expected SHA. Run exact-head dual Production/Preview classified builds and native `validate-and-build` CI.

## Explicit limits — NOT a release certification

- This is a **source/input closure**, NOT a cryptographic digest of every rendered HTML/JSON byte, source-provider licence, semantic detection of Score prose copied into unrelated *allowed* News/Catalyst content, or universal safety for code run from external dependencies.
- The previous Claude E/E3/F/G actual *malicious full builds* have not been replayed in this Draft yet; the new negative tests model each attack at the filesystem/build-input boundary. Ask Claude to falsify using true malicious builds at the **exact integrated head**, including negative cases that move the output without touching a pinned source file.
- **F2 remains P1 HOLD.** These checks execute and load baselines from PR-controlled files, even when they run in Vercel. A malicious PR can edit the policy, package script and manifest together. Bootstrap *independent, protected-main-owned* security policy and an authenticated head-SHA-bound external/GitHub App check before requiring this context on `main`. Do not use secret-bearing `pull_request_target` to execute untrusted PR code. Avoid solo-maintainer CODEOWNERS approval deadlock.
- **F3 remains HOLD.** Vercel SSO legacy `all_except_custom_domains` means the user must separately establish authenticated/anonymous protection for `passkeys-dev.usd-impact.com`. Never enable global Production blocking accidentally.
- No automated scanner proves original Score publication rights. Monthly #1078 current wording/font/focus and Spanish #1072/#1067/#1071/#1075 editorial, film/voice, real assistive technology, licensing and exact release authorization are separate gates.
- Archive older security PRs **only after** future owner-approved consolidation; no ancestor is automatically release-approved.

### Independent acceptance matrix

| Test | Requirement |
| --- | --- |
| Clean exact-head source and 775-item manifest | PASS |
| E/E3/F/G disposable filesystem negatives | FAIL closed |
| `npm run validate` and `npm run build` Vercel path | invokes hold checks, fails on tamper |
| Native main-target tests + dual classified build | PASS exact SHA |
| Same-date HTML/JSON semantic derivative proof | HOLD until independent full-build abuse test |
| F2 trusted status provenance | HOLD |
| F3 custom Preview domain | HOLD |
| Original Score source rights and public content release | HOLD |
