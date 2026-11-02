# Claude security handoff: held release-boundary negative checks (2026-11-03)

**DRAFT / HOLD / NO MERGE / NO DEPLOY / NO PUBLIC RELEASE.**

This child of Draft #1070 adds a test-only contract for existing held Spanish UI-40 routes and the independent October calendar Monthly. It intentionally does not alter their routing, wording, rights, Astro config, existing CI, Vercel settings or Production. The full existing release holds H-15 and H-16 remain active.

## What the tests enforce

- T1: only the six existing public Spanish paths (including Privacy) and four reviewed UI-40 Preview paths are generated; extra Spanish subpaths fail the generated-artifact scan. The four UI-40 candidates still require exact VERCEL_ENV=preview.
- T2: no independent calendar Monthly in Production; Preview permits October 2026 only. Do not confuse this with original Score-derived Monthly or the already-live independent Weekly.
- T3: Preview-only Spanish/Monthly HTML has robots noindex, no canonical, and Monthly has Googlebot noindex.
- T4: review-only Spanish, all independent Monthly, and the existing independent Weekly noindex-first route must not appear in generated sitemaps.
- T6: active original Score rights HOLD remains explicit in the existing consumer manifest and gate. Synthetic self-reported rights approval cannot authorize Score-related Spanish Reports publication.
- T7: a claimed final public release needs exact matching 40-hex commit SHAs and evidence scoped to that SHA. The HOLD evaluator returns authorized=false even for fabricated all-green approvals; unlocking held surfaces must be a separately approved future code change.

The test adds no new dependencies and runs the normal existing web build on GitHub's ephemeral runner twice (Production classification then Preview classification) to scan actual generated HTML and sitemaps. Earlier 20/20 visual QA is unrelated and cannot be reused as new exact-head accessibility proof.

## What is NOT proven

- T3/T4 live host: custom-domain Vercel Authentication, alternate rewrites, middleware 404, CDN serving, X-Robots-Tag over the network, authenticated Preview membership/role, and deployment-promotion safety require separate non-Production owner-approved host tests. A meta noindex is not access control.
- T5/T6 semantic rights: source-level checks cannot classify every possible Score-derived sentence in future publications, create provider licenses, or erase rights-sensitive text already in public git history. Actual new Score-related content requires provenance-level analysis and human/legal approval.
- T7 governance: the guard evaluates self-reported SHA evidence; it is not a cryptographic attestation, branch-protection requirement or owner authorization system. A required status check and independent final owner/legal release decision must be configured separately.
- Exact-head 20-width Chromium/accessibility, film #23 original narration parity, full 51/51 native-speaker editorial review, public distribution and derivative media rights remain distinct HOLDs.

## Overlap boundary

Reuse the existing quarantine design in #1013, public boundary monitor #1018, Monthly dual-mode checks #1066/#1068, isolated Monthly focus work #1069, Spanish source disclosure #1067, consent work #1071, film metadata #1072 and Chrome endpoint hardening #1070. Never cherry-pick an old full file over another Draft. No merge, deployment, Vercel domain, authentication, Cloudflare, Score, customer, payment, Supabase, GA4, index or rights changes are approved.

### Evidence standard

Record the exact commit and GitHub run URL for this new branch. PASS is limited to source/static-artifact safety and does not clear H-15/H-16 or authorize a public-release PR.
