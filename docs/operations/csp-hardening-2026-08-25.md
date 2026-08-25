# CSP hardening — 2026-08-25

Status: validated in GitHub CI and an exact-tree Vercel Preview on PR #323; Production promotion pending.

## Design boundary

- Use Astro 7.2.6 native SHA-384 CSP hashing for the static application shell.
- Do not permit `unsafe-inline` JavaScript.
- Migrate deterministic `script is:inline` bodies into Astro's bundled script pipeline before enabling CSP.
- Allow the known external browser dependencies only: Cloudflare Turnstile for sign-in and the USD Impact pipeline Cloudflare Pages origin for score iframes.
- Keep the existing paid video-library response CSP independent and stricter.
- Enforce universal structural browser rules in Vercel response headers: no framing, no plugin/object content, same-origin base URLs.
- Keep public checkout disabled and make no commerce, lifecycle-email, entitlement, customer-data, or Supabase changes in this release.
- Disable Astro's unused Shiki syntax highlighting because the application source contains no fenced Markdown code blocks and Shiki's inline styles are incompatible with CSP.

## Validation evidence

- The temporary generator ultimately migrated all 11 deterministic inline script bodies and then removed itself from the proposed tree.
- The full application validation suite passed after CSP activation, including paid access, authentication, Supabase, video-library, Daily Cards, lifecycle fail-closed, publishing, compliance, and automation-health contracts.
- Astro built 164 pages successfully with the Shiki CSP warning eliminated.
- A permanent generated-output CSP contract now checks all 164 HTML pages, requires the intended directives and SHA-384 hashes, rejects unhashed `script is:inline` bodies and `unsafe-inline` JavaScript, and verifies the structural Vercel CSP boundary.
- The CSP output contract passed on GitHub Web Quality at head `74d8fcc82f6d0da51a798ba6649d1b2230ea614a`.
- Supply-chain evidence, passkey auth, PWA, Web Push, adaptive learning, Daily Card Telegram, and account-deletion scheduler contracts passed on that head.
- The Vercel Preview from the byte-identical application tree completed strict dependency installation, the 164-page build, CSP output verification, and production-build verification successfully.
- The available execution environment does not provide the project browser-automation CLI and the Preview is Vercel-auth protected, so no console-level browser pass is claimed. Post-Production promotion must therefore include public-route/header checks and a Vercel runtime error scan.

## Validation-history note

Early helper runs stopped before producing application changes because of temporary generator syntax/quoting defects. A later Daily Card email run also exposed a false negative in the first CSP meta-attribute parser: the parser stopped at CSP single quotes inside a double-quoted HTML attribute. The parser was corrected without weakening policy assertions, and the same production build/CSP verification then passed in Web Quality.

## Promotion gate

Production promotion requires the merged commit to produce a READY Vercel deployment, followed immediately by public homepage and security-header checks, checkout/commerce fail-closed checks, protected-media access checks, and a warning/error/fatal runtime-log scan. Any regression requires rollback rather than policy weakening.
