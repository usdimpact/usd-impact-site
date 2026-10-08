# Localization Manifest Contract — 2026-10-08

Status: **PHASE 1 FOUNDATION / PREVIEW ONLY / NO RELEASE AUTHORIZATION**

## Purpose

`apps/web/src/data/localization-manifest.js` is the current machine-readable localization status authority for USD Impact.

It records:

- canonical source identity;
- target locale identity;
- source and translation versions where repository checksums are available;
- translation, financial-review and language-review state;
- release state by surface;
- the current five public Spanish web counterparts;
- all 51 current Video Library Spanish caption variants;
- the current English and Spanish book authorities;
- the private Spanish audiobook production checkpoint;
- current Spanish email and knowledge-contract boundaries.

The manifest is a status contract. **Changing the manifest does not by itself authorize publication, member delivery, email activation, commerce changes, entitlement changes, database changes or a Production deployment.**

## Current checkpoint

Repository base at creation:

`6dc09ca573e8fdc39a2e583ed36b68d696b55239`

Foundation branch:

`feat/spanish-localization-foundation-v2`

Current recorded state:

- public Spanish web counterparts: **5 / 5 currently authorized routes**;
- Spanish Video Library captions: **51 / 51 provider-live, verified, non-default**;
- Spanish book Candidate 1: **verified current / private HOLD**;
- Spanish audiobook: **private production in progress / member delivery disabled**;
- Spanish marketing email: **disabled / fail-closed**;
- knowledge query contract: **`en` + `es` supported**, without asserting Spanish row population.

## Source-drift rule

For repository-backed web translations, the manifest stores the exact Git blob SHA of both the English source and Spanish counterpart.

`scripts/validate-localization-manifest.mjs` recomputes those Git blob hashes during validation.

If an English source changes without a deliberate localization review, validation fails with a `[review_required]` source-drift error.

If the Spanish counterpart changes, validation also fails until its review/version state is updated deliberately.

This creates a fail-closed source-change boundary without auto-translating or auto-publishing content.

## Video-caption rule

The Video Library manifest is intentionally explicit for all 51 current slugs.

Validation requires exact equality among:

1. the current `video-library.js` asset list;
2. the 51-film live English caption source inventory;
3. the 51 Spanish localization manifest records.

A new, removed or renamed production film therefore fails localization validation until source recovery and Spanish localization status are reviewed.

The provider state remains:

- English source track preserved;
- Spanish `es` track present;
- Spanish track non-default;
- application default remains English.

## Book authority

English upstream authority:

- Drive ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- version: `v5.95-candidate.2`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`

Spanish current candidate:

- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- edition: Spanish Edition 1.3 Candidate 1
- verified revision: `AHj4eMRlqgvFi-UjSW8mj0t1Ye347dCeqBwOD_kVcmIOxVFHDj06s01aUPtPIeh4BcsZ6KjJfeIY74CdoSU_GdK-4bUMtyclRWkyuzfSEMY`
- release state: private HOLD

Historical Spanish Edition 1.2 remains translation memory only.

## Audiobook checkpoint

The Spanish audiobook remains a separate private production stream.

Manifest checkpoint:

- branch: `feat/spanish-audiobook-pilot-foundation`
- checkpoint commit: `e440b5e19ff7524d80b993da4eba3753aa371a6e`
- approved production voice: Narrator Mateo, `es-419`
- release state: private HOLD
- member delivery: disabled

The checkpoint records that private production is in progress. It does not assert final audiobook completeness and must not be used as release authority.

Because that branch is long-lived and divergent, future member-release integration must be reconciled narrowly onto a fresh current-main branch rather than merged wholesale.

## Email and consent boundary

Spanish marketing email remains disabled.

The existing internal consent ledger remains authoritative. Locale is a delivery/content preference, not a second consent and not a second identity.

Do not create duplicate Spanish Resend contacts for an existing person.

Future Spanish email enablement requires a separate Development-first change to the existing email/outbox contracts and a separate release decision.

## Entitlement invariant

Localization must not create product-specific language entitlements.

The same Library Pass / Research entitlement model remains authoritative.

Language changes presentation and localized assets only; it must never bypass or duplicate commerce, authentication or entitlement checks.

## Relationship to earlier localization documents

Earlier Oct. 6–7 localization documents remain valid as evidence for the QA work they record.

Their **release-state statements are historical snapshots** when they conflict with the current runtime.

In particular, documents that say `LOCALE_POLICY.es.publicationEnabled === false` or that no public `/es/` pages/hreflang exist predate the approved Spanish public web release merged on 2026-10-07.

Do not rewrite historical QA evidence to make it look current. Use this manifest plus current code/runtime evidence for current status.

## Validation entrypoint

The existing localization validation command now includes the manifest gate:

`npm run validate:localization`

This checks:

- locale registry alignment;
- five public Spanish web route pairs;
- exact English/Spanish repository blob versions;
- explicit Spanish route allowlist parity;
- 51/51 video-library/source-inventory/manifest parity;
- caption QA evidence identity;
- book/audiobook hold boundaries;
- Spanish email fail-closed state;
- globally unique localization content IDs.

## Next controlled step

After this foundation passes Preview CI, the next implementation should remain isolated and should not broaden release scope automatically.

Recommended next engineering work: use the manifest as the dependency/status input for the shared locale-aware application shell and, later, Impact Control Center localization status views.

Production remains unchanged until a separate explicit release instruction.
