# CSP hardening — 2026-08-25

Status: validation in progress on PR #323.

## Design boundary

- Use Astro 7.2.6 native CSP hashing for the static application shell.
- Do not permit `unsafe-inline` JavaScript.
- Migrate deterministic `script is:inline` bodies into Astro's bundled script pipeline before enabling CSP.
- Allow the known external browser dependencies only: Cloudflare Turnstile for sign-in and the USD Impact pipeline Cloudflare Pages origin for score iframes.
- Keep the existing paid video-library response CSP independent and stricter.
- Enforce universal structural browser rules in Vercel response headers: no framing, no plugin/object content, same-origin base URLs.
- Keep public checkout disabled and make no commerce, lifecycle-email, entitlement, customer-data, or Supabase changes in this release.

## Merge gate

The change may move forward only after the full application validation/build suite and an exact-head Vercel Preview pass. Browser-sensitive routes must then be checked for CSP/runtime errors before Production promotion.
