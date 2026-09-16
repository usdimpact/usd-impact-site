# Production Vercel provider-state loader — issue 558

## Status

Dormant source-only candidate for draft PR #615. This module does not activate a route, deployment, publication authorization, admission, receipt, enforcement, promotion or merge. It is not imported by Middleware or an API entrypoint.

The Production guard database revision primitive is installed. The owner previously provisioned the two Production-only reader inputs required by `publication-production-reader-database.js` (`PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_URL` and `PUBLICATION_GUARD_PRODUCTION_READER_DATABASE_CA_CERT`) using the reviewed Shared Supavisor transaction endpoint and official Supabase production CA roots. Secret values are not committed or documented here. This is recorded provisioning history, not a fresh runtime authentication/TLS test or permission to repeat setup. The September 16 ledger read confirms the installed revision primitive; no credential value was read. See the [rehearsal prerequisites](publication-rehearsal-prerequisites-558.md).

## Purpose

`publication-production-authority.js` requires an authenticated `loadProviderState()` function and rejects request headers or caller input as authority evidence. This loader supplies the provider-observation boundary without granting publication authority.

The loader is pinned to:

- repository `usdimpact/usd-impact-site`;
- Vercel project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`;
- Vercel team `team_1LuMlacGuM198mRjoID4O3Ct`;
- Production environment and `main` branch;
- the exact runtime deployment ID, immutable deployment hostname and commit SHA exposed by Vercel system variables; and
- the fixed reviewed public-alias inventory already required by the Production authority adapter.

## Credential-path disposition: retired setup is not the next step

The provider core requires a trusted server-only `loadBearerToken()` supplier and does not read a static personal Vercel token from application configuration.

**The earlier OAuth/Connect setup path is retired as a way to unblock this work.** The governing [September 16 decision](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5693790537) and current #615 release hold supersede this document's former preferred-Connect instructions. Do not create a connector, client secret, refresh token, personal token, connector ID or broader permission merely to bypass missing authenticated control-plane access.

The retained supplier code/tests and OAuth-store schema are dormant implementation history, not an approved live credential path. No module or schema is deleted by this documentation correction. The provider core remains unchanged: it receives one bearer credential per snapshot and has no token persistence or mutation capability. Any replacement or reactivation requires a separately reviewed least-privilege design and explicit approval.

An operator's connected provider metadata read is supplemental evidence; it is not an authenticated in-application `loadBearerToken()` rehearsal. Likewise, control-plane read access does not establish permission or ability to read/change/restore Deployment Protection or WAF settings.

## Authenticated provider observation

For each provider snapshot, the loader requests one bearer credential from the trusted supplier and uses that same credential only for these authenticated Vercel REST reads:

- `GET /v13/deployments/{deploymentId}?withGitRepoInfo=true&teamId=...`
- `GET /v2/deployments/{deploymentId}/aliases?teamId=...`

The provider core exposes no mutation method, does not call deploy/promote/alias/environment mutation APIs and does not accept request-provided deployment, token or alias values.

The deployment observation must prove READY Production state, exact project, exact immutable host, exact `main` commit, and exact GitHub repository. The alias observation must equal the reviewed public-alias set with no additions, removals or duplicates. Any credential-supplier error, provider error, mismatch, malformed payload, timeout or stale clock fails closed.

## Alias binding is not effective public exposure

After the two reads above, the current dormant code returns `exposure: public-approved`. It does not inspect Deployment Protection/WAF policy, resolve active versus draft firewall configuration, or verify a clean anonymous response. An assigned alias can remain in metadata while access is protected or denied. A successful metadata read therefore must not be promoted into live exposure approval.

The [hostname-exposure rehearsal plan](publication-rehearsal-prerequisites-558.md) requires separate evidence for assigned aliases, intended public hosts, protected/denied technical hosts and actual responses. Missing or contradictory effective-access evidence is a rehearsal/activation HOLD. This is a review requirement, not a claim that the current runtime implements an additional guard. The pinned alias set, return schema, bindings and runtime logic are unchanged by this documentation increment.

## Local artifact binding

The loader receives the generated `publication-render-inputs/v1` build bundle from trusted server code. It requires that bundle's `buildCommitSha` equal the Vercel runtime commit, then derives:

- `artifactSha256` = SHA-256 of the exact serialized generated render bundle;
- `entries` = canonical sorted `{path, sourceSha256}` rows for all guarded published articles; and
- `manifestSha256` = SHA-256 of the canonical entries JSON.

This prevents provider metadata for one deployment from being paired with publication inputs built for another commit. The resulting provider object is short-lived (5 seconds, bounded below the authority adapter's 15-second maximum) and is re-read by the authority adapter around the durable history revision read.

## Verification

The provider regression suite continues to use a fake Vercel provider and fake bearer supplier only. It verifies exact API paths and team scope, one credential acquisition per provider snapshot, reuse of the same bearer credential across that snapshot's deployment and alias reads, no-store/no-redirect GET requests, exact deployment/project/repository/commit binding, exact alias inventory, render-bundle and manifest hashing, ignored attacker request arguments, clock monotonicity, bounded provider/credential failures, and non-disclosure of token-bearing errors.

The retained credential-supplier regression is historical coverage of the dormant supplier contract. It does not make that retired setup path an approved next action. Neither regression performs a live provider call.

A real authenticated provider observation and effective-exposure proof remain required before live integration, using a separately reviewed path. Do not link Connect to start a rehearsal under this document. Any 403 or missing capability is a HOLD, not authority to expand permissions. The completed Preview wiring rehearsal is a different, revision-bound test; see the [route candidate record](publication-route-candidate-558.md).

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

The legacy OAuth refresh-store schema remains dormant; provisioning its password, AES key or credential row is not authorized. Do not reapply or remove its installed baseline as part of documentation cleanup. The next step is resolving the documented exposure/control prerequisites, not credential provisioning.

Keep #558 open and #615 draft/unmerged. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.
