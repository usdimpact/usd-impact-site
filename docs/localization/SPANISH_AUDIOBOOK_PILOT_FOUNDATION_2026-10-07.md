# Spanish Audiobook Pilot Foundation — 2026-10-07

Status: **PILOT PREPARATION / NO MEMBER DELIVERY / NO PRODUCTION AUDIO**

## Scope

Prepare one controlled Spanish audiobook pilot for *Read the Dollar First* without changing the current English audiobook, Library Pass entitlement, Production routing, storage objects, or member delivery.

Selected pilot source:

- canonical content ID: `read-the-dollar-first:chapter-3`
- English chapter identity: `chapter-3-usd-is-not-dxy`
- Spanish title: **Capítulo 3 — USD no es DXY**
- source locale: `en`
- pilot locale: `es`
- Spanish authority: Google Drive document `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- authority title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- verified source revision: `AHj4eMRlqgvFi-UjSW8mj0t1Ye347dCeqBwOD_kVcmIOxVFHDj06s01aUPtPIeh4BcsZ6KjJfeIY74CdoSU_GdK-4bUMtyclRWkyuzfSEMY`
- source state: private / HOLD
- pilot selection reason: the chapter stress-tests DXY, broad-dollar, trade-weighted, FX, funding and institutional terminology while retaining the book's regime-aware, non-advisory framing.

## Existing architecture to reuse

The current English audiobook already provides the correct authorization boundary:

- one Library Pass entitlement check;
- one protected audiobook handler;
- private Supabase signed URLs;
- 3,600-second signed-URL TTL;
- language-independent chapter slugs;
- existing 20-track English edition remains authoritative and unchanged.

Localization policy already provides collision-safe progress keys:

- English: `usd-impact-library-pass-audiobook-progress`
- Spanish: `usd-impact-library-pass-audiobook-progress:es`

The Spanish edition must use the Spanish key. It must never overwrite the English listening position.

## Proposed Spanish asset identity

No object is created by this pilot-preparation branch.

When a pilot audio object is explicitly approved for upload, use a locale-specific prefix conceptually equivalent to:

`audiobook/read-the-dollar-first/es/v1-pilot/`

The chapter identity remains `chapter-3-usd-is-not-dxy`; locale is an asset variant, not a new entitlement or content identity.

## Pilot workflow

1. Lock the exact Candidate 1 source revision above.
2. Use the approved short Chapter 3 pilot narration script in this branch.
3. Apply the pilot pronunciation dictionary.
4. Produce one synthetic-voice test and/or one human-voice test only after a voice/provider choice is explicitly approved.
5. Review pronunciation, pacing, numbers, institution names and conditional language.
6. Compare spoken content against the locked Spanish source.
7. Check loudness/edit quality against the accepted audiobook pipeline.
8. Keep the result private.
9. Do not add a protected Spanish route or member manifest until the pilot is accepted.
10. Only after acceptance prepare the full 20-track Spanish production plan.

## Technical invariants

The pilot must preserve all of the following:

- English audiobook output and URLs unchanged.
- English progress key unchanged.
- Spanish progress stored under `:es`.
- Same Library Pass authorization boundary.
- No Spanish-specific entitlement.
- No service-role credential in browser code.
- No public storage object.
- No Production route or rewrite.
- No automatic language switch.
- No replacement of the English audiobook.
- No full-book synthesis before pilot acceptance.

## Acceptance gate

The pilot may advance only if all of the following pass:

- narration matches the approved Spanish source;
- no skipped or repeated sentence;
- no changed number, weight or institution name;
- no strengthened financial claim;
- DXY / USD / FX terminology is accepted;
- pronunciation is accepted;
- compliance meaning remains intact;
- audio quality is acceptable for long-form listening;
- English audiobook regression remains clean;
- explicit owner approval names the Spanish audiobook pilot or subsequent full-production step.

## Current decision

**READY FOR VOICE PILOT AFTER VOICE/PROVIDER APPROVAL.**

This branch does not authorize synthesis, upload, member delivery, Production routing or publication.
