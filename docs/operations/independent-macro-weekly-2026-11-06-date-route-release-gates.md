# Independent Macro Weekly (2–6 November 2026): dated-article source and release gates

**Status: DRAFT / NON-SERVED ARTICLE SOURCE / NO MERGE OR PUBLICATION AUTHORITY.** Prepared 10 November 2026 as an isolated candidate for owner/editorial review. This is not a legal opinion, a human-editor signature, a Score derivative, or a public Weekly.

## Exact artifact and lineage

- Article source: `docs/operations/independent-macro-weekly-2026-11-06-dated-route-candidate.astro`. This is a **full standalone Astro page source in `docs/operations`**, so Astro **does not generate a public route**, even on Preview. Its `data-publication-state=draft-source-not-served` and introductory comment intentionally block claims of publication.
- Proposed final route **only after separately authorized release**: `apps/web/src/pages/macro-reviews/weekly/2026-11-06/index.astro`, generating `/macro-reviews/weekly/2026-11-06/`. The date identifies the **week ending Friday November 6**; actual first-publication time must be separately recorded and must not be backdated.
- The parent editorial source and five-source corrections matrix remain in current-main [Draft PR #1226](https://github.com/usdimpact/usd-impact-site/pull/1226), commit `d01517b11a9c044af9dce566721b93197c31955f`. This Draft is intentionally based directly on protected `main@bdb5bcd61d9f22df78185c942bdbdf9e8155948a`, not on another unmerged PR; do **not** merge older overlapping Drafts #1185/#1192.
- The published independent October 26–30 Weekly is an independent source-only noindex article; it is **not** an authorization for another article. The original provider-derived Score Weekly and the historical Score publication workflow remain `RIGHTS_HOLD`.

## Facts verified by machine-assisted direct issuer review (not human approval)

| Release / reference | Official issuer page | Candidate claim | Verification boundary |
| --- | --- | --- | --- |
| Nov 3 / Sept 2026 JOLTS | https://www.bls.gov/news.release/archives/jolts_11032026.htm | Openings ~7.5m; hires ~5.4m; quits ~3.4m | Counts of labor turnover, not Nov payrolls or USD moves |
| Nov 4 / Nov Treasury financing calendar | https://home.treasury.gov/news/press-releases/sb0678 | $125bn refunding offer; ~$97bn maturity refunding; ~$28bn net new cash; planned 9/10/12 Nov auctions | **Announcement, not auction results.** Nov 9 has passed by the Nov 10 editorial review |
| Nov 4 / Sept trade | https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026 | Deficit $105.0bn; exports $321.5bn; imports $426.6bn | Data reference month Sept, actual release Nov 4 |
| Nov 5 / Q3 productivity preliminary | https://www.bls.gov/news.release/archives/prod2_11052026.htm | Productivity +3.6% at a seasonally adjusted annual rate; output +3.7%; hours +0.1% | NOT an annual year-over-year growth assertion |
| Nov 6 / Oct payroll report | https://www.bls.gov/news.release/archives/empsit_11062026.htm | Nonfarm payroll +165,000, unemployment rate 4.1% | Different underlying surveys, not contemporaneous FX movement |

The candidate **excludes**: price/return observations, DXY/WTI/gold/BTC claims without synchronized rights-cleared prices; proprietary score inputs; agency imagery/logos/tables; market-action recommendations; the after-period **Nov 10 CPI** as a 2–6 Nov issuer event; Treasury auction results not independently verified.

## Human / legal / editorial release decisions — none may be inferred from CI

| Gate | Required owner/editor evidence | Status |
| --- | --- | --- |
| Completed Friday-close and correction sweep | Timestamped 6 Nov U.S. session-close assessment, original-issuer revisions and missing major release check | **HOLD** |
| After-period update | Check Nov 9/10/12 Treasury auctions and material Nov 10 CPI for a truthful as-of historical release; avoid stale future-tense claims | **HOLD** |
| Accountable editor | Identify natural/legal person, human source-by-source substantive verification and exact final article SHA approval | **HOLD** |
| AI transparency | Document appropriate EU AI Act Article 50 obligations and approved public disclosure; do not declare an exception without review | **HOLD** |
| Cross-border rights | Original paraphrases and links only; confirm publication rights/privacy policy and no imported third-party licensed feeds; record residual risks | **HOLD** |
| Privacy/consent | Validate consent and network/cookie behavior with actual browsers on article Preview; do not equate scriptless file with sitewide GDPR/ePrivacy compliance | **HOLD** |
| UX/accessibility | 320/375/768/1280px rendering, keyboard links/skip, font loads, legal/footer and links; inspect Preview on desktop/mobile | **HOLD** |
| Actual public date route, indexing and discovery | Separate exact route, noindex-first, sitemap exclusion, same-date Reports & News public entry, correct first-published UTC | **NOT AUTHORIZED** |
| Protected release and acceptance | Genuine exact-head PR checks, READY matching Preview, explicit exact-copy owner approval, protected squash merge, Production READY and domain, live positive/negative routes | **NOT AUTHORIZED** |

## Non-bypass path from candidate to an approved public edition

1. **Resolve outstanding substantive and legal gates** with a documented accountable human review of the final text. Until then no published-artifact PR should be merged. Update any stale chronology before approving an exact SHA; do not retroactively call a preview published.
2. Create a **new isolated release PR** from *then-current* protected `main`. Move/copy the exact reviewed article from `docs/operations` to `apps/web/src/pages/macro-reviews/weekly/2026-11-06/index.astro` and remove source-only staging markers. Record the actual first-publication UTC after independent live proof; coverage date alone is not publication time.
3. Keep page `robots/googlebot=noindex,nofollow,noarchive,nosnippet`, no-referrer, original educational language, AI-assisted notice and KELA LEADS S.R.L. legal/footer links, locally served fonts, no third-party page scripts or Score inputs. Add **exactly one** sitemap exclusion for the final dated route in `apps/web/astro.config.mjs`, separately from the review-only exclusion.
4. **Coordinate discoverability in the same release PR**: update the **latest independent Weekly** card in `apps/web/src/pages/reports/index.astro` and the `latestIndependentWeek` reference in `apps/web/src/pages/news/index.astro` to the identical date, without touching the historical Score-rights warnings.
5. **Do not weaken automated guards.** At present `apps/web/scripts/test-independent-weekly-current-entry.mjs` deliberately fails when a newer dated static Weekly exists without matching Reports/News entries; `apps/web/scripts/test-independent-macro-free-weekly-release.mjs --built` deliberately rejects a 2026-11-06 build before authorization. A separate owner-authorized release PR must explicitly update the latter's approved-date build contract while retaining (and extending) negative tests for the next unapproved date; no blanket date bypass.
6. Verify native `pull_request` Web Quality, CodeQL, dependency review, Production migration guard, compiled privacy/keyboard checks and a successful source/canonical/robots build. Require READY matching Vercel Preview and read-only checks of `/macro-reviews/weekly/2026-11-06/` (200) plus adjacent unpublished date (404), sitemap exclusion, no tracking before consent, correct Daily/Reports references and no licensed provider data. Build must fail closed if any gate cannot be verified.
7. After **separate specific owner approval of the exact release HEAD and final copy**, execute only the normal protected squash merge (no bypass); confirm Vercel Production READY on the resulting merge SHA and both domain aliases, verify the public route and citations, metadata/robots, mobile/keyboard/privacy and adjacent negative controls. Only then label the edition `PUBLISHED_VERIFIED` in [tracker #1129](https://github.com/usdimpact/usd-impact-site/issues/1129).
8. Do not dispatch paid generators, activate Score/Monthly, change Vercel settings/roles, modify the 11 Nov Daily acceptance automation or close [incident #840](https://github.com/usdimpact/usd-impact-site/issues/840) as part of the Weekly release.

## Expected state for THIS isolated Draft

- The complete article is a **source document**, not served from a route.
- `/macro-reviews/weekly/2026-11-06/` remains HTTP 404 in both Preview and Production.
- The existing independent 30 Oct Weekly remains latest in Reports and News; source-only Oct Monthly and original Score publication restrictions are unchanged.
- Any CI PASS on this source-only PR proves **engineering compatibility**, not substantive editorial, lawfulness, publication rights, or live presence.

**Final decision: NON-SERVED REVIEW CANDIDATE ONLY.**
