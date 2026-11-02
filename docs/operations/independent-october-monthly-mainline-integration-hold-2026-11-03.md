# October 2026 independent Macro Monthly — isolated current-main integration / release HOLD

**Prepared:** 2026-11-03. **State:** DRAFT INTEGRATION ONLY — NOT A PUBLIC RELEASE CANDIDATE OR PUBLICATION AUTHORIZATION.

## Freeze points and scope
- Current Production `main` integration base: `d1740214f5737996f321a037efe3f2f7d21ecd64`. Existing public independent October 26–30 Weekly presentation, Reports featured link, and link-guard CI remain **exactly** those of this base. Do not copy the earlier Weekly files or Reports page from #1060.
- Frozen October editorial input: [Draft #1065](https://github.com/usdimpact/usd-impact-site/pull/1065) commit `2722a08a3938e28220623706d2394e4268175a60`; the October HTML blob `2dfc93c2d22d8af624c44118b128a22bea180b17` must be identical in this integration.
- Frozen local build-mode QA source: [Draft #1066](https://github.com/usdimpact/usd-impact-site/pull/1066) commit `af5a9f467e7fc49caa3e67943f0f9a98702d78ff`; [Web quality #4003](https://github.com/usdimpact/usd-impact-site/actions/runs/41540039818) **PASS** on that predecessor for both Production/default absence and Preview-only October presence, CSP/sitemap controls, with no November route.
- This new branch is cut from the *current Production head* rather than cherry-picking an old full tree. It includes only the frozen independent Monthly article, its date/helper/source tests, three explanatory source-and-approval records, a one-line sitemap prefix addition, one regression import appended to the existing independent Weekly test, the manual-only QA build-mode steps in `.github/workflows/quality.yml`, and this handoff. No original Score, Weekly/Reports business logic, Spanish interface, consent, customer or commerce code is carried.
- The owner selected all five October Monthly checklist items and repeatedly approved **continuation and Draft QA**, including a double-check and the exact #1066 manual CI. This records the owner's directional decision **without** asserting a separate rights-lawyer attestation, GitHub APPROVED review, or approval for this newly created future commit to publish.

## Publisher reuse and distribution matrix (English HTML only)
| Component/source | Evidence and use in article | Disposition for this Draft |
| --- | --- | --- |
| BLS: September employment, CPI, Q3 ECI | Direct hyperlinks to dated BLS archived releases; original explanatory paragraphs/figures; no BLS logos, copied photos or charts. BLS public-domain/link policy: https://www.bls.gov/bls/linksite.htm | **Source provenance PASS**; a responsible company release reviewer still must confirm the intended English web scope and exclusions |
| BEA: Q3 GDP advance, September personal income/outlays | Direct hyperlinks to dated issuer notices; original summaries; no BEA trademarks, embeds, datasets or charts. BEA reuse: https://www.bea.gov/help/faq/147 ; linking: https://www.bea.gov/about/policies-and-information/linking | **Source provenance PASS**, not a blanket grant for third-party material |
| Federal Reserve Board: Oct 28 FOMC release | Direct link to the original statement and exact policy vote; visible Federal Reserve Board attribution and non-endorsement. Federal Reserve website disclaimer: https://www.federalreserve.gov/disclaimer.htm | **Source provenance PASS**, no seal/logo or unrelated Fed material |
| Cross-asset data, original Score, third-party media | No market-price feeds, Score series, commercial datasets, copied PDFs, images, audio or video in the October article | **Excluded, remain HOLD**; no rights activation implied |
| AI and publishing accountability | Visible English AI-assisted-preparation note; identifies USD Impact operator KELA LEADS S.R.L. and source attribution | **Disclosure present PASS**; final operator/content decision must be documented |
| Other formats/jurisdictions | No Spanish translation, audio/video, ebook/PDF, newsletter syndication, exported datasets, member entitlements or other commercial rights are included | **NOT AUTHORIZED** by this Draft |

No external counsel signoff, itemized company rights adjudication, or all-jurisdiction license receipt was discovered in the frozen PR discussions. The user's general approval to continue this workflow should not be misrepresented as an executed legal instrument.

## Fail-closed behavior retained after current-main reconciliation
1. The English October route `/macro-reviews/monthly/2026-10/` is generated **only when `VERCEL_ENV=preview`**. Production/default builds must omit the route; November must always be absent at this checkpoint.
2. Article robots and googlebot directives remain `noindex,nofollow,noarchive,nosnippet`; sitemap excludes `/macro-reviews/monthly`. Published independent Oct 30 Weekly remains excluded from sitemap *separately*; existing unpublished Spanish locale and protected-page sitemap exclusions remain unchanged.
3. No Reports navigation/featured link, RSS, external promotion, permissions, domain changes, Vercel/Cloudflare settings or purchase/entitlement changes occur.
4. No public-release flag, index/canonical metadata or datePublished is set. The visible **2 November source audit checkpoint is not a public publication date**. Any later public release requires a separately approved exact-release-version page with an actual editorial/publication date.
5. English standalone article is script-free and has its own skip link; shared Spanish UX/privacy banner review concerns should not be auto-assigned to this page. Automated 20/20 width tests were for [different combined QA SHA](https://github.com/usdimpact/usd-impact-site/pull/1061). Neither those tests nor this branch establishes actual screen-reader certification.
6. [Spanish UI-40 #1050](https://github.com/usdimpact/usd-impact-site/pull/1050) and [combined QA #1061](https://github.com/usdimpact/usd-impact-site/pull/1061) modify `apps/web/astro.config.mjs`; do not merge one config snapshot over another. The separate four unresolved #1061 CodeQL annotations remain that PR's review responsibility and are not dismissed here.

## Mandatory verification at this new integration commit
- On the new Draft PR against `main`, record precise file-list and base commit, check current-main Weekly and Reports blob identity, and verify that new Monthly HTML blob matches #1065 byte-for-byte.
- Wait for PR-target-main Web quality, Dependency review, CodeQL, other applicable workflow checks; inspect failures rather than assuming #1066 pass transfers to this new SHA.
- For the QA-only double build, manually dispatch `Web quality` on this **new** branch with optional SHA inputs blank, and verify the **new** SHA plus both local build-mode assertions. A passing ordinary pull-request build alone does not execute manual-only steps.
- If a protected Vercel Preview is required later, verify project/team, git SHA and Vercel Authentication before any Preview deployment. There is **no deployment authority in this handoff**.
- Keep protected-browser keyboard/navigation and actual assistive-technology limitations identified, but do not block the standalone English page on unrelated Spanish app-shell changes.
- Before final public publication, obtain a **named authorized company-owner release decision** listing English HTML/web scope, source exceptions and AI disclosure, plus an exact-release-commit approval and separate explicit decisions for merge, production deployment and indexing. This Draft has no such authority.

**Final disposition:** Integrate for private QA only; preserve all public-release, original Score, Spanish, legal, domain, payment, entitlement and indexing holds. Do not merge this Draft as-is to publish October Monthly.