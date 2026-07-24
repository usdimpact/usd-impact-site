# Required integrations for production access

No external integration is required to review and merge the Phase 1 quiz foundation.

Phase 2 requires two Vercel Marketplace integrations connected to the `usd-impact-site` project.

## Stripe

Install the Vercel Native Stripe integration and create a sandbox first.

Target project:

- Vercel team: `usd-impact`
- Vercel project: `usd-impact-site`
- environment: Preview/test first; Production only after end-to-end acceptance

Required production values will include a Stripe secret key, publishable key, price identifier, and webhook signing secret. Never expose secret or webhook keys through `PUBLIC_*` variables.

## Supabase

Install the Vercel Native Supabase integration and create or connect a dedicated project.

Use separate Preview and Production resources where practical. The browser may receive only the Supabase URL and publishable/anonymous key. Service-role or secret keys must remain server-only.

Before enabling the chapter gate:

1. Apply the reviewed SQL migration.
2. Confirm Row Level Security is enabled on every exposed table.
3. Test that users can read only their own attempts, access grants, and entitlements.
4. Confirm unauthenticated clients cannot write progress or entitlements directly.
5. Configure magic-link redirect URLs for production and Vercel previews.

## GitHub

The Phase 1 bundle should be applied on branch `agent/add-quiz-foundation` and opened as a draft pull request. The connected GitHub integration needs repository write access to publish that branch and PR automatically.
