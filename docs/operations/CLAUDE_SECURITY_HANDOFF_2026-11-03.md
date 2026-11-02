# Claude security QA handoff — held USD Impact release boundaries
_Date: 2026-11-03 | Repository: usdimpact/usd-impact-site | Scope: Draft-only / no public release_

## Frozen release controls

- PUBLIC RELEASE HOLD stays active (Master holds H-15/H-16 and original Score rights Issue #155). No confirmed P0 exploit, but the outstanding CodeQL review annotations are not dismissed.
- Production main expected at `d1740214f5737996f321a037efe3f2f7d21ecd64`. Production Vercel deployment `dpl_7neAb2NP7GofBjtPyfAEDmzZjtGa` was READY at this SHA at last inspection.
- Original protected combined QA Preview: PR #1061, `a97b03ae3ecc80707e6847595a0ad469591a4dde`, Vercel deployment `dpl_8HY6USfmXAcBAbeZBk1aY4JDVB73`. An older 20/20 Chromium responsive run is evidence for that exact head only.
- NO merge, Production deployment, Preview deployment, custom-domain or Vercel-auth modifications, indexing changes, media changes, rights/entitlement activation or Score publication.

## Existing independent work to preserve (not copy wholesale)

1. [#1070](https://github.com/usdimpact/usd-impact-site/pull/1070): isolated Chrome CDP port/loopback WebSocket validation, head `2d2f6506e8acae2592117be3ab76deadd5f8b870`. Dedicated [Chromium QA loopback workflow PASS](https://github.com/usdimpact/usd-impact-site/actions/runs/41543642127); Supabase intake workflow PASS. Four original review annotations on #1061 remain OPEN: 4448292953, 4448292994, 4448293012, 4448293036. The warnings are associated with the unpatched parent; do not claim CodeQL scanner clearance or resolve threads until verified on an integrated exact head.
2. [#1074](https://github.com/usdimpact/usd-impact-site/pull/1074): Spanish and independent Monthly generation restrictions, noindex/canonical/sitemap negatives, exact-SHA release HOLD, and the new Score source-content freeze; head `0f5fe3801e06a70ba99a8297dd52d5eec502d9ce`. [Dual Production/Preview static-build check PASS](https://github.com/usdimpact/usd-impact-site/actions/runs/41545137528) and [Supabase migration intake PASS](https://github.com/usdimpact/usd-impact-site/actions/runs/41545137539). Seven files changed, no existing content or runtime route changed.
3. The Score hold manifest pins exactly 13 historical Weekly and 3 historical Monthly Markdown Git blob SHA-1s against Production main. The simulated four-Friday Score Monthly is *structurally valid* in the existing validator but is rejected by the new rights/source freeze. This is narrower than universal semantic detection of copied Score-derived text. Inventory is not a license and existing historic publication rights remain unresolved.
4. [#1067](https://github.com/usdimpact/usd-impact-site/pull/1067) Spanish source disclosures; [#1071](https://github.com/usdimpact/usd-impact-site/pull/1071) consent and Escape focus, [#1068](https://github.com/usdimpact/usd-impact-site/pull/1068) current-main Monthly wording and isolation, [#1069](https://github.com/usdimpact/usd-impact-site/pull/1069) skip-link focus, [#1073](https://github.com/usdimpact/usd-impact-site/pull/1073) compiled CSS focus verification, [#1072](https://github.com/usdimpact/usd-impact-site/pull/1072) film metadata. These Drafts evolve independently. Re-read exact heads before any future cross-branch integration.
5. [#1013](https://github.com/usdimpact/usd-impact-site/pull/1013) separate Macro Context route quarantine and [#1018](https://github.com/usdimpact/usd-impact-site/pull/1018) Production public route monitoring are distinct Draft safeguards, not substitutes for preventive validation.

## New Draft prepared for Claude review

- Proposed child of #1074: `agent/held-release-mandatory-check-design-20261103`.
- Problem: the `fail-closed-contract` job was filtered by changed file paths, so making it a GitHub required status on `main` would block unrelated PRs with missing status.
- Proposal: run a **single stable check on every pull_request** (and manual dispatch). An isolated fail-closed planner allows skipping the two expensive builds only for verifiably pure `docs/operations/**/*.md` changes on a trusted, exact two-parent same-repo PR merge checkout, with matching head tree. Untrusted, missing or divergent Git evidence, source changes, mixed changes, dispatch, fork and unknown event all run full Production/Preview artifact builds. The source, Score-rights, and malicious input tests ALWAYS run even on documentation-only cases. Tests include synthetic Git repositories and tampered PR contexts.
- **Do not add this as a required branch check yet.** The guard is currently stacked on the unmerged combined Spanish/Monthly Draft. The Production `main` tree does not yet include every Spanish/Monthly source module it checks. The workflow must first be integrated or refactored against actual `main`, validated there, and any status-check requirement must be an explicit separate owner governance action.
- The main protection ruleset `Protect main` (ID `19557112`) currently requires `validate-and-build`, `Dependency review`, and `Reject Development-only Production migration files`. It does NOT require `fail-closed-contract`. Don't change the ruleset during this review.

## Claude's independent security review questions

1. Verify exact current PR SHA/ancestry, source file list, source diff, no overlapping PR/head change, and actual CI log; don't borrow PASS from a prior SHA.
2. Challenge the Git diff parser and fast-route planner: malformed `--raw -z` output, two-parent merge identity, parent-order drift, ambiguous refs, unicode/control characters, symlinks/mode changes/renames, checkout/head/tree equality, rebases, fork PRs, cache and concurrent checks.
3. Attempt *falsification*: add an unauthorized `/es` route, Monthly page, sitemap entry, canonical, Score-linked report, altered held Markdown, and fabricated exact-SHA approval. Confirm fail closed and that fixtures do NOT change real content.
4. Verify the full build was not bypassed by a risky change and that the always-running status appears on both relevant and unrelated PRs after a safe integration strategy. No repository ruleset modification until reviewed.
5. Review the gap between generated HTML guards and live Vercel/custom-domain authentication and CDN/redirect protections. Previous Vercel project inspection showed SSO protection `all_except_custom_domains`; do NOT change site-wide protection blindly. A Preview `noindex` meta tag is not access control.
6. Separate Source/rights/content checks from the four original CodeQL annotations; no alert dismissal without fresh CodeQL on the patched exact-head integration.
7. Preserve rights and accessibility HOLDs: Score Issue #155, film #23 English spoken source parity, full 51-film editorial signoff, native screen-reader keyboard testing, protected Preview live cookies, and publisher/source rights.

## Acceptance and output

Provide an evidence matrix with PASS / FAIL / HOLD and exact tool links for: source/negative tests, Prod-classified build, Preview-classified build, GitHub ruleset, CodeQL, Score rights N4, Preview host isolation, and overlap. Identify false positives vs exploitable issues without escalating hypothetical risks into confirmed vulnerabilities. Recommend the smallest patch if any issue is found, in a *new Draft-only child* after reviewing overlap.

**No automatic merge, release, deployment, DNS, custom-domain, Cloudflare, Supabase, payment, original Score, rights, public indexing, or owner-approval inference.**
