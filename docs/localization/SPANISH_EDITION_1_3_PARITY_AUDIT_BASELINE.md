# Spanish Edition 1.3 — Phase 2A Parity Audit Baseline

Status: **PRIVATE AUDIT WORKING BASELINE — PUBLICATION HOLD**  
Tracking issue: #772  
Baseline date: 2026-10-06  
Production publication state: Spanish remains disabled

## Purpose

This file freezes the first fresh editorial/source-parity baseline for rebuilding the Spanish edition against the active English Edition 1.3 / v5.95 Candidate 2 authority.

It is an audit record only. It does not authorize translation publication, public `/es/` pages, Spanish book or audiobook delivery, marketing activation, entitlement changes, commerce changes, auth/passkey changes, Supabase changes, caption-default changes, or any Production runtime/config mutation.

## Frozen source authority

### English semantic release authority

- File: `USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf`
- Drive file ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- Size: `2,281,645` bytes
- Release-index SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`
- Edition label: `1.3 Publication Candidate (August 2026)`
- Build: `v5.95-candidate.2`
- Status: active private Library Pass digital-reader authority

### Historical Spanish reference

- File: `USD_Impact_ES_Edition_1_2_April_2026_Session9_Brand_Applied.pdf`
- Drive file ID: `1A3499kFgsZSvbUSVJGRtm8WV_9QhNTbb`
- Size: `1,282,246` bytes
- Drive state observed 2026-10-06: private / not shared
- Status: historical translation reference only; not current release authority

### Prior ES parity evidence

`ES Physical Verification and EN Parity Result v1 - USD Impact` established physical package integrity and structural/package/governance/readiness parity.

Its controlling limitation states that it **did not perform a new line-by-line translation comparison** against the English benchmark in that session.

Therefore:

- its PASS is valid for the package scope it tested;
- it is not editorial translation approval;
- it must not be used to mark historical Spanish paragraphs `REUSE_VERIFIED` without a fresh comparison.

## Audit classification vocabulary

Every audited Spanish unit must receive exactly one editorial disposition:

- `REUSE_VERIFIED` — current English meaning and compliance boundary are preserved closely enough for reuse.
- `REVISE_REQUIRED` — a historical Spanish unit exists, but it must be rewritten against current English authority.
- `NEW_TRANSLATION_REQUIRED` — current English authority contains a release unit that has no current Spanish authority.
- `RETIRE_DO_NOT_REUSE` — historical Spanish text conflicts with current methodology, vintage treatment, compliance framing, or release scope and must not survive into the new candidate.

No unit may become `REUSE_VERIFIED` solely because it existed in Edition 1.2.

## Deterministic source scan — 2026-10-06

The following counts come from direct text extraction of the two frozen PDFs above.

### Historical Spanish claims that remain present

| Scan target | ES matches | Release interpretation |
| --- | ---: | --- |
| 84.5 / 84,5 performance claim | 8 | obsolete current Score v2 evidence |
| 100% regime-performance claim | 6 | obsolete current Score v2 evidence |
| 79.7 / 79,7 performance claim | 5 | obsolete current Score v2 evidence |
| 73.2 / 73,2 performance claim | 5 | obsolete current Score v2 evidence |
| `tiempo real` | 5 | includes Chapter 10/13 release-critical real-time claims plus unrelated generic uses |
| `no reconstruid...` | 1 | Chapter 13 archive/vintage conflict |
| `desviación estándar móvil` | 1 | obsolete normalization methodology |

The performance-claim counts above are direct text matches and can include repeated presentation of the same historical claim across Chapter 10, recaps, glossary/index-style material, or methodology text. Every surviving occurrence must be mapped during the paragraph audit.

### Current English release units absent from the historical Spanish PDF

| Current English unit | EN matches | ES matches | Initial disposition |
| --- | ---: | ---: | --- |
| Appendix B — USD Impact Score Methodology | present | 0 | `NEW_TRANSLATION_REQUIRED` |
| `usd-impact.com/go/score` | 1 | 0 | `NEW_TRANSLATION_REQUIRED` |
| `usd-impact.com/go/methodology` | 2 | 0 | `NEW_TRANSLATION_REQUIRED` |
| `usd-impact.com/go/c03` | 1 | 0 | `NEW_TRANSLATION_REQUIRED` |
| `usd-impact.com/go/c11` | 1 | 0 | `NEW_TRANSLATION_REQUIRED` |
| five-band Score label table | present | absent as current five-band authority | `NEW_TRANSLATION_REQUIRED` |

## Release-critical MP audit baseline

This table maps the current manuscript patch register to the historical Spanish reference. It is a Phase 2A baseline, not final translation approval.

| Patch | Current authority area | Historical ES state | Initial classification | Phase 2A action |
| --- | --- | --- | --- | --- |
| MP-01 | Chapter 10 opening | existing older framing | `REVISE_REQUIRED` | compare opening paragraph to current descriptive/non-predictive authority |
| MP-02 | Chapter 10 “What the score is” | old methodology survives | `REVISE_REQUIRED` | replace rolling/legacy normalization description with current Score v2 level-based full-sample methodology |
| MP-03 | Chapter 10 regime labels | current five-band scheme absent | `NEW_TRANSLATION_REQUIRED` | translate current five fixed descriptive bands |
| MP-04 | Chapter 10 historical hit-rate block | obsolete 84.5/100/79.7/73.2 claims present | `RETIRE_DO_NOT_REUSE` | delete performance-accuracy framing and translate current “what the record can/cannot show” section |
| MP-05 | 2020 case study | real-time success wording present | `REVISE_REQUIRED` | convert to retrospective illustration; remove implied contemporaneous proof |
| MP-06 | 2022 case study | older predictive wording may survive | `REVISE_REQUIRED` | constrain wording to retrospective/explanatory framing |
| MP-07 | “What the record does not prove” | older limitation framing | `REVISE_REQUIRED` | align future-predictive/return limitations with Candidate 2 |
| MP-08 | Chapter 10 takeaway/recap | obsolete performance claims survive | `REVISE_REQUIRED` | translate current transparent-input/descriptive orientation framing |
| MP-09 | Chapter 10 Score/methodology print bridge | absent | `NEW_TRANSLATION_REQUIRED` | add governed `/go/score` and `/go/methodology` bridge copy |
| MP-10 | Chapter 13 archive/vintage distinction | `tiempo real — no reconstruidos...` wording present | `RETIRE_DO_NOT_REUSE` | translate explicit as-published-vs-recalculated distinction |
| MP-11 | optional companion bridge | not part of required Candidate 2 patch set | `NEW_TRANSLATION_REQUIRED` only if adopted | keep optional and separately approved |
| MP-12 | Appendix B provider disclosure | Appendix B absent | `NEW_TRANSLATION_REQUIRED` | translate current production-provider disclosure |
| MP-13 | Appendix B normalization/formula | Appendix B absent | `NEW_TRANSLATION_REQUIRED` | translate current full-sample z-score formula and fixed equal weights |
| MP-14 | Appendix B regime labels | Appendix B absent | `NEW_TRANSLATION_REQUIRED` | translate current five-band table |
| MP-15 | Appendix B validation evidence | Appendix B absent | `NEW_TRANSLATION_REQUIRED` | translate robustness-evidence/non-predictive framing |
| MP-16 | Appendix B data hygiene/vintages | Appendix B absent | `NEW_TRANSLATION_REQUIRED` | translate as-published-vs-recalculated version-control language |
| MP-17 | Appendix B reader audit checklist | Appendix B absent | `NEW_TRANSLATION_REQUIRED` | translate current six-question audit checklist |
| MP-18 | Appendix B methodology print bridge | absent | `NEW_TRANSLATION_REQUIRED` | add governed `/go/methodology` bridge |
| MP-19 | Chapter 3 practice bridge | absent | `NEW_TRANSLATION_REQUIRED` | add governed `/go/c03` bridge |
| MP-20 | Chapter 11 practice bridge | absent | `NEW_TRANSLATION_REQUIRED` | add governed `/go/c11` bridge |

## High-risk historical Spanish evidence

The fresh source scan independently confirms the reconciliation concerns already recorded in Phase 1.

### Performance-accuracy claims

The historical Spanish Chapter 10 contains repeated language equivalent to:

- aggregate approximately 84.5% hit rate;
- 100% results in three regimes;
- 79.7% and 73.2% in later regimes;
- the Score “reads regime changes accurately” using those percentages.

Candidate 2 no longer uses these figures as current Score v2 predictive-performance evidence.

Disposition: `RETIRE_DO_NOT_REUSE` unless a surrounding explanatory unit is fully rewritten against current authority.

### Real-time / hindsight claims

The historical Spanish Chapter 10 contains real-time-success wording around the 2020 case study.

The historical Spanish Chapter 13 contains wording equivalent to:

`... cómo la puntuación los leyó en tiempo real — no reconstruidos con visión retrospectiva ...`

Candidate 2 instead requires separation between:

- dated as-published archives, and
- current recalculated research history.

Disposition: the conflicting historical sentence is `RETIRE_DO_NOT_REUSE`; the surrounding section is `REVISE_REQUIRED`.

### Normalization methodology

The historical Spanish glossary/methodology material includes `desviación estándar móvil`.

Current Candidate 2 states that production Score v2 standardizes Friday-ended weekly levels against the complete production sample available at run time, with fixed equal absolute weights and clipping after z-scoring.

Disposition: historical rolling-normalization wording is `RETIRE_DO_NOT_REUSE`.

## Phase 2A run order

### Batch A — Chapter 10

Audit every paragraph and structured unit in current Chapter 10 against historical Spanish Chapter 10.

Required outputs:

- current-English unit ID;
- historical-Spanish unit ID or `NONE`;
- classification;
- MP mapping;
- compliance/methodology/vintage flags;
- Spanish action;
- reviewer state.

No current performance percentage may inherit from the historical Spanish text.

### Batch B — Chapter 13 vintage language

Audit the dashboard/archive paragraphs and explicitly separate:

- as-published weekly vintages;
- current recalculated history.

The historical `tiempo real — no reconstruidos...` claim must not survive.

### Batch C — Appendix B

Treat Appendix B as new release content for Spanish unless a separately verified current Spanish authority is later discovered.

At minimum cover MP-12 through MP-18.

### Batch D — governed print bridges

Verify exact governed destinations before candidate generation:

- `/go/score`
- `/go/methodology`
- `/go/c03`
- `/go/c11`

The audit records destination identity; it does not change the destination.

### Batch E — full-book paragraph parity

Only after the release-critical batches above are stable, continue through Introduction, Chapters 1–9, Chapters 12–13 remainder, Further Reading, Appendix A, front/back matter, and index-facing text.

Historical existence is not proof of reuse.

## Required audit record fields

Each unit row in the later detailed register must include:

1. unit ID;
2. English section / anchor;
3. English source identifier;
4. historical Spanish section / anchor or `NONE`;
5. classification;
6. MP mapping;
7. reason;
8. translation/revision action;
9. compliance risk;
10. methodology/vintage risk;
11. reviewer state;
12. QA state;
13. final release disposition.

## Phase 2A completion gate

Phase 2A does not pass until:

- Chapter 10 is fully unit-audited against MP-01 through MP-09;
- Chapter 13 vintage wording is fully unit-audited against MP-10;
- Appendix B is fully mapped for MP-12 through MP-18;
- Chapter 3/11 bridge positions are mapped for MP-19/MP-20;
- every 84.5/100/79.7/73.2 occurrence has a disposition;
- every release-critical `tiempo real` / hindsight claim has a disposition;
- historical rolling-normalization wording has a disposition;
- no current-English-only release unit is silently omitted;
- all `REUSE_VERIFIED` decisions have explicit English-to-Spanish evidence;
- the detailed audit record is reviewed before translation-candidate generation begins.

## Publication and system boundaries

During Phase 2A:

- keep `LOCALE_POLICY.es.publicationEnabled === false`;
- do not add public `/es/` routes;
- do not add Spanish sitemap/hreflang publication;
- do not enable Spanish book or audiobook member delivery;
- do not activate Spanish marketing email;
- do not modify commerce, payments, entitlements, auth, passkeys or Supabase;
- do not change Spanish caption upload state or default-track behavior;
- do not edit the frozen English Candidate 2 artifact;
- do not overwrite the historical Spanish 1.2 artifact;
- do not change Score methodology or governed `/go/` destinations.

## Relationship to Phase 1

Phase 1 merged in PR #760 at:

`e3d6036d60bd3c34aec1af10ec8fc4d464c209a0`

That merge established the fail-closed localization foundation and preserved Spanish publication as disabled.

Phase 2A begins from that exact boundary and remains audit/documentation-only.
