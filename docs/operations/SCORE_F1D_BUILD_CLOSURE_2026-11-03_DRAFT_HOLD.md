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


## Assignment 7 follow-up and guarded original-body receipt (2026-11-03; newer evidence)

**Independent Claude QA7:** Existing main-compatible #1089 blocked E/E3/F/G/H, E4/E5/E6, G2b and G3 in local exact Vercel-command builds. This was a Draft-containment PASS with conditions, not release authorization. Attack N4 demonstrated self-repinning the PR-owned build manifest along with changed source; N1b demonstrated a newly inserted Score value in an excluded News source. Focused #1090 remains Draft, superseded and unmerged.

**N3 generated runtime roots:** The scanner now rejects pre-existing .vercel, .astro, .cache and coverage directories at its initial invocation, including staged .vercel/output. node_modules, dist and .git are still ignored. A clean Astro build creates .astro, so CI deletes only generated .astro *between* successive isolated builds; the actual npm/Vercel production command does not remove untrusted output. A real Vercel Preview must verify the builder does not precreate an incompatible directory.

**Historical main body integrity:** GitHub's read-only evidence job compiled pinned original Production main d1740214f5737996f321a037efe3f2f7d21ecd64 and #1089. Exactly 16/16 report main bodies matched at SHA-256. The existing Score source baseline now embeds 16 original Production hash digests; the post-build rights guard checks those exact 13 Weekly and 3 Monthly main-body hashes and blocks tampering, removal and malformed output. Only hash digests were recorded, not report text. This remains a PR-owned baseline until F2 is independently protected.

**F2 staging, not activation:** The F1d build-input and Score source/output guards now offer an absolute --root candidate directory argument. A future protected-main checkout can therefore use its own trusted source and baseline to evaluate the PR's source files. The N4 fixture shows why the earlier trusted manifest rejects a concurrent candidate self-repin. No trusted-base required-check or ruleset has been activated. A one-maintainer policy-only bootstrap/re-pin, auditable owner bypass and strict avoidance of unrelated content within bypass PRs require an explicit owner decision. Never execute untrusted PR scripts in a privileged pull_request_target context.

**F3 custom-domain Preview evidence:** Vercel lists verified passkeys-dev.usd-impact.com as a branch-assigned custom project domain; the current alias points to a READY Preview-classified deployment. Project authentication is all_except_custom_domains. This corrects the project-wide claim that no custom-domain Preview exists, but does not prove held Score content is exposed. Unauthenticated browser evidence and a separate owner access-control decision remain necessary; do not alter passkeys, DNS or SSO in this Draft.

**Owner editorial decisions:** The News/Catalyst dynamic exclusions protect Daily publication workflows but allow new Score numeric or regime claims to be inserted into News (Claude N1b). Choose either a narrowly scoped fail-closed prohibition on actual Score values/regime calls during rights HOLD, allowing generic methodology references, or formally record acceptance of the residual risk. Separately decide whether #1088's site-wide Spanish navigation link is intended under the existing Spanish/editorial holds.

**All releases remain HOLD:** original Score Issue #155, H-15/H-16, F2 trusted checks, F3 real Preview and custom domain protection, CodeQL review, English/Spanish and media rights, Production merge, indexing, member access, commerce and customer email. Engineering receipt and QA do not grant new source rights.
