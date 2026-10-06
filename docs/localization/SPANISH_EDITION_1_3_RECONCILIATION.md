# Spanish Edition 1.3 source reconciliation map

Status: **PRIVATE WORKING DRAFT - HOLD**  
Publication authorization: **NONE**  
Production impact: **NONE**  
English edition impact: **NONE**

## Decision

The historical Spanish Edition 1.2 is **not** safe to promote or patch in place as the current Spanish edition.

The safest controlled method is:

1. treat the active English Edition 1.3 / v5.95 Candidate 2 as the semantic release authority;
2. retain the certified v5.94 English DOCX as the editable baseline and provenance source;
3. use Spanish Edition 1.2 as translation memory/reference only;
4. rebuild the Spanish release candidate against the current English structure and the approved Phase 2C patch register;
5. keep every Spanish surface unpublished until full parity and QA are complete.

This avoids silently carrying older methodology, historical-performance language, missing sections, or obsolete archive wording into the Spanish edition.

## Source chain

### Current semantic release authority

`USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`

- Edition label: 1.3 Publication Candidate (August 2026)
- build: v5.95-candidate.2
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`
- active private Library Pass digital-reader artifact
- no public-distribution authorization is implied by this localization work

### Certified editable English baseline

`USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN.docx`

- preserved certified editable manuscript
- Candidate 2 did not rewrite this DOCX
- Phase 2C corrections are controlled separately by `docs/book-site-bridge/manuscript-patch-register.md`

### Historical Spanish reference

`USD_Impact_ES_Edition_1_2_April_2026_Session9_Brand_Applied.docx`

- historical Spanish Edition 1.2
- useful as translation memory
- prior package/parity evidence explicitly did **not** constitute a fresh line-by-line translation audit

## Verified structural drift

The current English certified structure includes:

- Part I through Part V
- Chapters 1 through 13
- Appendix A - Quick Glossary
- Appendix B - USD Impact Score Methodology
- About the Author
- Index

The historical Spanish document contains Chapters 1 through 13 and a single quick-glossary appendix, but does not contain the current Appendix B methodology section as a release section.

Therefore Appendix B cannot be recovered by simply editing the old Spanish document; it requires a new controlled Spanish translation from current English authority.

## Verified obsolete Spanish claims

The historical Spanish Edition 1.2 still contains retired Score-performance language that is absent from current Candidate 2, including:

- aggregate `84,5 %` / `84.5%` hit-rate language;
- `100 %` regime claims;
- `79,7 %` / `79.7%`;
- `73,2 %` / `73.2%`.

It also states that Score inputs are normalized with a moving standard deviation and describes the score as clipped at approximately three standard deviations. That does not match current Score v2 production methodology.

The current authority instead requires:

- eight Friday-ended market levels;
- full production-sample mean;
- sample standard deviation;
- clipping at +/-3.5;
- fixed signed absolute weights of 0.125;
- five fixed regime bands;
- explicit distinction between recalculated history and as-published vintages.

## Verified archive-vintage drift

Historical Spanish Chapter 13 says readers can see how the score read older cases in real time, "no reconstruidos con vision retrospectiva."

That wording is explicitly retired by MP-10. Current authority distinguishes:

- dated as-published weekly archives; and
- current recalculated long-history research views.

These must not be conflated in Spanish.

## Verified missing print bridges

Historical Spanish Edition 1.2 contains none of the four current governed short-link insertions:

- `/go/c03`
- `/go/score`
- `/go/c11`
- `/go/methodology`

The optional `/go/companion` insertion remains excluded because Candidate 2 excluded MP-11.

## Phase 2C Spanish reconciliation matrix

| Patch | Spanish action | Status | Reason |
| --- | --- | --- | --- |
| MP-01 | Replace | Required | Chapter 10 opening overstates accuracy and uses obsolete broader variable framing |
| MP-02 | Replace | Required | Spanish text still describes moving-standard-deviation normalization |
| MP-03 | Replace | Required | Current five regime bands must replace legacy generic sign framing |
| MP-04 | Replace/delete retired claims | Required | 84.5/100/79.7/73.2 claims remain in Spanish |
| MP-05 | Replace selected 2020 wording | Required | Spanish still claims real-time test/reading |
| MP-06 | Replace selected 2022 wording | Required | Predictive wording must be reduced to retrospective/conditional framing |
| MP-07 | Replace opening limitation paragraph | Required | Current authority narrows what the record proves |
| MP-08 | Replace takeaway and recap | Required | Must match current descriptive, non-signal framing |
| MP-09 | Add print bridge | Required | `/go/score` and `/go/methodology` absent |
| MP-10 | Replace archive paragraph | Required | Historical Spanish conflates real-time/as-published and recalculated records |
| MP-11 | Do not add | Excluded | Candidate 2 excluded optional companion insertion |
| MP-12 | New translation | Required | Current Appendix B section absent from Spanish edition |
| MP-13 | New translation | Required | Current normalization/formula section absent |
| MP-14 | New translation | Required | Current five-band table absent |
| MP-15 | New translation | Required | Current validation-evidence section absent |
| MP-16 | New translation | Required | Current vintage/version-control wording absent |
| MP-17 | New translation | Required | Current reader-audit checklist absent |
| MP-18 | Add print bridge | Required | methodology link/QR absent |
| MP-19 | Add print bridge | Required | Chapter 3 practice link/QR absent |
| MP-20 | Add print bridge | Required | Chapter 11 practice link/QR absent |

## Treatment of the rest of Spanish Edition 1.2

Chapters 1-9, Chapters 11-12, and unaffected portions of Chapter 13 are **candidate translation memory only** at this stage.

Their presence in the historical Spanish package is not sufficient evidence of current paragraph-level parity. They must be compared against the certified/current English source before being marked reusable.

Allowed states for each later translation unit:

- `REUSE_VERIFIED`
- `REVISE`
- `NEW_TRANSLATION`
- `RETIRE`

No unit may become `REUSE_VERIFIED` solely because it existed in Spanish Edition 1.2.

## Spanish release construction rule

The future Spanish candidate should be created as a new controlled edition derived from current English authority, not as an overwrite of the historical Spanish Edition 1.2 file.

The historical Spanish file remains preserved unchanged for provenance.

Minimum metadata for each localized unit:

- English source edition/build;
- English source section or stable source ID;
- source hash/version where available;
- Spanish translation revision;
- translator/reviewer or process identifier;
- terminology QA state;
- compliance QA state;
- technical QA state;
- final release state.

## Release gates

Spanish book/audiobook release remains blocked until all of the following pass:

1. complete paragraph-level English-to-Spanish source parity;
2. all Phase 2C P0 patches reconciled;
3. Appendix B translated and reviewed;
4. governed print links checked;
5. retired performance claims absent;
6. recalculated-history/as-published-vintage distinction preserved;
7. terminology review;
8. compliance review;
9. layout and navigation QA;
10. audiobook source parity if narration is generated;
11. explicit owner release approval.

No current English artifact, URL, entitlement, audiobook, email, or Production configuration is changed by this document.

## Fresh parity-audit checkpoint — 2026-10-06

A fresh source-grounded comparison has now been performed against:

- English Candidate 2, Drive file ID `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`;
- historical Spanish Edition 1.2, Drive file ID `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`;
- the current Phase 2C manuscript patch register.

The detailed checkpoint is recorded in:

`docs/localization/SPANISH_EDITION_1_3_PARITY_AUDIT_2026-10-06.md`

The checkpoint confirms:

- MP-01 through MP-10 require revision/retirement/insertion work in Spanish;
- MP-12 through MP-17 require new translation because Appendix B is absent from Spanish 1.2;
- MP-18, MP-19 and MP-20 require new governed print-bridge insertions;
- MP-11 remains excluded;
- retired 84.5/100/79.7/73.2 performance claims and moving-standard-deviation wording remain present in the historical Spanish reference;
- the historical Spanish Chapter 13 still conflates real-time/as-published history with recalculated history;
- no existing Spanish paragraph is promoted to `REUSE_VERIFIED` merely by presence in Edition 1.2.

Status remains **HOLD**. This checkpoint is evidence only and does not authorize translation publication, narration, member delivery, or Production localization activation.

