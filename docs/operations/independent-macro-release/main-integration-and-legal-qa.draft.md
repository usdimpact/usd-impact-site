# Independent Macro Weekly — minimal integration on protected-main baseline (DRAFT / HOLD)

**Owner priority:** release the first **independent educational** Macro Weekly as soon as it is legitimately cleared, without touching the original Score, commerce or paid market-data licensing.  
**Prepared:** 2026-10-30.  
**Working repository:** `usdimpact/usd-impact-site`.  
**Current base:** protected `main` at `eb832fac7203a6a0f2ff29c0320616114e39224f`.  
**Status:** **NO MERGE, NO VERCEL DEPLOY, NO PUBLIC ROUTE, NO INDEXING, NO PUBLICATION**.

This Draft is a **minimal current-main integration review**, **not** a merge of three older branches. It intentionally excludes their conflicting reporting schemas, unrelated web build changes, the original eight-driver Score and existing Score-derived Weekly/Monthly.

## 1. What was safely carried forward

| Change | Purpose | Release boundary |
| --- | --- | --- |
| `apps/web/src/data/independent-macro-review/weekly-2026-10-30.release-candidate.html` | Exact original English independent educational article approved in [Draft PR #1024](https://github.com/usdimpact/usd-impact-site/pull/1024). Git blob `4ce3ea62d8db328fa03739ae15e2571f5f6e99bd`. | **Source only**, no public page. Embedded `noindex`, `data-release-authorized="false"`; no scripts, analytics, forms, charts or vendor feeds. |
| `apps/web/src/pages/macro-reviews/weekly/[date].astro` | Separate proposed route `/macro-reviews/weekly/2026-10-30/`. | `getStaticPaths() { return []; }` hardcoded; no environment, user, query parameter or scheduler can emit a page. |
| [Owner decision snapshot](owner-scope-pass.snapshot.draft.json) | Explicit 2026-10-30 publisher PASS for that exact HTML and *narrow original prose/facts/issuer links* only. | **Not** a qualified foreign-law opinion, government license, claim-level prior Daily revision PASS, or public Production authorization. |
| [Five-Daily version audit snapshot](final-daily-source-audit.snapshot.draft.json) | Final published Oct 26–30 Dailies exact Git blobs; documents why the later merged Fed PR #928, not earlier intermediate PR #926, is the pinned 28 October source version. | Immutable history only, does not reissue the Dailies or create a Weekly publication receipt. |
| [Fail-closed manifest](main-integration-hold.manifest.draft.json) | Pins the exact source owner acceptance, five issuer URL links and five Daily blob hashes, current site legal/privacy configuration and all release holds. | `releaseAuthorized:false`, `publishReady:false`, `actualFirstUsdImpactPublicationTimestampUtc:null`, `0/4` eligible independent Monthlies. |
| `apps/web/scripts/test-independent-macro-main-integration-hold.mjs` | Validates historical sources/owner receipt, the disabled route, original rights exclusions, consent/legal inventory, and negative built-output exposure. | CI must fail if a public route, sitemap entry, private content in generated assets, public-agent branch Vercel deploy permission or unauthorized flag appears. |

**Not included:** original Score functions/inputs, the old `/reports/weekly/` and `/reports/monthly/`, daily publisher, market vendor observations, scheduled tasks, menu or sitemap links, new analytics, payments, DNS, auth/consent changes, and any actual deployment. The older Draft PRs #1019 and #1020 remain distinct and unmerged.

## 2. Site privacy/cookie assessment — actual `main` code, not generic advice

**Already present on protected main:**

- [English Privacy Notice](https://www.usd-impact.com/privacy/): source file `apps/web/src/pages/privacy.md` describes optional analytics, cookie inventory, consent, withdrawal and account/payment handling. This notice is **not rewritten** by this Draft.
- [Terms](https://www.usd-impact.com/terms/), [Compliance & Methodology](https://www.usd-impact.com/compliance), [Contact](https://www.usd-impact.com/contact) and the footer's **Privacy settings** button exist in the shared `BaseLayout.astro`. Their final URLs, content and actual runtime behavior need verification before a future release.
- `ConsentClient.astro` implements first-visit choice, **Reject analytics**, optional **Accept analytics**, settings review and subsequent withdrawal. `GoogleAnalyticsClient.astro` and `TelemetryClient.astro` check the first-party consent object before optional measurement. The site claims GA4 does not activate before acceptance. This is **source inspection, not an independently executed consent/cookie runtime test**.
- The current independently approved article is a self-contained HTML file without trackers or external scripts. **If directly emitted as standalone HTML, it bypasses the shared `BaseLayout` legal footer, Privacy settings and global consent components.** Do **not** treat that standalone rendering as automatically having the site's full consent/legal shell.

**Official requirements informing the final runtime QA:** [Romanian Law 506/2004 Article 4(5)](https://legislatie.just.ro/Public/DetaliiDocumentAfis/172094), the [Romanian data-protection authority's 2026 explanation](https://ans-extmail.dataprotection.ro/index.jsp?lang=en&page=Comunicat_Presa_26.06.2026), [EU ePrivacy Directive Article 5(3)](https://eur-lex.europa.eu/eli/dir/2002/58/art_5/par_3/oj/eng), and the [European Commission's business guidance](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm) distinguish consent-required storage/tracking from strictly necessary functions and call for adequate disclosures and consent/withdrawal controls. The code inventory appears directionally consistent, but a qualified reviewer and actual browser tests remain necessary; this is not a GDPR/ePrivacy certification.

**Recommended future site integration, not yet approved or built:** adapt the approved article into the existing `BaseLayout` and existing legal footer, with its required cookie/analytics controls, rather than publishing a separate standalone HTML that omits them. **Such a conversion changes presentation and possibly markup, so it requires a fresh exact-version owner editorial/layout PASS.** Keep the current approved HTML byte-for-byte unchanged until that distinct decision. No content should be duplicated or route activated just for design convenience.

## 3. Narrow issuer-facts rights and international boundaries

The existing candidate consists of **original explanatory prose**, historic official macro facts and five direct Fed/BEA/BLS official release links, plus ordinary agency names. It reproduces **no** government source passages, chart images, agency seals, commercial vendor price series, original Score regimes or licensed financial-market observations.

Relevant sources:

- [Federal Reserve Board policy](https://www.federalreserve.gov/disclaimer.htm): Board-authored content generally public domain, exclusions for third-party content, marks and endorsement.
- [BEA copyright FAQ](https://www.bea.gov/help/faq/147): generally public-domain government content and attribution.
- [BLS linking/copyright guidance](https://www.bls.gov/bls/linksite.htm): ordinary linking and public-domain BLS works with exceptions for illustrations/emblems.
- [Romania Copyright Law 8/1996 Article 9](https://legislatie.just.ro/Public/DetaliiDocument/252971): ideas, news and simple facts/data are excluded from Romanian copyright protection.
- [USAGov cross-border caution](https://www.usa.gov/government-copyright): U.S. federal public-domain status alone is not a worldwide permission to reproduce entire works.

**Already accepted:** the owner separately approved the exact candidate's editorial presentation and the narrow facts-and-links publisher use, while acknowledging international exceptions. **Not yet certified:** individual third-party exceptions, qualified Romania/EU/international distribution treatment and site privacy/cookie compliance. Existing broader source reuse registers must **stay DENIED/HOLD**, not be converted wholesale into rights grants. This independent facts-only first article should not require buying an original Score market-data license.

## 4. Current build and deployment boundary

Protected `main` has `apps/web/vercel.json` with `git.deploymentEnabled["agent/*"] === false`, so the new main-based **`agent/...` Draft branch is not eligible for automatic Vercel branch deployment**. The GitHub Actions build and tests may run, but no deployment operation or Vercel secrets are added. **Confirm the live Vercel deployment inventory remains at zero for this branch after creating the Draft PR**, and that public Production remains on its original `main` commit.

The Draft's modified package scripts only **append** tests to existing `validate:reports` and at the end of the existing `build`. This avoids bypassing original security, publishing, content, checkout, Score, localization and other validators. The negative build test scans generated assets for Draft candidate fingerprints and verifies no `/macro-reviews/weekly/2026-10-30/` output or sitemap entry is created.

**A green CI means only that the candidate was NOT published.** It does not grant rights or activate any publishing path.

## 5. Next release-stage approval plan (not authorized in this Draft)

1. **Qualified remaining exceptions/compliance:** record the specific legal and foreign-jurisdiction issues for one original English webpage, agency marks/third-party content exclusions and live privacy/cookie behavior. Do not recast the already recorded narrow owner PASS as missing.
2. **Layout option:** choose the existing `BaseLayout` or another expressly reviewed accessible layout with privacy, compliance, operator contact and consent. Any changed HTML requires a new exact-version visual/editorial PASS, while original written factual claims and source links remain pinned.
3. **Final integration PR:** create a **separately approved release-activation change** from up-to-date protected main. The proposed route must be generated only after an express publisher decision; map its exact issue coverage and **actual first public publication timestamp**, verified after publishing. Perform link, mobile, legal-footer, consent accept/reject/withdraw and anonymous route QA.
4. **Security and Release:** recheck branch protection, full CI (including CodeQL), original Score gates, provider access, Vercel Preview/Production destination, no DNS or checkout changes, rollback method. Never switch `agent/*` Vercel deployments on just for convenience.
5. **Explicit final owner action:** require a new scope-specific authorization naming the **exact final commit, intended public Vercel project, merge, indexability and Production permissions** before any release.
6. **After a real release:** record actual publication timestamp and real public URL; confirm the original Score page and its rights remain untouched. The first independent Monthly must wait for **four actually published consecutive-Friday independent Weeklies**. This draft counts as **0**.

**Stop state:** current branch/PR are Draft only. Original Score rights HOLD. Independent third-party/international legal clearance HOLD. Public Website Production untouched. Unpublished independent Weeklies 0; eligible Monthly 0/4.
