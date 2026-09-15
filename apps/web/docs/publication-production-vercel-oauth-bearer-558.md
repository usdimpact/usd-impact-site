# Production Vercel OAuth bearer supplier — issue 558

## Status

Dormant source-only credential-lifecycle candidate for draft PR #559. This module does not register or install a Vercel App, create an OAuth client, store credentials, redeploy Production, import into a live route, authorize/admit/record a publication, change aliases/protection, promote, or merge.

It is designed only to satisfy the trusted `loadBearerToken()` seam required by `publication-production-vercel-provider.js` once a separately approved fine-grained Vercel App installation and durable credential store exist.

## Least-privilege installation contract

The intended Vercel App installation remains pinned to:

- project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7` only;
- permission `read:project`;
- permission `read:deployment`;
- no write/deploy/promote/alias/environment/protection permissions.

Vercel documents `vercel oauth-apps install` with repeatable `--permission` flags and project restriction through `--projects`. Vercel also documents the provider observations used by the publication guard as authenticated reads.

The deployment-alias endpoint (`GET /v2/deployments/{id}/aliases`) is documented as an authenticated deployment-owned read, but the public documentation inspected for this increment does not enumerate its OAuth-App permission mapping. No additional permission is added by assumption. The later live read-only rehearsal must prove that this endpoint succeeds under exactly `read:project` + `read:deployment`. A 403 or permission mismatch is a hold condition; do not broaden the installation automatically.

## Refresh-token lifecycle

Vercel documents the OAuth token endpoint as accepting `grant_type=refresh_token` and returning a new access-token / refresh-token pair. The supplier therefore treats refresh-token rotation as durable security state rather than a disposable response field.

The supplier requires three trusted server-only callbacks:

- `loadClientCredentials()` -> `{ clientId, clientSecret }`;
- `loadRefreshCredential()` -> `{ token, version }`;
- `replaceRefreshCredential({ expectedVersion, nextToken })` -> `{ stored: true, version }`.

The `version` is an opaque compare-and-swap revision. If Vercel returns a different refresh token, the rotated token must be durably persisted with the expected prior version before the new access token is accepted. A persistence error or stale/invalid acknowledgement fails closed as `HOLD_PRODUCTION_VERCEL_OAUTH_ROTATION`. After a rotated-token persistence failure, the supplier blocks further refresh attempts in that process so it cannot knowingly reuse a potentially invalidated old refresh token.

This source increment deliberately does **not** choose or create the durable refresh-token store. That storage adapter is a separate protected boundary because it will require secret-write capability. No Vercel environment variable or database secret row is created here.

## Access-token acquisition and validation

The supplier:

1. loads trusted client and refresh credentials;
2. POSTs form-encoded refresh material only to `https://api.vercel.com/login/oauth/token`;
3. validates a bounded 200 JSON response, Bearer token type, opaque access/refresh credentials, and a 1-minute to 2-hour token lifetime;
4. persists refresh-token rotation before accepting the access token;
5. POSTs the access token to Vercel's documented token-introspection endpoint;
6. requires `active=true`, the expected OAuth `client_id`, Bearer token type, and a bounded future expiry;
7. caches the access token only until the earlier of exchange/introspection expiry, with a 2-minute refresh skew.

Each HTTP request is POST-only, `no-store`, redirect-disabled, time-bounded, and response-size-bounded. Provider/network/client/store errors collapse to bounded policy codes; secret-bearing provider or callback errors are never surfaced.

Concurrent callers share one in-process refresh promise, reducing duplicate refresh/rotation races. Cross-instance serialization must be provided by the future durable store's compare-and-swap semantics; a stale rotation acknowledgement fails closed.

## Integration boundary

`publication-production-vercel-oauth-bearer.js` exposes `loadBearerToken()` but is not imported by Middleware, an API route, or the Production authority composition. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.

The provider core continues to acquire exactly one bearer credential per provider snapshot and uses it only for its deployment and deployment-alias GET observations.

## Offline verification

`test-publication-production-vercel-oauth-bearer.mjs` uses only fake OAuth/provider/store callbacks. It verifies:

- exact project and intended read-only installation permissions;
- exact token and introspection endpoints;
- form-encoded POST, no-store, redirect-disabled requests;
- refresh-token exchange and access-token introspection;
- OAuth client binding and active/expiry checks;
- compare-and-swap rotation persistence before bearer acceptance;
- failure-closed behavior on rotation persistence errors;
- in-process single-flight refresh;
- access-token cache reuse;
- malformed/expired/oversized-equivalent policy bounds;
- client/refresh credential validation;
- clock rollback handling; and
- non-disclosure of secret-bearing callback/network errors.

The test uses no live Vercel credential and does not prove the alias endpoint's exact OAuth-App permission mapping.

## Still protected / held

The following remain separate protected actions:

- registering the Vercel App / OAuth client;
- installing it on project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- granting any permissions, even the intended `read:project` + `read:deployment` pair;
- creating or storing a client secret, authorization code, refresh token or access token;
- selecting/creating the durable compare-and-swap refresh-token store;
- importing this supplier into a live route or Production authority composition;
- Production redeploy/promotion;
- live provider rehearsal;
- alias/domain/protection changes;
- publication authorization/admission/receipt/witness creation; and
- merge of PR #559.

Keep #558 open and #559 draft/unmerged.
