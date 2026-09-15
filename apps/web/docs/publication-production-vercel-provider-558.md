# Production Vercel provider-state loader — issue 558

## Status

Dormant source-only candidate for draft PR #615. This module does not activate a route, deployment, publication authorization, admission, receipt, enforcement, promotion or merge. It is not imported by Middleware or an API entrypoint.

The Production guard database revision primitive is installed. The owner previously provisioned the two Production-only reader inputs required by `publication-production-reader-database.js` (`PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_URL` and `PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT`) using the reviewed Shared Supavisor transaction endpoint and official Supabase production CA roots. Secret values are not committed or documented here.

## Purpose

`publication-production-authority.js` requires an authenticated `loadProviderState()` function and rejects request headers or caller input as authority evidence. This loader supplies the provider-observation boundary without granting publication authority.

The loader is pinned to:

- repository `usdimpact/usd-impact-site`;
- Vercel project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- Vercel team `team_1LuMlacGuM198mRjoID4O3Ct`;
- Production environment and `main` branch;
- the exact runtime deployment ID, immutable deployment hostname and commit SHA exposed by Vercel system variables; and
- the fixed reviewed public-alias inventory already required by the Production authority adapter.

## Least-privilege provider credential model

The provider core requires a trusted server-only `loadBearerToken()` supplier and does not read a static personal Vercel token from application configuration.

The preferred supplier is now Vercel Connect. The Production deployment proves its identity with Vercel OIDC, the Connect service verifies the project/environment link, and it returns a short-lived provider token. The request is constrained to the two reviewed provider scopes `read:project` and `read:deployment`.

This replaces the earlier unactivated custom OAuth client-secret/refresh-token design before any credential was provisioned. The provider core itself is unchanged: it receives one bearer credential per snapshot and has no token persistence or mutation capability.

No Vercel Connect connector is created or linked by this source increment, and no connector ID or provider bearer token is stored here.

## Authenticated provider observation

For each provider snapshot, the loader requests one bearer credential from the trusted supplier and uses that same credential only for these authenticated Vercel REST reads:

- `GET /v13/deployments/{deploymentId}?withGitRepoInfo=true&teamId=...`
- `GET /v2/deployments/{deploymentId}/aliases?teamId=...`

The provider core exposes no mutation method, does not call deploy/promote/alias/environment mutation APIs and does not accept request-provided deployment, token or alias values.

The deployment observation must prove READY Production state, exact project, exact immutable host, exact `main` commit, and exact GitHub repository. The alias observation must equal the reviewed public-alias set with no additions, removals or duplicates. Any credential-supplier error, provider error, mismatch, malformed payload, timeout or stale clock fails closed.

## Local artifact binding

The loader receives the generated `publication-render-inputs/v1` build bundle from trusted server code. It requires that bundle's `buildCommitSha` equal the Vercel runtime commit, then derives:

- `artifactSha256` = SHA-256 of the exact serialized generated render bundle;
- `entries` = canonical sorted `{path, sourceSha256}` rows for all guarded published articles; and
- `manifestSha256` = SHA-256 of the canonical entries JSON.

This prevents provider metadata for one deployment from being paired with publication inputs built for another commit. The resulting provider object is short-lived (5 seconds, bounded below the authority adapter's 15-second maximum) and is re-read by the authority adapter around the durable history revision read.

## Verification

The provider regression suite continues to use a fake Vercel provider and fake bearer supplier only. It verifies exact API paths and team scope, one credential acquisition per provider snapshot, reuse of the same bearer credential across that snapshot's deployment and alias reads, no-store/no-redirect GET requests, exact deployment/project/repository/commit binding, exact alias inventory, render-bundle and manifest hashing, ignored attacker request arguments, clock monotonicity, bounded provider/credential failures, and non-disclosure of token-bearing errors.

The adjacent Connect-bearer regression separately verifies the project OIDC credential-broker request and exact reviewed scopes. Neither regression performs a live provider call.

A live read-only rehearsal remains required after a Vercel Connect connector is linked to exactly the USD Impact project and Production environment. The deployment-alias read must succeed with only the reviewed read scopes; a 403 is a HOLD, not permission-expansion authority.

## Still protected / held

The following are not activated by this source increment:

- creating or authorizing a Vercel Connect connector;
- linking a connector to the USD Impact project or Production environment;
- setting the non-secret connector ID in Production configuration;
- importing the provider loader or Connect supplier into any live API/Middleware route;
- Production redeploy or promotion;
- route/public-alias/domain/protection changes;
- release authorization, admission, receipt or witness creation; and
- merge of PR #615.

The legacy OAuth refresh-store schema remains dormant and unused; provisioning its password, AES key or credential row is no longer part of the preferred path.

Keep #558 open and #615 draft/unmerged. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.
