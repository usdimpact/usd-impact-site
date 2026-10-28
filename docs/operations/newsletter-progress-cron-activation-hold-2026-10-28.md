# Weekly Newsletter / Learning Progress — scheduled-activation HOLD guard

**Prepared:** 2026-10-28
**Scope:** Issue [#620](https://github.com/usdimpact/usd-impact-site/issues/620), Development-only test and CI trigger. **Not an activation decision.**

## Current source and provider preflight (read only)

- Protected website main at preflight: \`995ad4f44ded6a52caaed5103f4e4d228f3b29e7\`. Vercel Production reported READY on the matching website main.
- \`apps/web/vercel.json\` has five current cron entries: two for **Daily Learning** (different from Learning Progress inactivity email), one each for account-deletion finalizer, commerce reconciliation and daily news. No Weekly Newsletter or Learning Progress delivery cron was observed.
- The canonical \`/email/unsubscribe\` route maps to the purpose-specific marketing-email unsubscribe handler, with \`private, no-store\`, \`noindex, nofollow\`, and \`no-referrer\`. The canonical Resend webhook still maps to its signed callback handler.
- Resend sending domain is verified, with open/click tracking disabled. One canonical delivery-event webhook is enabled; the older duplicate is disabled. Its 20 latest event deliveries showed success at inspection.
- Production Supabase aggregate SELECT: 1 book-availability grant, 1 Weekly grant and 1 Weekly withdrawal event; historical outbox totals are 4. These event counts do **not** verify currently eligible recipients, email sending authorization, or current effective flag values.
- Vercel environment-variable **names and targets** were inspected with \`decrypt=false\`. Encrypted values were not read; source-only and metadata-only checks **cannot attest that current Production flags are OFF**.

## New negative CI contract

The already-existing \`test-weekly-newsletter-canary.mjs\` now checks the committed Vercel cron inventory and resolves same-origin rewrite aliases. It fails if a cron directly or indirectly targets a Weekly Newsletter, Learning Progress, marketing opt-in, or non-Daily-Learning waitlist action. Synthetic forbidden direct and aliased cron configurations demonstrate that the guard detects regressions. It also pins purpose-specific unsubscribe routing/privacy headers and rejects explicit Production email capability toggles set to literal \`true\` in committed \`vercel.json\`.

The already-existing \`weekly-newsletter-canary.yml\` workflow now runs when \`apps/web/vercel.json\` changes, in addition to the pre-existing canary-sensitive file triggers. The Web quality workflow continues to run for Draft PRs. Neither workflow sends email, mutates customer data, nor enables any environment setting.

**Limits:** Static source coverage is not proof of live Vercel flags, Resend send eligibility, a particular OAuth/session flow, callback reconciliation of each event category, or live provider behavior. A future approved scheduler/activation change must be explicitly authorized and update this fail-closed contract under its separate release process.

## Release disposition

**HOLD:** No new email job, feature flag, token, contact list, webhook, Resend automation, database write, customer entitlement, Production deployment, Score release, or Research authorization is part of this PR. Issue #620 remains open for separately approved Production activation/canary verification.
