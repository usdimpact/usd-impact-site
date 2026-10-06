# Spanish Edition 1.3 paragraph/source parity audit — checkpoint 2026-10-06

Status: **AUDIT IN PROGRESS — HOLD**  
Publication authorization: **NONE**  
Production impact: **NONE**  
English edition impact: **NONE**  
Spanish historical artifact mutation: **NONE**

## Purpose

This checkpoint records a fresh source-grounded reconciliation between the current English semantic authority and the historical Spanish Edition 1.2 reference. It does not authorize translation, narration, publication, indexing, delivery, or any Production change.

## Controlling sources

### Current English semantic authority

- `USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`
- Drive file ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- Edition: 1.3 Publication Candidate (August 2026)
- Build: v5.95-candidate.2
- Frozen SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`
- Current status: private Library Pass digital-reader authority

### Historical Spanish reference

- `USD_Impact_ES_Edition_1_2_April_2026_Session9_Brand_Applied.docx`
- Drive file ID: `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`
- Edition: 1.2 (April 2026)
- Status: historical translation memory/reference only
- This artifact remains unchanged.

### Governing correction register

- `docs/book-site-bridge/manuscript-patch-register.md`
- P0/P1 scope: MP-01 through MP-10 and MP-12 through MP-20
- MP-11 remains excluded from Candidate 2.

## Fresh structural findings

The English Candidate 2 table of contents contains:

- Introduction
- Parts I-V
- Chapters 1-13
- Further Reading
- Appendix A — Quick Glossary
- Appendix B — USD Impact Score Methodology
- About the Author
- Index

The historical Spanish Edition 1.2 contains:

- Introduction
- Parts I-V
- Chapters 1-13
- Additional reading
- one glossary appendix
- About the Author
- Index

It does **not** contain Appendix B as a release section. Appendix B therefore has no reusable Spanish release unit and requires a new controlled translation.

## Fresh high-risk content findings

The historical Spanish Edition 1.2 still contains all of the following retired or superseded content:

1. Score normalization described as `desviación estándar móvil`.
2. clipping described as approximately three standard deviations rather than the current +/-3.5 rule.
3. fixed performance claims including `84,5 %`, `100 %`, `79,7 %`, and `73,2 %`.
4. Chapter 10 language that says the eleven-year record demonstrates that the framework reads regimes accurately.
5. predictive wording in the 2020/2022 case-study discussion that exceeds the current retrospective/descriptive framing.
6. Chapter 13 archive wording stating that prior cases show how the score read them in real time, `no reconstruidos con visión retrospectiva`.

These are not terminology-only differences. They alter methodology, evidentiary meaning, and compliance framing and must not be reused unchanged.

## Fresh governed-link findings

The historical Spanish Edition 1.2 does not contain the four required Candidate 2 governed print bridges:

- `usd-impact.com/go/c03`
- `usd-impact.com/go/score`
- `usd-impact.com/go/c11`
- `usd-impact.com/go/methodology`

The optional `/go/companion` insertion remains excluded because MP-11 was excluded from Candidate 2.

## Patch-by-patch Spanish disposition

| Patch | Current Spanish disposition | Audit state | Evidence |
| --- | --- | --- | --- |
| MP-01 | REVISE | CONFIRMED | Chapter 10 opening/evidence framing is older than Candidate 2 |
| MP-02 | REVISE | CONFIRMED | Spanish glossary/method text still uses moving-standard-deviation normalization |
| MP-03 | REVISE | CONFIRMED | Current five fixed regime bands are not represented as the release authority |
| MP-04 | RETIRE + REPLACE | CONFIRMED | 84.5/100/79.7/73.2 claims remain |
| MP-05 | REVISE | CONFIRMED | 2020 wording remains real-time/test oriented |
| MP-06 | REVISE | CONFIRMED | 2022 section contains predictive phrasing |
| MP-07 | REVISE | CONFIRMED | Spanish limitation paragraph overstates what the record proves |
| MP-08 | REVISE | CONFIRMED | current descriptive/non-signal takeaway and recap are not present |
| MP-09 | NEW INSERTION | CONFIRMED | `/go/score` and methodology bridge absent |
| MP-10 | RETIRE + REPLACE | CONFIRMED | Chapter 13 conflates real-time/as-published history with current recalculation |
| MP-11 | EXCLUDE | CONFIRMED | excluded by Candidate 2 |
| MP-12 | NEW_TRANSLATION | CONFIRMED | Appendix B absent |
| MP-13 | NEW_TRANSLATION | CONFIRMED | Appendix B normalization/formula section absent |
| MP-14 | NEW_TRANSLATION | CONFIRMED | five-band table absent |
| MP-15 | NEW_TRANSLATION | CONFIRMED | validation-evidence section absent |
| MP-16 | NEW_TRANSLATION | CONFIRMED | vintage/version-control section absent |
| MP-17 | NEW_TRANSLATION | CONFIRMED | reader-audit checklist absent |
| MP-18 | NEW INSERTION | CONFIRMED | methodology print bridge absent |
| MP-19 | NEW INSERTION | CONFIRMED | Chapter 3 practice bridge absent |
| MP-20 | NEW INSERTION | CONFIRMED | Chapter 11 practice bridge absent |

## Unit-level audit state by manuscript area

This checkpoint does **not** mark any existing Spanish paragraph `REUSE_VERIFIED` solely because it appears in Edition 1.2.

| Area | Current state | Release treatment |
| --- | --- | --- |
| Front matter / acknowledgments / reader note | PARAGRAPH_AUDIT_REQUIRED | compare line-by-line to Candidate 2 before reuse |
| Introduction | PARAGRAPH_AUDIT_REQUIRED | compare line-by-line; current Candidate 2 contains wording changes |
| Chapters 1-2 | PARAGRAPH_AUDIT_REQUIRED | historical translation memory only |
| Chapter 3 | PARAGRAPH_AUDIT_REQUIRED + INSERTION_REQUIRED | fresh paragraph audit plus MP-19 |
| Chapters 4-9 | PARAGRAPH_AUDIT_REQUIRED | historical translation memory only |
| Chapter 10 | REVISION_REQUIRED | MP-01 through MP-09 govern material changes |
| Chapter 11 | PARAGRAPH_AUDIT_REQUIRED + INSERTION_REQUIRED | fresh paragraph audit plus MP-20 |
| Chapter 12 | PARAGRAPH_AUDIT_REQUIRED | historical translation memory only |
| Chapter 13 | REVISION_REQUIRED | MP-10 governs archive/vintage correction |
| Further Reading | PARAGRAPH_AUDIT_REQUIRED | source/reference parity check required |
| Appendix A / glossary | REVISION_REQUIRED | Score definition contains obsolete methodology/performance language |
| Appendix B | NEW_TRANSLATION | absent from Spanish 1.2 |
| About the Author | PARAGRAPH_AUDIT_REQUIRED | source-currentness check required |
| Index | REBUILD_AFTER_LAYOUT | cannot be certified before final Spanish pagination/layout |

## Allowed unit states

Every later translation unit must receive one explicit state:

- `REUSE_VERIFIED`
- `REVISE`
- `NEW_TRANSLATION`
- `RETIRE`

No unit is `REUSE_VERIFIED` at this checkpoint unless a later paragraph-level comparison establishes semantic parity against Candidate 2.

## Next audit sequence

1. Split Candidate 2 and Spanish 1.2 into stable section/paragraph units.
2. Audit front matter + Introduction.
3. Audit Chapters 1-3 and mark each paragraph with one allowed state.
4. Continue Chapters 4-9.
5. Rebuild Chapter 10 against MP-01 through MP-09.
6. Audit Chapters 11-13, including MP-10 and MP-20.
7. Audit Appendix A and remove obsolete Score language.
8. Translate Appendix B from current English authority.
9. Apply MP-18/19/20 print bridges.
10. Run terminology, compliance, link, layout, navigation, and final source-parity QA.
11. Only after all gates pass may a new Spanish release candidate be proposed for explicit owner approval.

## Release boundary

Until the sequence above is complete:

- no public `/es/` routes;
- no sitemap/hreflang activation;
- no Spanish book or audiobook delivery;
- no Spanish marketing email;
- no Spanish default caption switch;
- no Production localization migration;
- no entitlement, commerce, auth, passkey, email, or English-content behavior change.

This checkpoint is evidence only. It does not create a release candidate and does not change Production.
