# Spanish Privacy + Consent Review Packet — 2026-10-08

Status: **OWNER-APPROVED COPY / PREVIEW ONLY / PRIVATE HOLD / DO NOT PUBLISH YET**

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
- current Git blob SHA after owner-approved wording refinements: `75b3dcd828373330ff288ed93f0c058853829181`
- review route: `/internal/localization/spanish-privacy-review/`
- indexing: `noindex, nofollow`
- sitemap: excluded

Locale-aware consent copy:

- path: `apps/web/src/lib/consent-copy.js`
- Git blob SHA at registration: `c1ae55a3032f294c8608255ebff4d86bfbc379a2`

Localization manifest state:

- translationStatus: `verified_current`
- languageReviewStatus: `pass`
- ownerPrivacyReviewStatus: `pass`
- externalLegalReviewStatus: `not_performed`
- approvalBasis: `owner_personal_review`
- approvalDate: `2026-10-09`
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

## Language review — PASS

An internal Spanish fidelity review was completed against the pinned English source. The review confirmed the Spanish copy preserves the English meaning for:

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

## Owner privacy review — PASS

On 2026-10-09, the owner personally reviewed and approved the Spanish Privacy Notice.

This is recorded accurately as **owner approval**, not as review by external privacy counsel or a law firm.

External legal review status: **not performed**.

The owner approval covers the current Spanish draft and consent wording against the pinned English source. It does not change the underlying English privacy facts, consent version, cookie retention, legal bases, provider roles, or analytics configuration.

Two wording refinements identified during the fidelity pass were applied before recording approval:

- `funciona solo sobre red` → `opera exclusivamente a través de la red`;
- `cookie de autorización` → `cookie de validación de seguridad`.

If any current English privacy fact later changes or is found stale, correct the English source first and move the Spanish privacy record back to review-required before release.

## Release gate after owner approval

Language review and owner privacy review are now recorded PASS. External legal review was not performed.

A separate release proposal may now:

1. create the intended public Spanish privacy route, expected `/es/privacy/`;
2. update Spanish footer/privacy links;
3. carry forward the recorded language PASS and owner privacy PASS without describing them as external legal review;
4. change Spanish analytics enablement only in a separate, explicit activation step;
5. validate consent/GA4/telemetry behavior in Preview;
6. verify sitemap/canonical/hreflang behavior;
7. obtain explicit Production authorization.

No analytics activation should be bundled implicitly with translation approval.


## Approval record

Owner approval instruction received in the project conversation on 2026-10-09: **“I approve the Spanish privacy notice.”**

This approval authorizes preparation of the separate Spanish privacy publication step. It does **not** by itself authorize merging this readiness PR, publishing the route, or enabling Spanish analytics; those remain separate release actions.
