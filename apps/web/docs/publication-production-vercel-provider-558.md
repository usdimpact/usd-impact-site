# Production Vercel provider-state loader — issue 558

## Status

Dormant source-only candidate for draft PR #559. This module does not activate a route, deployment, publication authorization, admission, receipt, enforcement, promotion or merge. It is not imported by Middleware or an API entrypoint.

The Production guard database revision primitive is installed. The owner has manually provisioned the two Production-only reader inputs required by `publication-production-reader-database.js` (`PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_URL` and `PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT`) using the reviewed Shared Supavisor transaction endpoint and official Supabase production CA roots. No redeploy was performed as part of that provider configuration step. Secret values are not committed or documented here.

## Purpose

`publication-production-authority.js` already requires an authenticated `loadProviderState()` function and rejects request headers or caller input as authority evidence. This loader supplies that missing provider observation without granting publication authority.

The loader is pinned to:

- repository `usdimpact/usd-impact-site`;
- Vercel project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- Vercel team `team_1LuMlacGuM198mRjoID4O3Ct`;
- Production environment and `main` branch;
- the exact runtime deployment ID, immutable deployment hostname and commit SHA exposed by Vercel system variables; and
- the fixed reviewed public-alias inventory already required by the Production authority adapter.

## Authenticated provider observation

The loader requires a future Production-only secret named `PUBLICATION_GUARD_VERCEL_PROVIDER_TOKEN`. It uses that token only as a Bearer credential for read-only Vercel REST requests:

- `GET /v13/deployments/{deploymentId}?withGitRepoInfo=true&teamId=...`
- `GET /v2/deployments/{deploymentId}/aliases?teamId=...`

Vercel documents both endpoints as authenticated ownership-scoped reads. The loader does not expose a provider mutation method, does not call promote/deploy/alias mutation APIs and does not accept request-provided deployment or alias values.

The deployment observation must prove READY Production state, exact project, exact immutable host, exact `main` commit, and exact GitHub repository. The alias observation must equal the reviewed public-alias set with no additions, removals or duplicates. Any provider error, mismatch, malformed payload, timeout or stale clock fails closed.

## Local artifact binding

The loader also receives the generated `publication-render-inputs/v1` build bundle from trusted server code. It requires that bundle's `buildCommitSha` to equal the Vercel runtime commit, then derives:

- `artifactSha256` = SHA-256 of the exact serialized generated render bundle;
- `entries` = canonical sorted `{path, sourceSha256}` rows for all guarded published articles; and
- `manifestSha256` = SHA-256 of the canonical entries JSON.

This prevents provider metadata for one deployment from being paired with publication inputs built for another commit. The resulting provider object is short-lived (5 seconds, bounded below the authority adapter's 15-second maximum) and is re-read by the authority adapter around the durable history revision read.

## Verification

The offline regression suite uses a fake Vercel provider only. It verifies exact API paths and team scope, Bearer authentication, no-store/no-redirect reads, exact deployment/project/repository/commit binding, exact alias inventory, render-bundle and manifest hashing, ignored attacker request arguments, clock monotonicity, bounded provider failures, and non-disclosure of token-bearing provider errors.

The test does not use a live Vercel token and does not prove Production runtime connectivity. A live read-only provider rehearsal remains a separate protected step after a scoped provider token is created and stored.

## Still protected / held

The following are not activated by this source increment:

- creation or storage of `PUBLICATION_GUARD_VERCEL_PROVIDER_TOKEN`;
- importing the provider loader or Production reader into any live API/Middleware route;
- Production redeploy or promotion;
- route/public-alias/domain/protection changes;
- release authorization, admission, receipt or witness creation;
- merge of PR #559.

Keep #558 open and #559 draft/unmerged. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.
