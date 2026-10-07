# Spanish Localization — Release Readiness Rollup

Status: **CONTENT/QA READY IN SCOPED AREAS — PUBLICATION HOLD**  
Checkpoint date: 2026-10-07  
Controlling Production commit at checkpoint: `ad473f11de2707b8ffbe17ae88e060d3a3312115`

## Purpose

Provide one current release-control view after completion of the Spanish book Candidate 1 QA and the 51-film non-default Spanish caption rollout.

This is a readiness record only. It does not activate any Spanish release surface.

## Verified current state

### Foundation

PR #760 merged the fail-closed localization foundation while keeping:

- `LOCALE_POLICY.es.publicationEnabled = false`;
- public `/es/` routes unpublished;
- Spanish sitemap/hreflang disabled;
- English as the default locale;
- English as the default video caption track;
- commerce, auth, passkeys, entitlements and database behavior unchanged.

### Spanish book — Candidate 1

Final release-QA evidence is merged in PR #787.

Current private source:

- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- verified revision: `AHj4eMRlqgvFi-UjSW8mj0t1Ye347dCeqBwOD_kVcmIOxVFHDj06s01aUPtPIeh4BcsZ6KjJfeIY74CdoSU_GdK-4bUMtyclRWkyuzfSEMY`
- sharing: private / unshared
- publication: **HOLD**

Final recorded state:

- 73-page PDF;
- 311 valid outline/bookmark targets;
- 73 external link annotations / 44 unique destinations;
- analytical index aligned to final pagination;
- 14 compliance-note units;
- high-risk retired-methodology/performance regression scan clean;
- controlled `hurdle rate` terminology: `rentabilidad mínima exigida`.

### Spanish Video Library captions

Current provider state:

- 51 / 51 production films have an exact-readback verified Spanish `es` track;
- all Spanish tracks are ready;
- English remains present;
- application default remains `defaultTextTrack: 'en'`;
- 72 / 72 representative post-upload frame/caption timestamps passed;
- 144 / 144 desktop+narrow rendered clearance checks passed;
- the controlled two-film signed-player pilot passed desktop/mobile-width QA.

This is a completed **non-default caption provider state**, not a Spanish-site launch.

### Production / CI verification

For exact merge commit `ad473f11de2707b8ffbe17ae88e060d3a3312115`:

- Vercel Production deployment: **READY**
- `validate-and-build`: **PASS**
- JavaScript/TypeScript CodeQL: **PASS**
- recent Production runtime-error scan at checkpoint: **clean**

The merged PR #787 changed documentation/evidence only and did not enable Spanish publication.

## Release-surface matrix

| Surface | Content/QA state | Current release state |
| --- | --- | --- |
| Spanish book Candidate 1 | Final scoped QA PASS | **HOLD / private** |
| Spanish video captions | 51/51 exact provider PASS; post-upload clearance PASS | **HOLD as non-default provider track** |
| Public `/es/` website | Foundation exists; publication disabled | **NOT AUTHORIZED** |
| Sitemap / hreflang | Guarded by unpublished-locale policy | **NOT AUTHORIZED** |
| Spanish audiobook | Separate content/release work required | **NOT READY / NOT AUTHORIZED** |
| Spanish marketing email | Separate content/release work required | **NOT READY / NOT AUTHORIZED** |
| Entitlements / commerce / auth / passkeys | No Spanish change required for this checkpoint | **NO CHANGE AUTHORIZED** |
| Database localization | No migration approved | **NO CHANGE AUTHORIZED** |

## Explicit owner release gate

The next state-changing action must be an explicit owner authorization that names the release surface.

A generic continuation instruction is not treated by this release-control record as authorization to publish all Spanish surfaces.

Examples of sufficiently scoped decisions:

- authorize private Spanish book delivery to eligible Library Pass members;
- authorize public Spanish website implementation on Preview only;
- authorize public `/es/` Production publication after Preview acceptance;
- authorize sitemap/hreflang indexing after route/canonical verification;
- authorize changing caption-default behavior;
- authorize Spanish audiobook delivery;
- authorize Spanish marketing email.

Each surface remains separable.

## Recommended controlled sequence after authorization

If a future authorization covers public Spanish release, preserve this order:

1. **Choose the exact surface and release scope.**
2. Build implementation on an isolated branch from current `main`.
3. Keep `publicationEnabled: false` during implementation and Preview QA unless the approval explicitly authorizes the final flip.
4. Verify English regression equivalence.
5. Verify Spanish canonical/route behavior, member gating where applicable, and no unintended indexing.
6. For public routes, verify canonical URLs, sitemap entries and hreflang as one controlled SEO gate.
7. Deploy only the explicitly approved surface.
8. Re-check Production aliases, runtime errors, auth/entitlement behavior and English defaults.
9. Record exact commit/deployment evidence.

## Invariants until that authorization

The following must remain true:

- English remains the default locale;
- English remains the default video caption track;
- Spanish Candidate 1 remains private;
- `LOCALE_POLICY.es.publicationEnabled` remains `false`;
- no public Spanish sitemap/hreflang entries;
- no Spanish email activation;
- no Spanish audiobook/member delivery;
- no entitlement, commerce, auth, passkey or database mutation.

## Resume point

The discovery, parity, construction and final QA work for **Spanish book Candidate 1** is complete.

The controlled provider + representative visual QA work for **Spanish Video Library captions** is complete.

The project is therefore at the **owner release-decision boundary**, with public Spanish publication still fail-closed.
