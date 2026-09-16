# Production publication authority candidate — issue 558

## Status

Source-only, dormant candidate now carried by draft PR #615 (historically #559). Status reconciled September 16, 2026: the read-only revision primitive is already installed in the dedicated publication-guard Production database; the application serving integration is not active. This work does not activate Production routing, create credentials, apply SQL, authorize a release, prepare an admission, record a receipt, promote a deployment, or change Vercel/Supabase configuration. `publicationAuthorized=false` and `enforcementActive=false` remain invariant.

## Purpose

The read-only Production audit identified two prerequisites before a serving policy can consume durable history safely:

1. the least-privilege reader needs a way to discover the current `history_state.revision` without receiving direct table access;
2. a trusted server-only authority adapter must bind the current Production deployment and exact publication manifest to that revision without trusting request headers or user input.

The database primitive and the application integration are separate prerequisites. The installed primitive does not activate the dormant authority adapter or authorize publication. Use the [rehearsal prerequisites](publication-rehearsal-prerequisites-558.md) for the dated status, evidence limits and remaining approval boundaries.

## Current-revision primitive

`docs/sql/publication-production-reader-revision-contract-558.sql` remains the reviewed design reference. The corresponding repository migration is:

`supabase/migrations/20260915141933_publication_production_reader_revision_558.sql`

The September 16 read-only managed migration-ledger inspection confirms version `20260915141933`, named `publication_production_reader_revision_558`, is installed in the dedicated guard Production project. The earlier filename-generation record in run **34977115114** is preparation history, not the installed filename or an instruction to apply SQL again. The regression suite compares the executable migration statements with the reviewed design reference apart from comments and executes the migration itself against an isolated embedded PostgreSQL fixture.

The migration adds one zero-argument `SECURITY DEFINER` function owned by `fx558_reader_owner`:

`publication_guard_api.read_current_revision() -> text`

The function reads only the singleton history revision. Execution is granted only through `fx558_reader`, which is inherited by `fx558_reader_login`. It does not grant the runtime login direct `SELECT` on `publication_guard.history_state`, and it grants no controller, recorder or revoker capability. PUBLIC, `anon`, `authenticated` and `service_role` execution remain revoked.

Hosted Supabase retains inert managed membership rows from the low-privilege owner roles to `postgres` with `admin=true`, `inherit=false`, and `set=false`. That state does not give `postgres` effective runtime inheritance or `SET ROLE` capability and is already accepted by the Phase A guard migration. The revision migration therefore fails closed only if the `fx558_reader_owner` membership becomes effective (`inherit=true` or `set=true`). It temporarily grants the role for ownership transfer and revokes it afterward, requiring the final state to contain no effective membership; an inert hosted admin-only row may remain.

The migration deliberately fails if the required private schemas/roles/owner privileges are missing, if the function already exists, if the runtime login has direct table access, or if effective owner membership is unexpectedly present. **Do not reapply the installed migration.** Any future migration, repair or database change requires fresh state verification and separate explicit approval; this documentation correction changes no SQL or hosted state.

## Production reader contract

`publication-production-reader-database.js` treats `read_current_revision()` as a required reader privilege in addition to `read_snapshot(text,jsonb)`. Identity verification still rejects every reviewed write privilege. The adapter exposes `readCurrentRevision()` and validates that the returned value is a bounded non-negative decimal revision. Missing SQL, privilege drift, authentication failure, malformed revision, wrong project/branch/repository or non-Production runtime all fail closed.

The September 16 management-side catalog inspection verified the revision and snapshot primitives and the inspected least-privilege grants. Earlier provisioning of the two Production-only reader inputs is recorded in the [provider document](publication-production-vercel-provider-558.md). Neither observation proves a fresh Vercel Function connection authenticates as that reader over verified TLS. Current secret values and runtime validity were not inspected in this reconciliation. Do not repeat provisioning, retrieve secrets or rotate a password merely to satisfy obsolete runbook wording. The application integration remains dormant.

## Trusted Production authority adapter

`publication-production-authority.js` is not imported by Middleware or any API route. A future protected server integration must inject both:

- `loadProviderState()`: an authenticated provider observation, not request data; and
- the verified least-privilege Production reader.

