# Production Vercel private Integration credential - issue 558

## Decision

Use a private Vercel Integration as the preferred generally available credential model for the Production publication guard.

The existing Sign in with Vercel OAuth App remains dormant. Vercel documents granular OAuth App resource permissions as private beta, and the published CLI does not currently expose the documented `oauth-apps` command group. A project-scoped personal token is generally available but retains project write capability. The private Integration console exposes the narrower permissions needed by the provider today.

## Installation boundary

The Integration must be private and installed only for project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` with:

- Integration Configuration: Read;
- Deployments: Read;
- Projects: Read;
- every other API permission: None;
- no webhook selection;
- no environment-variable, deployment-check, domain, team, user, billing, log-drain, protection-bypass, Global Config or write permission.

Integration Configuration Read is an unavoidable baseline permission in Vercel's Integration form. The runtime provider does not call that API. Deployments Read covers the documented deployment and deployment-alias GET endpoints. Projects Read covers project identity reads. Project access must be reduced to the single approved project after installation.

## Runtime design

`publication-production-vercel-integration-bearer.js` loads one opaque installation access token from the Production-only sensitive environment variable `PUBLICATION_GUARD_VERCEL_INTEGRATION_ACCESS_TOKEN`.

The supplier fails closed unless it is running in the approved Vercel Production project, GitHub repository, `main` branch and a valid 40-character commit SHA. It never logs or transforms the token. It remains source-only, with `publicationAuthorized=false` and `enforcementActive=false`.

This design removes four runtime secrets and moving parts required by the unavailable OAuth App path:

- no OAuth client secret;
- no rotating refresh token;
- no dedicated database password; and
- no application AES key.

The existing dormant Supabase OAuth table, roles and migration remain unchanged. They are not reused for a different credential type and retain zero rows and `PASSWORD NULL`.

## Protected provisioning sequence

1. Re-lock the exact source head/base, required checks, Preview, current Production deployment and dormant publication state.
2. Create a private Vercel Integration owned by the USD Impact team.
3. Configure only the three read permissions above and no webhooks.
4. Install it for the USD Impact team and restrict access to project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` only.
5. Complete the one-time installation redirect and code exchange through an operator-controlled browser. Do not persist the authorization code.
6. Write the resulting access token directly to the sensitive Production environment variable. Do not place it in source, issue comments, logs, chat, or the dormant OAuth table.
7. Run a read-only rehearsal of the exact deployment and deployment-alias GET requests. Any 403, unexpected project visibility, or extra permission is a HOLD.
8. Verify publication revision remains `0`, with zero authorizations and zero admissions.
9. Activation, redeployment, authorization, admission, receipt creation, merge and public release remain separate decisions.

## Rotation and revocation

The installation token is long-lived and does not use the Sign in with Vercel refresh-token protocol. Replacement is operator-controlled: obtain a replacement through Vercel's supported Integration lifecycle, write it directly to the sensitive Production variable, verify the two required reads, and revoke or uninstall the superseded credential. If Vercel cannot provide an overlap-safe replacement, hold activation until a reviewed procedure exists.

## Verification

The source-only regression verifies the exact Production context, token bounds, non-disclosure, immutable dormant flags, exact project binding and exact permission declaration. A later live rehearsal is still required because offline tests cannot prove the installed permission map or project access.
