# DXY vs Broad USD ES-LATAM — Development candidate and mandatory release gates

**Date:** 2026-10-28. **Environment:** Development / Vercel Preview only. **Current release: HOLD.** Owner authorized Development integration and requested required manual steps. Full Spanish article owner editorial acceptance came from user message `please continuem approved`; this does not certify public release rights, metadata, legal compliance, or merging into Production.

## Canonical provenance

- English Production source: `apps/web/src/content/pages/dxy-vs-broad-usd.md` Git blob `3c4a3820b9cc0ddc094aa1862f738e231dc0f398`, `usdimpact/usd-impact-site/main` at `995ad4f44ded6a52caaed5103f4e4d228f3b29e7`.
- Owner-accepted private Spanish full article: `USD-Impact/enterprise-evaluation` draft [PR #3](https://github.com/USD-Impact/enterprise-evaluation/pull/3), source Git blob `46cadc998e31c6f332ce34c3cbec1f8dc758f825` and owner acceptance evidence [here](https://github.com/USD-Impact/enterprise-evaluation/blob/7931b2a8b109cf644cebdb3b540a20ee3c90ce3e/real-content-shadow/full-page-owner-acceptance.json).
- Development content: `apps/web/src/content/pages/es/dxy-vs-broad-usd.md`. Its **body** is an exact extraction of the accepted Spanish article (Git blob `4476112d6d09c4cbcbae761517af1cb5f1855842`), without the private-review banner, review-only footer, or repeated educational disclaimer. The disclaimer is moved verbatim to `complianceNote` frontmatter so the site layout renders it once.
- The Astro frontmatter was assistant-proposed (not yet owner-approved), with `status: review`. The ES slug is metadata only and **not** present in the published route allowlist.

## Development preview scope

- Vercel project `usd-impact-site` has SSO protection enabled for `*.vercel.app` Preview deployments at the time of this check. The optional visual QA route is `/internal/localization/dxy-broad-usd` and `getStaticPaths()` returns no paths unless `VERCEL_ENV === 'preview'`. The route sets `noindex=true` and uses the existing Spanish layout.
- No new publicly authorized `/es/dxy/dxy-vs-broad-usd` route is added, no reciprocal hreflang or sitemap entry is added, and no Production branch merges occur.
- The preexisting five public Spanish routes, all payments and access controls, audiobook, newsletter, Score and entitlements remain unchanged.
- CI: `npm run validate:localization` now includes `test-spanish-dxy-development-hold.mjs`, which fails if the English source drifts, approved Spanish body changes, public-route allowance expands, preview/noindex guard disappears, or metadata becomes published.

## Manual decisions strictly required BEFORE any public release

1. **Owner metadata/legal review:** Confirm the proposed Spanish title, meta description, hero, links (the quiz and other link destinations remain English), original citations, disclaimer, source-rights/attribution and suitability for LATAM readers. The previously approved Spanish *body* is not a substitute for this check. Review the Development PR, and give a dated explicit approval for these metadata and source-rights assertions if accurate. Do **not** paste private data or legal documents into chat.
2. **Preview visual QA:** Open the new Vercel Preview deployment through the GitHub PR's Vercel check or Vercel Deployments list (SSO sign-in may be required). Inspect `/internal/localization/dxy-broad-usd` on desktop and mobile. Confirm the design, compliance note, table and navigation; verify `/es/dxy/dxy-vs-broad-usd` remains a 404. If the project is not SSO-protected at the time of review, do not distribute the preview link until protection is restored.
3. **Release decision:** An explicitly approved *separate* release PR must (a) set page `status: published`, (b) add exactly the new slug to the Spanish route allowlist and `SPANISH_TO_ENGLISH_PATH`, (c) add the English-page reciprocal language switch/hreflang, (d) update `apps/web/src/data/localization-manifest.js` with reviewed source/translation Git blob hashes, (e) update the existing five-route regression assertions, and (f) run Production-targeted route 200/404, canonical, hreflang, sitemap, visual, SEO/compliance and security QA. Then receive explicit merge/release approval. None of these changes are in the current Development candidate.

## Do not mistake preview build for release

Vercel Preview may deploy automatically on the Development PR after CI. **READY** means the preview built, not that publication rights were approved. Merging this candidate into `main` would put a `status: review` content file into Production (without a public DXY route); this PR is intentionally **DRAFT and must remain unmerged** until a separately confirmed decision.

Mandatory manual actions now: review the proposed metadata and sign in to inspect the SSO Preview once CI reports ready. No new paid providers, tokens, API keys or local installation are necessary.


## Exact-head Preview build correction (2026-10-28)

The first Vercel Preview build failed safely at the canonical/sitemap verifier: the newly generated internal noindexed route was present in the Astro sitemap, but correctly had no canonical. This PR now adds **only** `/internal/localization/dxy-broad-usd` to `privatePaths` in `apps/web/astro.config.mjs` (the same exclusion mechanism used for existing internal noindex routes). The Development QA asserts that exact exclusion. This does not remove any checks for existing public canonicals, does not publish the ES page, and does not alter the five Spanish public routes. Re-run all exact-head checks and Vercel Preview after this commit.

## Separate first-party consent fix incorporated in Development QA (2026-10-29)

The owner noticed that this ES DXY Preview did not show the cookie choices present on the main English site. The independently validated [website consent PR #933](https://github.com/usdimpact/usd-impact-site/pull/933) removes the accidental `analyticsEnabled` rendering gate from `ConsentClient` and adds the `Opciones de privacidad` footer control for Spanish. This Development-only DXY branch carries exactly those consent files as a two-parent **Development merge commit** from the consent branch; it does **not** merge either PR to Production.

- A first-time visitor on this protected Vercel Preview hostname sees the same consent interface, with equal analytics Accept/Reject controls and a settings dialog. Consent preference cookies are host-only and do not transfer from `www.usd-impact.com`.
- Google Analytics and telemetry remain **OFF for Spanish pages** because their rendering continues to depend on `analyticsEnabled:false`; no tracking or entitlement changes are allowed by this merge.
- Existing published five-route Spanish allowlist, DXY `status:"review"`, `noindex` and Preview-only route stay unchanged.
- DXY-specific test gains a dedicated guard that consent is visible and GA/telemetry remain gated.
- This is a private Preview only. Owner must visually confirm the new banner in a fresh browser/hostname session. No Production merge or DXY publication has been authorized.
