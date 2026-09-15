# Production Vercel Connect bearer supplier - issue 558

## Status

Dormant source-only credential candidate for draft PR #615, retaining the existing `publication-production-vercel-oauth-bearer.js` filename only to avoid expanding the governed path set during the refresh.

The earlier custom Vercel App client-secret + refresh-token design is retired before activation. No Vercel OAuth App, client secret, refresh token, AES key, store password or encrypted credential row was ever provisioned for that path.

The preferred credential boundary is now Vercel Connect using the deployment's own project OIDC identity. This module is still not imported by Middleware, an API route, or the Production authority composition. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.

## Why Vercel Connect

Current Vercel Connect provides a project/environment-linked credential broker. A Vercel deployment proves its identity with `VERCEL_OIDC_TOKEN`, Connect checks whether that project/environment may use the connector, and returns a short-lived provider token. The token request may carry provider scopes and resource restrictions.

This removes the blocked bootstrap machinery from the preferred design:

- no application-managed OAuth client secret;
- no application-managed refresh token;
- no authorization-code callback utility;
- no AES key for refresh-token encryption;
- no runtime password for the dormant OAuth-store login;
- no encrypted refresh-token row; and
- no durable provider access token.

The already-applied Supabase OAuth-store schema remains dormant, empty and privilege-isolated. It is not dropped or repurposed because doing so would be an unrelated Production database mutation.

## Exact runtime contract

The supplier accepts only the existing exact Production context:

- Vercel project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- Vercel team `team_1LuMlacGuM198mRjoID4O3Ct`;
- GitHub repository `usdimpact/usd-impact-site`;
- branch `main`;
- Vercel Production environment; and
- a valid immutable Git commit SHA.

The only new operator-controlled value is non-secret `PUBLICATION_GUARD_VERCEL_CONNECTOR_ID`, restricted to a Vercel Connect connector ID (`scl_...`). The supplier reads Vercel's system-provided `VERCEL_OIDC_TOKEN`; it does not accept a personal access token, OAuth client secret or refresh token.

## Least privilege

Every Connect token request is pinned to:

- subject `{ type: "app" }`;
- provider scope `read:deployment`;
- provider scope `read:project`;
- the connector linked to project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`; and
- the Production environment only.

The provider core still uses the returned bearer only for:

- `GET /v13/deployments/{deploymentId}?withGitRepoInfo=true&teamId=...`; and
- `GET /v2/deployments/{deploymentId}/aliases?teamId=...`.

The deployment-alias endpoint's effective scope behavior must still be proven by one live read-only rehearsal. A 403 remains a HOLD; it is not authority to broaden scopes.

## Token handling

The supplier POSTs only to Vercel Connect's token endpoint for the configured connector, with:

- `Authorization: Bearer <VERCEL_OIDC_TOKEN>`;
- JSON body requesting the two reviewed read scopes;
- redirect disabled;
- cache disabled;
- a 3-second timeout; and
- bounded response size.

It accepts only a bounded opaque provider token with a future expiry between one minute and two hours. The token is cached in process only until a two-minute refresh skew. Concurrent callers share one in-process acquisition promise. No provider token is written to Postgres, Vercel environment variables, GitHub, logs or source.

All provider/network/credential failures collapse to bounded HOLD codes; secret-bearing underlying errors are never surfaced.

## Legacy path disabled

Compatibility exports remain so the already-reviewed module path does not break downstream source checks, but the old client-credential loader fails closed as `HOLD_PRODUCTION_VERCEL_CONNECT_LEGACY_OAUTH_DISABLED`.

The dormant Supabase store adapter and migration remain as historical, privilege-isolated scaffolding only. They are not required by the preferred Connect path and must not be provisioned unless a separate future design explicitly revives them.

## Offline verification

`test-publication-production-vercel-oauth-bearer.mjs` now verifies:

- exact project/repository/branch/Production context;
- exact connector-ID and system OIDC requirements;
- exact `read:deployment` + `read:project` token request;
- POST-only, JSON, no-store, redirect-disabled and time-bounded broker calls;
- one broker request across concurrent callers;
- short-lived token expiry validation and process-only cache reuse;
- context, connector, OIDC, broker and clock fail-closed behavior;
- non-disclosure of OIDC/provider tokens in errors; and
- explicit rejection of the legacy client-secret loader.

The test uses only a fake Connect broker. It creates no live connector and does not prove the alias endpoint's real permission mapping.

## Next protected boundary

After this source-only change passes the complete exact-head gate, the only credential/provider setup needed for this seam is:

1. create or select the Vercel Connect **Vercel** connector in the Vercel dashboard;
2. authorize it under the USD Impact Vercel team;
3. link it only to project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` and Production;
4. constrain the provider grant/token request to `read:project` + `read:deployment`;
5. record only the non-secret connector ID as `PUBLICATION_GUARD_VERCEL_CONNECTOR_ID`; and
6. run one read-only provider rehearsal.

Importing this supplier into live Production authority composition, route activation, redeployment/promotion, publication authorization/admission/receipt/witness creation, and merge remain separate protected actions.

Keep #558 open and #615 draft/unmerged.
