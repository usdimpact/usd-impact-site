# Production publication authority candidate — issue 558

## Status

Source-only, dormant candidate for draft PR #559. It does not activate Production routing, create credentials, apply SQL, authorize a release, prepare an admission, record a receipt, promote a deployment, or change Vercel/Supabase configuration. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.

## Purpose

The read-only Production audit identified two prerequisites before a serving policy can consume durable history safely:

1. the least-privilege reader needs a way to discover the current `history_state.revision` without receiving direct table access;
2. a trusted server-only authority adapter must bind the current Production deployment and exact publication manifest to that revision without trusting request headers or user input.

This increment prepares both contracts but installs neither one in Production.

## Current-revision primitive

`docs/sql/publication-production-reader-revision-contract-558.sql` is a reviewed SQL candidate, not a migration. It adds one zero-argument `SECURITY DEFINER` function owned by `fx558_reader_owner`:

`publication_guard_api.read_current_revision() -> text`

The function reads only the singleton history revision. Execution is granted only through `fx558_reader`, which is inherited by `fx558_reader_login`. It does not grant the runtime login direct `SELECT` on `publication_guard.history_state`, and it grants no controller, recorder or revoker capability. PUBLIC, `anon`, `authenticated` and `service_role` execution remain revoked. Temporary ownership-transfer membership to the managed `postgres` role is removed in the same contract.

The SQL deliberately fails if the required private schemas/roles/owner privileges are missing, if the function already exists, if the runtime login has direct table access, or if temporary owner membership is already present. Applying this candidate to the live Production guard still requires a separately generated Supabase migration and separate owner approval.

## Production reader contract

`publication-production-reader-database.js` now treats `read_current_revision()` as a required reader privilege in addition to `read_snapshot(text,jsonb)`. Identity verification still rejects every reviewed write privilege. The adapter exposes `readCurrentRevision()` and validates that the returned value is a bounded non-negative decimal revision. Missing SQL, privilege drift, authentication failure, malformed revision, wrong project/branch/repository or non-Production runtime all fail closed.

Merely adding the source method does not make the existing Production database compatible: until the separately approved SQL migration is installed, live identity verification would fail because `read_current_revision()` is absent. No credential currently exists, so the candidate remains inert.

## Trusted Production authority adapter

`publication-production-authority.js` is not imported by Middleware or any API route. A future protected server integration must inject both:

- `loadProviderState()`: an authenticated provider observation, not request data; and
- the verified least-privilege Production reader.

The provider observation is required to bind the exact repository/project/team, Git source, Production target, immutable deployment ID/host, main-branch commit, artifact SHA-256, complete canonical publication manifest, and the full approved public-alias set. The manifest hash is recomputed locally. Missing/extra aliases, deployment or commit mismatch, malformed hashes, stale evidence, provider drift or unsupported runtime identity hold the authority.

The adapter explicitly ignores caller/request arguments. Host, X-Forwarded-Host and arbitrary headers cannot create `public-approved` exposure. Public exposure must come from the future authenticated provider adapter. The adapter reads the current durable history revision only through the least-privilege reader and returns the existing `publication-serving-authority/v1` shape expected by the serving policy. It also exposes a bounded `readHistory()` bridge using the same reader.

The provider state is read on both sides of the revision read and its immutable binding must remain identical. The higher-level serving policy still performs its own authority reread around the history snapshot, so a revision advance or provider change during inspection fails closed rather than silently widening a ticket.

## Fixed public alias set in this candidate

The currently verified Production alias inventory is pinned as:

- `www.usd-impact.com`
- `usd-impact.com`
- `usd-impact-site.vercel.app`
- `usd-impact-site-usd-impact.vercel.app`
- `usd-impact-site-git-main-usd-impact.vercel.app`

Any alias addition/removal requires an explicit source review before this authority candidate can accept it. The immutable deployment hostname is separately bound through `VERCEL_URL` and the provider observation; it is not silently promoted into the approved alias set.

## Verification

Offline regressions cover:

- isolated PostgreSQL creation/ownership/grants for the revision primitive;
- no direct table read by `fx558_reader_login`;
- no execution by PUBLIC-facing Supabase roles;
- revision changes reflected exactly;
- temporary ownership-transfer membership removed;
- Production reader identity requiring both revision and snapshot read privileges while rejecting write privileges;
- exact Production runtime/deployment/commit binding;
- manifest digest validation;
- exact public-alias inventory;
- stale/expired provider evidence;
- provider binding drift;
- malformed/current revision handling;
- reader privilege drift; and
- proof that forged request host/header input is not consumed by the authority adapter.

These tests use an embedded PostgreSQL fixture and fake provider/reader adapters only. They are not live provider, live Supabase, public-origin, cache, promotion, rollback or witness evidence.

## Still protected / not authorized

The following remain separate approval boundaries:

- generate and review a real Supabase migration from the SQL candidate;
- apply it to Production;
- mint/rotate the Production reader password;
- configure Production Vercel database URL/CA variables;
- implement the authenticated Vercel provider-state loader;
- wire the Production authority/reader into Middleware or `/api/publication-guard`;
- stage or promote a Production deployment;
- change Deployment Checks, Force Promote controls, Rolling Release, domains or aliases;
- create release authorizations/admissions or first-public-response receipts;
- merge PR #559.

Keep #558 open and #559 draft/unmerged until those controls and the end-to-end witness/cutover tests are independently verified.