The provider observation is required to bind the exact repository/project/team, Git source, Production target, immutable deployment ID/host, main-branch commit, artifact SHA-256, complete canonical publication manifest, and the full approved public-alias set. The manifest hash is recomputed locally. Missing/extra aliases, deployment or commit mismatch, malformed hashes, stale evidence, provider drift or unsupported runtime identity hold the authority.

The adapter explicitly ignores caller/request arguments. Host, X-Forwarded-Host and arbitrary headers cannot create `public-approved` exposure. The existing dormant provider loader is implemented, but its two REST reads verify deployment identity and assigned aliases, not effective Deployment Protection or firewall policy. The approved source-only containment now makes that metadata-only loader return `exposure: unverified` after those checks. The authority implementation is unchanged: it still requires `public-approved` and rejects this unverified result with `HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING` before reader identity, revision or snapshot calls. This removes the unsupported positive classification; it does not verify effective access or implement a new approval path. The adapter reads the current durable history revision only through the least-privilege reader and returns the existing `publication-serving-authority/v1` shape expected by the serving policy. It also exposes a bounded `readHistory()` bridge using the same reader.

The provider state is read on both sides of the revision read and its immutable binding must remain identical. The higher-level serving policy still performs its own authority reread around the history snapshot, so a revision advance or provider change during inspection fails closed rather than silently widening a ticket.

## Fixed alias inventory in this candidate

The code names this set `APPROVED_PUBLIC_ALIASES`; it is a pinned assigned-alias inventory, not independent proof of effective access. The September 16 provider observation matched:

- `www.usd-impact.com`
- `usd-impact.com`
- `usd-impact-site.vercel.app`
- `usd-impact-site-usd-impact.vercel.app`
- `usd-impact-site-git-main-usd-impact.vercel.app`

A hostname can remain assigned while protected or denied. The [rehearsal plan](publication-rehearsal-prerequisites-558.md) separates assigned, intended-public, protected and denied states without changing this code contract. Any alias addition/removal requires an explicit source review before this authority candidate can accept it. The immutable deployment hostname is separately bound through `VERCEL_URL` and the provider observation; it is not silently promoted into the approved alias set.

## Verification

Offline regressions cover:

- the committed repository migration matching the reviewed SQL design apart from comments;
- isolated PostgreSQL creation/ownership/grants by executing that migration artifact;
- hosted-style inert `postgres` membership being accepted while effective membership is rejected;
- no direct table read by `fx558_reader_login`;
- no execution by PUBLIC-facing Supabase roles;
- revision changes reflected exactly;
- no effective `postgres` membership after ownership transfer;
- fail-closed duplicate migration application;
- Production reader identity requiring both revision and snapshot read privileges while rejecting write privileges;
- exact Production runtime/deployment/commit binding;
- manifest digest validation;
- exact public-alias inventory;
- stale/expired provider evidence;
- provider binding drift;
- malformed/current revision handling;
- reader privilege drift; and
- proof that forged request host/header input is not consumed by the authority adapter.

A composition regression additionally connects the actual metadata-only loader to the unchanged authority factory with fake metadata/credential/reader adapters. Matching names, an unexpected synthetic redirect, opaque synthetic protection metadata and a self-declared approval all remain held before any reader call. Existing approved authority fixtures are explicitly synthetic component fixtures, not loader output or live access proof. A source check prevents direct imports of these dormant modules in the inspected Middleware, API entrypoints and guard boundary.

These tests use an embedded PostgreSQL fixture and fake provider/reader adapters only. They are not live provider, live Supabase, public-origin, cache, promotion, rollback or witness evidence. Separately, the September 16 managed ledger/catalog inspection establishes only the installed primitive and inspected grants; it does not exercise the runtime credential, serving, admission or witness chain.

## Still protected / not authorized

The following remain separate approval boundaries:

- change hosted migrations or database state (the revision baseline is already installed);
- mint/rotate the Production reader password or replace the previously provisioned reader inputs;
- retrieve or change Production Vercel database URL/CA values;
- implement or activate a newly reviewed provider-credential/exposure path; do not revive retired OAuth/Connect setup as a workaround;
- wire the Production authority/reader into Middleware or `/api/publication-guard`;
- stage or promote a Production deployment;
- change Deployment Checks, Force Promote controls, Rolling Release, domains or aliases;
- create release authorizations/admissions or first-public-response receipts;
- merge PR #615.

Keep #558 open and #615 draft/unmerged until those controls and the end-to-end witness/cutover tests are independently verified.
