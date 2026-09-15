# Production Vercel provider-state loader — issue 558

## Status

Dormant source-only candidate for draft PR #559. This module does not activate a route, deployment, publication authorization, admission, receipt, enforcement, promotion or merge. It is not imported by Middleware or an API entrypoint.

The Production guard database revision primitive is installed. The owner has manually provisioned the two Production-only reader inputs required by `publication-production-reader-database.js` (`PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_URL` and `PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT`) using the reviewed Shared Supavisor transaction endpoint and official Supabase production CA roots. No redeploy was performed as part of that provider configuration step. Secret values are not committed or documented here.

## Purpose

`publication-production-authority.js` already requires an authenticated `loadProviderState()` function and rejects request headers or caller input as authority evidence. This loader supplies the provider-observation boundary without granting publication authority.

The loader is pinned to:

- repository `usdimpact/usd-impact-site`;
- Vercel project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- Vercel team `team_1LuMlacGuM198mRjoID4O3Ct`;
- Production environment and `main` branch;
- the exact runtime deployment ID, immutable deployment hostname and commit SHA exposed by Vercel system variables; and
- the fixed reviewed public-alias inventory already required by the Production authority adapter.

## Least-privilege provider credential model

The first source candidate assumed a durable `PUBLICATION_GUARD_VERCEL_PROVIDER_TOKEN`. Before provisioning that credential, the provider model was checked against current Vercel documentation.

Vercel documents project scoping for personal/authentication tokens (`vercel tokens add --project ...`), but that token-creation interface does not expose read-only permission flags. A project-scoped personal token therefore does not satisfy this guard's least-privilege requirement merely because the provider loader itself issues only GET requests.

Vercel also documents Vercel App installation permissions that can be restricted to a project and to explicit read scopes such as `read:project` and `read:deployment`. Those app access tokens are short-lived and require a trusted token-acquisition/refresh boundary rather than a static long-lived personal token embedded in Production configuration.

For that reason, the provider core now requires a trusted server-only `loadBearerToken()` supplier. The core does not read or accept a static Vercel token environment variable. The future credential adapter must be separately reviewed and must prove that its bearer credential is restricted to this project and only the read permissions required by the two provider observations.

No Vercel App, OAuth client, refresh credential or provider bearer token is created or stored by this source increment.

## Authenticated provider observation

For each provider snapshot, the loader requests one bearer credential from the trusted supplier and uses that same credential only for these authenticated Vercel REST reads:

- `GET /v13/deployments/{deploymentId}?withGitRepoInfo=true&teamId=...`
- `GET /v2/deployments/{deploymentId}/aliases?teamId=...`

Vercel documents both endpoints as authenticated reads. The provider core exposes no mutation method, does not call deploy/promote/alias/environment mutation APIs and does not accept request-provided deployment, token or alias values.

The deployment observation must prove READY Production state, exact project, exact immutable host, exact `main` commit, and exact GitHub repository. The alias observation must equal the reviewed public-alias set with no additions, removals or duplicates. Any credential-supplier error, provider error, mismatch, malformed payload, timeout or stale clock fails closed.

## Local artifact binding

The loader also receives the generated `publication-render-inputs/v1` build bundle from trusted server code. It requires that bundle's `buildCommitSha` to equal the Vercel runtime commit, then derives:

- `artifactSha256` = SHA-256 of the exact serialized generated render bundle;
- `entries` = canonical sorted `{path, sourceSha256}` rows for all guarded published articles; and
- `manifestSha256` = SHA-256 of the canonical entries JSON.

This prevents provider metadata for one deployment from being paired with publication inputs built for another commit. The resulting provider object is short-lived (5 seconds, bounded below the authority adapter's 15-second maximum) and is re-read by the authority adapter around the durable history revision read.

## Verification

The offline regression suite uses a fake Vercel provider and fake bearer supplier only. It verifies exact API paths and team scope, one credential acquisition per provider snapshot, reuse of the same bearer credential across that snapshot's deployment and alias reads, no-store/no-redirect GET requests, exact deployment/project/repository/commit binding, exact alias inventory, render-bundle and manifest hashing, ignored attacker request arguments, clock monotonicity, bounded provider/credential failures, and non-disclosure of token-bearing errors.

It also asserts that a static environment token alone is insufficient to configure the core loader. The test does not use a live Vercel App token and does not prove Production runtime connectivity. A live read-only provider rehearsal remains a separate protected step after the fine-grained credential supplier is implemented and its project/read-only scopes are verified.

## Still protected / held

The following are not activated by this source increment:

- Vercel App/OAuth registration or installation;
- storage of an App client secret, refresh token, access token or personal token;
- implementation or deployment of the live credential-refresh supplier;
- importing the provider loader or Production reader into any live API/Middleware route;
- Production redeploy or promotion;
- route/public-alias/domain/protection changes;
- release authorization, admission, receipt or witness creation;
- merge of PR #559.

Keep #558 open and #559 draft/unmerged. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.
