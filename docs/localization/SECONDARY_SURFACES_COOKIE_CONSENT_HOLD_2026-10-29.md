# Secondary-surfaces privacy controls: Development-only fix (2026-10-29)

**Scope:** `usdimpact/usd-impact-site` website Spanish locale, including its existing Preview-only DXY article and internal legal-review routes after integration. **Not a public release.**

## Verified cause and remedy

`BaseLayout.astro` had rendered the existing `ConsentClient` **only** when `localizationManifest.locales[locale].analyticsEnabled === true`. Spanish `es` has analytics explicitly disabled, so Spanish pages did not render the consent/privacy interface or its reopening mechanism. English analytics remained correctly consent-gated.

The new change renders the **existing** first-party consent interface for both English and Spanish. English analytics and telemetry modules **remain conditional** on the manifest's analytics-enabled flag and, within each module, user consent. Spanish optional analytics remains off; no GA4 request is enabled by this change. The existing consent control stores only one host-scoped `usd_impact_consent` preference cookie (`SameSite=Lax`, `Secure` on HTTPS, max 180 days); no localStorage/sessionStorage and no domain-wide sharing.

We added an `Opciones de privacidad` button in the Spanish footer matching the existing Spanish privacy notice, and removed the now-duplicated consent component from the archived Spanish privacy-review layout (the parent BaseLayout supplies one instance).

## Important domain boundary

The consent cookie is **host-only**; a visit to `www.usd-impact.com` cannot grant consent on a `.vercel.app` Preview or on the separate `siguiendo-el-dolar` Vercel project. Each deployed hostname displays its own preferences if first-time visitors have no cookie. This is intentional and avoids cross-domain tracking.

Existing site account/payment cookies are for essential functionality and are outside the optional analytics choice. Vercel SSO/deployment protection may set its own access cookies before the site renders; this control does not replace those.

## Safe acceptance and non-overlap

- Existing `ConsentClient.astro` source and owner-approved Spanish `consent-copy.js`/privacy notice are unchanged. Do **not** update manifest's historical consent-copy blob or owner approval record.
- `test-consent-client-contract.mjs` now verifies locale-independent rendering, no duplicate review layout instance, both footer settings affordances, and analytics/telemetry gated separately.
- PR remains **DRAFT/UNMERGED** with Vercel Preview only. Do not edit DXY release allowlist, Score, Research, checkout, entitlement, email, Spanish legal status or Production.

**Mandatory manual:** after CI on this PR is green, sign into its protected Preview and visit a Spanish route with a fresh-browser session; confirm first-visit privacy banner, reject/accept/review controls, footer reopening and no analytics request in the Spanish route. Also revalidate the currently held DXY Preview when this isolated consent fix is incorporated into its Development branch. Professional privacy/legal signoff for broader publication is not implied by the technical test.
