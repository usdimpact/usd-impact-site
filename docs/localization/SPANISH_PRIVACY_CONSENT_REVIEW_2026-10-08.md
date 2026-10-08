# Spanish Privacy + Consent Review Packet — 2026-10-08

Status: **PREVIEW ONLY / PRIVATE HOLD / DO NOT MERGE OR PUBLISH**

## Purpose

This packet binds the Spanish privacy/consent draft to the current English source and defines the review gate required before any Spanish analytics activation.

It does **not** authorize:

- publication of a Spanish privacy notice;
- enabling GA4 or first-party telemetry on `/es`;
- changing consent version `v1`;
- changing cookie retention;
- adding advertising features;
- changing legal bases, provider roles, retention periods or data-rights handling;
- changing email consent, commerce, authentication, entitlement or member-delivery behavior.

## Exact source checkpoint

Production source commit:

`3314b13d04dadf97e2654ec879fb56925725cbae`

English Privacy Notice:

- path: `apps/web/src/pages/privacy.md`
- Git blob SHA: `175b230a83aaf5fd3dbbf7c087bdc8b8a965617a`

Pre-localization Consent UI snapshot:

- path: `apps/web/src/components/ConsentClient.astro`
- Git blob SHA: `d54e001173d4d5905afc041c0e050f3c80ee899e`

## Spanish review artifacts

Spanish Privacy Notice review page:

- path: `apps/web/src/pages/internal/localization/spanish-privacy-review.md`
- Git blob SHA at registration: `cc24f3273a8bff5a5c48f5994275e27259615d00`
- review route: `/internal/localization/spanish-privacy-review/`
- indexing: `noindex, nofollow`
- sitemap: excluded

Locale-aware consent copy:

- path: `apps/web/src/lib/consent-copy.js`
- Git blob SHA at registration: `c1ae55a3032f294c8608255ebff4d86bfbc379a2`

Localization manifest state:

- translationStatus: `in_progress`
- privacyLegalReviewStatus: `required_before_release`
- languageReviewStatus: `required_before_release`
- releaseStatus: `private_hold`
- Spanish analytics: `false`
- public Spanish privacy route: `null`

## Current engineering acceptance

The Preview implementation proves only readiness for human review:

- English consent behavior remains default;
- consent cookie name remains `usd_impact_consent`;
- consent version remains `v1`;
- analytics remains default-denied;
- Accept and Reject remain same-level actions;
- later withdrawal remains supported;
- Spanish copy is available in the review UI;
- Spanish `/es` still renders without ConsentClient, GA4 or first-party telemetry;
- review page itself renders the consent UI but does not load GA4 or telemetry;
- review route is noindex and excluded from the sitemap;
- source-change validation fails closed if the English privacy source changes.

## Required language review

Confirm the Spanish copy preserves the English meaning for:

1. what is collected;
2. separation of waitlist and Daily Learning consent;
3. account, commerce, learning and video-progress data;
4. Lemon Squeezy Merchant of Record role;
5. first-party telemetry exclusions;
6. GA4 categories and exclusions;
7. Google Signals / advertising-personalization disabled state;
8. cookie names and retention periods;
9. Turnstile behavior;
10. absence of localStorage/sessionStorage for consent/telemetry;
11. service-worker/notification behavior;
12. purposes of processing;
13. provider roles;
14. legal bases;
15. retention/deletion;
16. sharing/sale statement;
17. security boundaries;
18. data-subject choices and rights;
19. support contact;
20. Romanian operator identity and registered address.

Terminology that intentionally remains a product/protocol name (for example Library Pass, Daily Learning, Google Analytics 4, Cloudflare Turnstile, Supabase, Resend, Vercel and Lemon Squeezy) should not be translated into a meaning-changing substitute.

## Required privacy/legal review

A qualified reviewer should confirm, at minimum:

- the Spanish translation does not broaden or narrow the English legal meaning;
- consent wording is sufficiently clear for the target Spanish-speaking audience;
- Accept and Reject remain equally accessible;
- withdrawal wording is accurate;
- cookie/storage descriptions and retention periods remain current;
- provider disclosures remain current;
- legal-basis wording remains appropriate;
- rights wording and authority-complaint language remain appropriate;
- Romanian operator details remain current;
- no jurisdiction-specific statement has been introduced without evidence.

If any current English privacy fact is wrong or stale, correct the English source first, then regenerate/review the Spanish draft from the new source version.

## Release gate after review

Only after both language and privacy/legal review are recorded PASS should a separate release proposal:

1. create the intended public Spanish privacy route, expected `/es/privacy/`;
2. update Spanish footer/privacy links;
3. change manifest review statuses to PASS;
4. change Spanish analytics enablement only in a separate, explicit activation step;
5. validate consent/GA4/telemetry behavior in Preview;
6. verify sitemap/canonical/hreflang behavior;
7. obtain explicit Production authorization.

No analytics activation should be bundled implicitly with translation approval.
