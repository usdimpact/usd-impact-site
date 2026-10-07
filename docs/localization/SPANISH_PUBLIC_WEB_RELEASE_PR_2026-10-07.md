# Spanish Public Web Release PR — 2026-10-07

## Status

**BRANCH-ONLY RELEASE PREPARATION. DO NOT MERGE WITHOUT SEPARATE PUBLIC-RELEASE AUTHORIZATION.**

Base commit: `80744ee923581fc37d4d8bd3e3e31cbca043ed67`.

This branch prepares exactly five Spanish educational routes for a future public release:

- `/es/`
- `/es/start-here/`
- `/es/dollar-framework/`
- `/es/framework/dollar-transmission-chain/`
- `/es/framework/three-dial-dashboard/`

## Release controls

The route remains fail-closed through two simultaneous gates:

1. `LOCALE_POLICY.es.publicationEnabled === true`;
2. the slug must be present in the exact five-route public allowlist.

Spanish content outside that allowlist cannot become public merely by setting `status: published`.

## SEO contract

Each Spanish route is prepared with:

- self-canonical on `https://www.usd-impact.com`;
- reciprocal `hreflang="es"` and `hreflang="en"`;
- `hreflang="x-default"` pointing to the English counterpart;
- no `noindex` metadata;
- inclusion in the generated sitemap through the existing sitemap policy once the branch is released.

The corresponding five English pages receive reciprocal Spanish alternates and a visible **Español** switch. Other English pages do not receive a Spanish switch.

## Explicit non-scope

This PR does not localize or activate:

- news;
- Weekly Score;
- reports;
- Library Pass/member delivery;
- book or audiobook delivery;
- Video Library/default captions;
- account;
- checkout or payments;
- marketing email;
- auth, passkeys, entitlements;
- database behavior.

Those surfaces remain English unless separately approved.

## Required pre-merge evidence

Before any merge authorization:

- all five Spanish routes render 200 in the release Preview;
- unauthorized Spanish routes remain 404;
- canonical/hreflang are exact and reciprocal;
- sitemap contains exactly the approved Spanish public routes and no unauthorized Spanish routes;
- visible EN/ES switches resolve to exact counterparts;
- TinyFish visual QA passes;
- `validate-and-build`, Dependency Review, CodeQL and GitHub Advanced Security pass;
- English default behavior remains unchanged outside the five counterpart pages.

Until those checks pass and a separate merge authorization is given, this PR must remain unmerged.
