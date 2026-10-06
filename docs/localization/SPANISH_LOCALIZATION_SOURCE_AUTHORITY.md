# Spanish localization source authority

Status: Phase 1 governance foundation only  
Publication: **HOLD**  
Production impact: **NONE**

## Governing rule

Spanish localization must not be generated, narrated, published, indexed, emailed, or attached to member delivery from an obsolete English source.

The English live edition remains canonical until an explicitly approved Spanish release passes source-parity, translation, compliance, technical, and release QA.

## Current source hierarchy

### Active private digital-reader artifact

- File: `USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`
- Edition label: `1.3 Publication Candidate (August 2026)`
- Production build: `v5.95-candidate.2`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`
- Status: owner-approved and privately available to eligible Library Pass accounts.
- Boundary: private member-only delivery; not a public-download or translation authority by itself.

### Certified editable English manuscript baseline

- File: `USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN.docx`
- Status: preserved certified editable manuscript baseline.
- Important: the v5.95 digital-reader correction did not rewrite this DOCX.

### Existing Spanish edition

- File: `USD_Impact_ES_Edition_1_2_April_2026_Session9_Brand_Applied.docx`
- Companion PDF: same Edition 1.2 / Session 9 release.
- Status: historical Spanish source, not current release authority.
- Existing parity evidence states structural/package/governance/readiness parity passed, but it was **not a fresh line-by-line translation audit**.

## Required reconciliation before Spanish content production

Before Spanish narration, captions, website copy, or member delivery may be considered release-ready:

1. Establish the exact English source text for every translated unit.
2. Reconcile the v5.95 digital-reader corrections against the v5.94 certified editable manuscript.
3. Compare existing Spanish Edition 1.2 against that reconciled English source.
4. Mark every Spanish unit as one of:
   - unchanged and source-current,
   - requires revision,
   - new translation required,
   - retired / must not be reused.
5. Preserve compliance meaning and educational positioning.
6. Record source version, source identifier/hash, translation revision, reviewer, and QA status.
7. Do not treat prior package-level parity as line-by-line translation approval.

## Release constraints

Until the reconciliation above is complete and explicitly approved:

- no public `/es/` pages;
- no Spanish sitemap entries or hreflang publication;
- no Spanish marketing-email activation;
- no Spanish audiobook member delivery;
- no Spanish video caption default switch;
- no replacement of English book, audiobook, video, or email behavior;
- no Production database migration for localization;
- no Production deployment or merge from the localization branch.

## Source evidence

Read-only evidence used for this Phase 1 decision:

- `USD_Impact_Current_Release_Index.md`, modified 2026-09-01.
- `USD_Impact_Edition_1.3_v5.95_Phase2C_Candidate_2_Private_Publication_Readiness_Packet.md`.
- Existing Drive record for `USD_Impact_ES_Edition_1_2_April_2026_Session9_Brand_Applied.docx`.
- Existing `ES Physical Verification and EN Parity Result v1 — USD Impact` evidence, whose note explicitly limits the earlier parity result.

This document records source authority only. It does not authorize translation or publication.
