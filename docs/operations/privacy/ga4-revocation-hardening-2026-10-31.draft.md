# GA4 explicit withdrawal — isolated privacy-only Draft (2026-10-31)

**Scope:** [Issue #1032](https://github.com/usdimpact/usd-impact-site/issues/1032). Proposed branch is a separate privacy-only Draft PR based exactly on protected main `eb832fac7203a6a0f2ff29c0320616114e39224f`. No unrelated site article, Macro Weekly, Score, commerce, paid access, localization, analytics endpoints, consent copy, cookie lifetime, legal footer, indexing or Production permission changes.

## Why the change is proposed

Current `GoogleAnalyticsClient.astro` loads the Google tag only after optional consent and uses `ga-disable` plus GA cookie-expiration attempts when consent is withdrawn. Official [Google consent mode guidance](https://developers.google.com/tag-platform/security/guides/consent) says `gtag('consent','update',...denied)` should be sent when a previously accepted user revokes consent.

This Draft adds that explicit state update **only if a Google tag has previously been configured**. For first-time rejection, the code still does **not** construct `window.gtag`, `window.dataLayer`, or a `gtag/js` element, avoiding an accidental switch to advanced/cookieless collection. The `ga-disable` kill switch is set before the denial update; the preexisting local GA cookie-expiration attempts still follow. Advertising storage/user data/personalization remain denied throughout.

## Tests and limits

New `test-ga4-consent-revocation.mjs` exercises the actual inline client script in Node's disconnected VM with fake DOM/cookies for **first visit denied, reject, accept, allowlisted event, revoke, denied event, and regrant**. It checks no script/dataLayer/gtag before consent, a single loaded tag after consent, denied update on revoke, ad settings always denied, cleanup attempts, event suppression, and no duplicate configuration. The existing full `validate:functions` CI chain includes the test.

**Important limitation:** this is a **simulated browser**, not proof that loaded Google code emits no network ping or that third-party cookie deletion succeeds on every browser/domain. A protected authorized live Preview and redacted DevTools Network/Cookies verification is still required **before any final Production merge**, along with a privacy notice/provider obligations review if applicable. Do not capture cookie values, authorization headers, account identifiers or analytics IDs.

**Owner-reported Production UI/DevTools PASS remains accepted**; this is defense in depth, not evidence of a current breach.

**All release controls:** Draft/unmerged; no public Production change, no original Score/source-rights grants, no paid services, no publishing, no indexing and no unrelated route changes. A separate exact-commit approval is required to merge or deploy.
