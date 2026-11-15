# USD Impact — Main-compatible held security integration, Draft only

Date: 2026-11-03. **No Production release authority. Do not merge, deploy, index, activate original Score rights, or modify branch protection.**

## Exact input provenance
- Protected Production main: `d1740214f5737996f321a037efe3f2f7d21ecd64`; its Git tree `866d6c9f62ed6bc180bf5d9827a4c7fac2dfdc9d`. This integration commit has **one parent: main**; it does not rewrite the 3 newer protected-main commits after security's merge base.
- Stacked security head: [#1087](https://github.com/usdimpact/usd-impact-site/pull/1087) `e062d12221350881d3c976deda7a5b213c3e0365`, 40 paths different from main and 59 commits ahead / 3 behind. It incorporates earlier F1, F1b, F1c, Chrome DevTools and held-route regression work.
- **Explicit approved Monthly override:** [#1078](https://github.com/usdimpact/usd-impact-site/pull/1078) `76ba6a4d7db75a5368553c7441aa3b0f2d73f4f7`. This supplies EXACTLY the new branded October Monthly Astro `35afff7c29034678b0040259639930aa7a4136be` and its matching test `e75c7a71b57828c8946a7a2b9e6f61cb1a1f4571`. Never replace these with older security-lineage versions or silently discard approved focus CSS/tabindex, source wording, site fonts, noindex and Score-exclusion.
- All 40 file paths are copied by immutable Git blob identity from those two exact heads. No production Daily/Weekly/Reports files, `src/content/weekly-reports`, `src/content/monthly-reports`, Supabase migrations, Vercel configuration, domain, payments, or media binaries changed.
- The resulting combined branch is **a compatibility experiment**, not final UI-40/editorial integration. Newer [#1072](https://github.com/usdimpact/usd-impact-site/pull/1072) 10-film metadata corrections, [#1067](https://github.com/usdimpact/usd-impact-site/pull/1067) Spanish English-source labels, [#1071](https://github.com/usdimpact/usd-impact-site/pull/1071) consent/keyboard and [#1075](https://github.com/usdimpact/usd-impact-site/pull/1075) compiled accessible QA remain independent Drafts; conflicts require separate validated integration before any release.

## Security boundaries and acceptance

1. Run **native main-target pull_request** `validate-and-build`, `Dependency review`, `Reject Development-only Production migration files`, plus CodeQL and isolated held-release workflows at exact candidate head/merge ref. Check expected contexts independently, not merely aggregate workflow green.
2. The F1c full `content.config.ts` Git-blob lock `dc34afdf430a074d4118d55a4f7001564d7bcc2c` must remain unchanged. Any revised content collection config is a HOLD until owner security review. Test adversarial loader aliases, comments, nested Score files, new newsletter JSON and sitemap dates against real filesystem/build output.
3. Verify Production-classified build contains **no** `/es/news`, `/es/score`, `/es/reports`, `/es/video-library` or `/macro-reviews/monthly/2026-10` pages; Preview-classified generated pages are **strict noindex/no-canonical and omitted from sitemap**. Existing published October independent Weekly remains unchanged.
4. F2 persists: the Draft check/workflow **executes PR-controlled code** and is **not** required by protected main. This integration is not trusted-base certification. Bootstrap trusted policy on main and independent enforcement under a separate owner-approved stage, with single-maintainer deadlock analysis before CODEOWNERS/ruleset changes.
5. F3 persists: legacy Vercel `all_except_custom_domains`; the `passkeys-dev.usd-impact.com` custom-domain branch is older and held-page-free, but host access protection needs owner-verified anonymous test. **Do not change global Vercel Authentication**, which protects a public Production site.
6. All original CodeQL parent [#1061](https://github.com/usdimpact/usd-impact-site/pull/1061) four annotations remain OPEN pending integrated scanner evidence and formal disposition; **do not dismiss automatically**.
7. Independent Monthly #1078 still lacks authenticated visual/actual screen-reader clearance, final editorial/publisher-rights/legal/AI signoff and separate public exact-SHA authorization. UI-40 remains 0/51 formal human Spanish film editorial verdicts; Film23 content PASS ≠ voice/provider/distribution rights.
8. No live hosting deployment is authorized by this Draft. `agent/*` remains disabled for remote Vercel deploy in existing config. Observe actual Vercel after CI.

## Exact selected Git blobs

- `.github/workflows/draft-chrome-codeql-recheck.yml` — `a768beef2720e29f292609aacf3669f6666c6391`
- `.github/workflows/held-release-boundary-negative.yml` — `8a4b99a0530af70bcd877b6b42cee651b5f39766`
- `.github/workflows/qa-cdp-loopback-security.yml` — `ee03aab611da2fcb096cc6cc50246dfea0577b5a`
- `.github/workflows/quality.yml` — `5c9c6ac202433e5c1a74353bc46c974606ec0e3b`
- `apps/web/astro.config.mjs` — `4c0313a910f85402af9e0421048cac1d0e328b4e`
- `apps/web/scripts/held-release-boundary.mjs` — `92945f693d73913d436065be3a6e30553ee94ba7`
- `apps/web/scripts/held-release-ci-plan.mjs` — `026aeefe695161978005ed23f1ee8b7db5ee883f`
- `apps/web/scripts/qa-chrome-debug-endpoint.mjs` — `2885627ed006ce1956bc9926762bab7a0084328e`
- `apps/web/scripts/qa-october-monthly-responsive.mjs` — `9706b99c9aa0a481ecdb429522bfc3e65c653348`
- `apps/web/scripts/qa-spanish-preview-responsive.mjs` — `29ded33eef11c6943b1e2853c022f3108d743215`
- `apps/web/scripts/score-held-report-source-baseline.json` — `724f9c73be8f3241e54e411697ac34556d06cc1f`
- `apps/web/scripts/score-held-report-source-guard.mjs` — `d8bee6889ecd952c92c3fac4e3764f5315e35c96`
- `apps/web/scripts/test-held-release-boundary.mjs` — `f8adf1e0751ed4a669a2b54a0526f11c5eed2be6`
- `apps/web/scripts/test-held-release-ci-plan.mjs` — `9a17911a029b749ae17381cf25535d0a47bd444e`
- `apps/web/scripts/test-independent-macro-free-weekly-release.mjs` — `3eaf0610e8562b879abd437b87fd25437f7fe103`
- `apps/web/scripts/test-independent-macro-monthly-preview.mjs` — `e75c7a71b57828c8946a7a2b9e6f61cb1a1f4571` (**#1078 selected**)
- `apps/web/scripts/test-localization-policy.mjs` — `aed92766923edb60c7f6c95a9b5eef8ee8d2a0d0`
- `apps/web/scripts/test-qa-chrome-debug-endpoint.mjs` — `582cb7c798375c29c3433deb846c292af96a9440`
- `apps/web/scripts/test-score-held-report-source-guard.mjs` — `d6c9e84345d39d1c0da024c87e74664e62efee03`
- `apps/web/scripts/verify-canonical-build.mjs` — `500bce4295fdd5327ce8f9ed5de1769ab912853f`
- `apps/web/src/data/es-video-catalog-draft.js` — `8e20bf504d8564b646193161ffc3af06df3a6c54`
- `apps/web/src/layouts/BaseLayout.astro` — `8ee30ea1e7d0718959d894b8d775f8b8513356d9`
- `apps/web/src/lib/independent-calendar-month.js` — `25706f82568f09efb7473e324ecdf625c9cb302b`
- `apps/web/src/lib/site-navigation.js` — `fc9b9fe088eca6e8c83869c7c9ccdd87815a1d6e`
- `apps/web/src/lib/spanish-public-review-policy.js` — `02acddb9ddc35fbf6c68a90e46a6994820353c9e`
- `apps/web/src/pages/es/[section].astro` — `ef09a8b95955d448280b682914fae23c6d068337`
- `apps/web/src/pages/macro-reviews/monthly/[period]/index.astro` — `35afff7c29034678b0040259639930aa7a4136be` (**#1078 selected**)
- `docs/localization/EN_ES_SHELL_AND_FUNDRAISING_MODE_CONTRACT_2026-11-01.md` — `28c764bd4acfffa0951f0d90745b7df4fb376e99`
- `docs/localization/ES_PUBLIC_DESTINATIONS_DRAFT_REVIEW_2026-11-01.md` — `6f8ee7314aee5d6ef913f8b4d4885d1bdc0500d2`
- `docs/localization/ES_VIDEO_51_SOURCE_PAIRED_EDITORIAL_REVIEW_2026-11-02.md` — `dd8546833c094af03da113e1d5119a9c2e88403f`
- `docs/localization/drafts/DAILY_2026-10-30_ES_CANDIDATE_2026-11-02.md` — `5c68925be45988289e3c21a4f3f6ff2226c58b83`
- `docs/localization/drafts/WEEKLY_2026-10-23_ES_CANDIDATE_2026-11-02.md` — `1249a4f1f3538cfde52143a9510257f6bf04aa9d`
- `docs/localization/drafts/WEEKLY_DOLLAR_REGIME_CHECKLIST_ES_CANDIDATE_2026-11-02.md` — `f19993953b9c2d89eeeb9643f83eff32b107c9b2`
- `docs/operations/CLAUDE_SECURITY_F1_REMEDIATION_2026-11-03.md` — `314917bd3a051033ff7be140f14606deb5cdef26`
- `docs/operations/CLAUDE_SECURITY_HANDOFF_2026-11-03.md` — `6b42295dfc03055fa2f4fbce91001006f219d9ca`
- `docs/operations/SCORE_F1C_CONFIG_FREEZE_2026-11-03_DRAFT_HOLD.md` — `2bcff8cf747a2055cbf9b81e2ed8754dfd76984c`
- `docs/operations/claude-security-release-boundary-hold-2026-11-03.md` — `286d5bfcad6471c3b63efaf5932744371b7de44a`
- `docs/operations/independent-calendar-monthly-october-2026-source-and-reuse-audit.md` — `13d823e6ba035ca6f961e7af319c317efbb9d415`
- `docs/operations/independent-calendar-monthly-owner-direction-2026-11-02.md` — `344862f0672bd7b9da5c822cdcecdd811bd6a1b7`
- `docs/operations/october-monthly-spanish-combined-draft-qa-2026-11-02.md` — `ba82852a5c9186a794649577aaad310c0151beeb`

### Final decision
**HOLD** until independent exact-head review, main-compatible CI success, trusted F2 check design/enforcement, F3 host ownership decision, full editorial/accessibility/rights gates and owner-specific release authorization. A green Draft is not permission to merge.
