# Spanish localization source authority

Status: **BOOK + VIDEO SOURCE RECONCILIATION COMPLETE / PUBLICATION HOLD**  
Checkpoint: 2026-10-07  
Production impact of this record: **NONE**

## Governing rule

Spanish localization must not be generated, narrated, published, indexed, emailed, or attached to member delivery from an obsolete source.

The live English edition remains the canonical upstream authority. Each Spanish release surface must retain traceable source parity, compliance meaning, technical QA and an explicit release decision.

## Current source hierarchy

### Active private English digital-reader authority

- File: `USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`
- Edition label: `1.3 Publication Candidate (August 2026)`
- Production build: `v5.95-candidate.2`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`
- Status: owner-approved and privately available to eligible Library Pass accounts.

### Certified editable English manuscript baseline

- File: `USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN.docx`
- Status: preserved certified editable baseline.
- Boundary: the v5.95 digital-reader correction did not rewrite this DOCX.

### Current Spanish book candidate

Private Google Doc:

- Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- title: `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD`
- final verified revision: `AHj4eMRlqgvFi-UjSW8mj0t1Ye347dCeqBwOD_kVcmIOxVFHDj06s01aUPtPIeh4BcsZ6KjJfeIY74CdoSU_GdK-4bUMtyclRWkyuzfSEMY`
- sharing state: private / unshared
- publication state: **HOLD**

Final Candidate 1 evidence is recorded in:

`docs/localization/SPANISH_EDITION_1_3_CANDIDATE_1_FINAL_NAV_REFERENCE_COMPLIANCE_QA_2026-10-07.md`

### Historical Spanish Edition 1.2

- File: `USD_Impact_ES_Edition_1_2_April_2026_Session9_Brand_Applied.docx`
- Companion PDF: same Edition 1.2 / Session 9 release.
- Status: historical translation memory only.
- It is **not** current Spanish release authority and must not be promoted as Edition 1.3.

### Current Video Library caption authority

- Current production English Cloudflare Stream WebVTT: exact source authority for all **51 / 51** current films.
- Controlled Spanish `es` tracks: **51 / 51 ready and exact-readback verified** against approved HOLD VTT bytes.
- Site-player default remains English.
- Final HOLD QA: `docs/localization/SPANISH_VIDEO_FINAL_HOLD_QA.md`.

## Reconciliation status

### Book

Whole-manuscript paragraph/source reconciliation is complete:

- total mapped units: **704**
- `REUSE_VERIFIED`: **500**
- `REVISE`: **91**
- `NEW_TRANSLATION`: **91**
- `RETIRE`: **22**

Candidate 1 construction, references, hyperlinks, pagination, analytical index, bookmarks, compliance readback and rendered regression QA are complete.

Final PDF state recorded by the release-QA checkpoint:

- pages: **73**
- outline/bookmark items: **311**, all valid
- external link annotations: **73**
- unique external destinations: **44**
- explicit compliance-note units: **14**

### Video

Video source recovery, translation, provider upload/readback and post-upload representative visual clearance are complete for all **51 / 51** films.

The Spanish tracks remain non-default and English remains the site-player default.

### Other Spanish surfaces

The completion above does **not** imply release readiness for surfaces that have not completed their own content/technical release work.

Still separate:

- Spanish audiobook;
- public Spanish website content/routes;
- Spanish sitemap/hreflang publication;
- Spanish marketing email;
- any localization-specific entitlement/database behavior.

## Runtime publication policy

The current application policy remains fail-closed:

`LOCALE_POLICY.es.publicationEnabled === false`

Therefore Spanish is a known locale but public Spanish path publication remains disabled.

## Release constraints

Despite completion of book and video reconciliation/QA:

- no public `/es/` pages are authorized;
- no Spanish sitemap or hreflang publication is authorized;
- no Spanish marketing-email activation is authorized;
- no Spanish audiobook member delivery is authorized;
- no Spanish book/member delivery is authorized;
- no Spanish video caption-default switch is authorized;
- no replacement of English book, audiobook, video or email behavior is authorized;
- no localization database migration is authorized;
- no commerce, entitlement, auth or passkey change is authorized.

Any release must be explicitly authorized by surface.

## Evidence

Primary repository checkpoints include:

- PR #760 — Phase 1 Spanish localization foundation, merged with publication disabled;
- PR #781 — whole-manuscript Spanish Edition 1.3 parity map;
- PR #782 — Candidate 1 construction controls;
- PR #783 — reference/layout QA;
- PR #784 — hyperlink metadata QA;
- PR #785 — full visual QA;
- PR #787 — final Candidate 1 navigation/reference/compliance QA;
- `SPANISH_VIDEO_FINAL_HOLD_QA.md`.

This document records current source authority and release boundaries. It does **not** authorize public Spanish publication or delivery.
