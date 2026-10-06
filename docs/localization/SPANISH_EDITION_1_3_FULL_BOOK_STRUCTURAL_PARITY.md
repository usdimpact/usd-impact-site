# Spanish Edition 1.3 — Phase 2A Full-Book Structural Parity Map

Status: **BATCH E STRUCTURAL PASS — PARAGRAPH AUDIT STILL OPEN — PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773  
Baseline date: 2026-10-06

## Purpose

This document extends the Phase 2A audit beyond the release-critical Chapter 10, Chapter 13, Appendix B and print-bridge batches.

It records structural differences between the frozen English Candidate 2 PDF and the historical Spanish Edition 1.2 PDF, identifies additional release blockers, and defines the remaining paragraph-level audit queue.

This is not a claim that full paragraph parity is complete.

## Render and extraction verification

The two frozen PDFs were:

- materialized directly from their Drive authorities;
- text-extracted with the project PDF inspection workflow;
- visually rendered for the release-critical page ranges.

The rendered Chapter 10 pages independently confirm that the historical Spanish layout physically contains the retired accuracy/performance framing, while Candidate 2 physically presents the descriptive Score v2/vintage-controlled framing.

Candidate 2 Appendix B also exists as a real standalone appendix in the rendered PDF, not merely as extracted text.

## Current top-level structure

### English Candidate 2

1. Acknowledgments
2. Introduction
3. Part I
   - Chapter 1
   - Chapter 2
4. Part II
   - Chapter 3
   - Chapter 4
5. Part III
   - Chapter 5
   - Chapter 6
   - Chapter 7
   - Chapter 8
   - Chapter 9
6. Part IV
   - Chapter 10
7. Part V
   - Chapter 11
   - Chapter 12
   - Chapter 13
8. Further Reading
9. Appendix A — Quick Glossary
10. Appendix B — USD Impact Score Methodology
11. About the Author
12. Index

### Historical Spanish Edition 1.2

1. Acknowledgments
2. Introduction
3. Part I
   - Chapter 1
   - Chapter 2
4. Part II
   - Chapter 3
   - Chapter 4
5. Part III
   - Chapter 5
   - Chapter 6
   - Chapter 7
   - Chapter 8
   - Chapter 9
6. Part IV
   - Chapter 10
   - Chapter 11
   - Chapter 12
   - Chapter 13
7. Further Reading
8. Appendix — Quick Glossary
9. About the Author
10. Analytical Index

## Structural deltas that require release treatment

### SE-001 — Part IV / Part V split

**Current English:** Chapter 10 is Part IV; Chapters 11–13 are Part V.  
**Historical Spanish:** Chapters 10–13 remain under Part IV; no Part V exists.

**Classification:** `STRUCTURE_REVISION_REQUIRED`

The new Spanish candidate must reproduce the current Part IV / Part V structure.

---

### SE-002 — Appendix A designation

**Current English:** `Appendix A — Quick Glossary`  
**Historical Spanish:** generic `Apéndice — Glosario rápido`

**Classification:** `STRUCTURE_REVISION_REQUIRED`

The new Spanish candidate must designate the glossary as Appendix A because Candidate 2 now contains Appendix B.

---

### SE-003 — Appendix B absent

Covered in the separate Appendix B translation map.

**Classification:** `NEW_TRANSLATION_REQUIRED`

This is a structural as well as editorial delta.

---

### SE-004 — Index is not reusable as-is

Candidate 2 has an updated index tied to current chapter/page ranges.

Historical Spanish has an analytical index tied to the old Spanish page layout and old appendix structure.

**Classification:** `REGENERATE_AFTER_LAYOUT`

Do not translate/reuse old page references.

Index generation must happen after the new Spanish Candidate 1.3 pagination is stable.

## New blocker: historical Spanish Appendix A Score glossary entry

The historical Spanish Quick Glossary contains a dedicated `USD Impact Score` entry that states, among other things:

- each input is normalized against its own history using a moving standard deviation;
- the score is clipped at approximately three standard deviations;
- the framework was tested across five regimes;
- aggregate hit rate is 84.5%;
- regime figures are 100/100/100/79.7/73.2;
- the score is recalculated each Friday at 22:00 UTC.

The current English Candidate 2 Appendix A does **not** contain a `USD Impact Score` glossary entry.

Candidate 2 instead moves the current Score mechanics into:

- Chapter 10; and
- Appendix B — USD Impact Score Methodology.

Therefore the historical Spanish glossary entry is:

`RETIRE_DO_NOT_REUSE`

This retirement is independent of the Chapter 10 retirements. Removing Chapter 10 percentages alone would not be sufficient because the obsolete evidence also survives in the back matter.

## Introduction audit priority

The historical Spanish Introduction says Part IV:

- examines the eleven-year Score record;
- “honestly” reviews its hit rate;
- works historical regimes;
- turns the framework from argument into an empirical claim.

Candidate 2’s governed Score treatment has materially changed.

**Chapter-level state:** `UNIT_AUDIT_REQUIRED`

At minimum, the Introduction’s book-organization description must be compared against the current Candidate 2 Introduction and revised so it does not reintroduce retired predictive/accuracy framing.

The historical statement that the book/dashboard forms a weekly operating system must also be reviewed against current non-signal/vintage language.

## Chapter-level remaining audit queue

The following table is deliberately conservative. Historical Spanish is translation memory, not release authority.

| Section | Current Phase 2A state | Known required treatment |
| --- | --- | --- |
| Acknowledgments | `UNIT_AUDIT_REQUIRED` | compare current names/wording/edition references |
| Introduction | `UNIT_AUDIT_REQUIRED` | revise Part IV/Score accuracy framing; verify dashboard wording |
| Chapter 1 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 2 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 3 | `UNIT_AUDIT_REQUIRED` | fresh parity + MP-19 `/go/c03` bridge |
| Chapter 4 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 5 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 6 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 7 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 8 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 9 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 10 | release-critical unit audit complete | replacements/translations still not drafted |
| Chapter 11 | `UNIT_AUDIT_REQUIRED` | fresh parity + MP-20 `/go/c11` bridge |
| Chapter 12 | `UNIT_AUDIT_REQUIRED` | fresh paragraph parity |
| Chapter 13 | MP-10/vintage audit complete | remainder still needs paragraph parity |
| Further Reading | `UNIT_AUDIT_REQUIRED` | compare current bibliography and explanatory copy |
| Appendix A | `UNIT_AUDIT_REQUIRED` | retire old Score glossary entry; compare all glossary definitions |
| Appendix B | new-translation map complete | full Spanish draft not yet generated |
| About the Author | `UNIT_AUDIT_REQUIRED` | compare current project-author wording |
| Index | `REGENERATE_AFTER_LAYOUT` | no historical page-reference reuse |

## Approximate source-size comparison

These are extraction-level word counts used only to identify where drift is largest; they are **not** translation-quality scores.

| Section | EN Candidate 2 words | Historical ES words | Interpretation |
| --- | ---: | ---: | --- |
| Introduction | ~1,667 | ~1,830 | comparable size; still requires semantic audit |
| Chapter 1 | ~1,980 | ~2,229 | moderate drift possible |
| Chapter 2 | ~1,969 | ~2,282 | moderate drift possible |
| Chapter 3 | ~1,990 | ~2,389 | bridge + possible copy drift |
| Chapter 4 | ~2,397 | ~2,957 | fresh audit required |
| Chapter 5 | ~2,184 | ~2,642 | fresh audit required |
| Chapter 6 | ~1,782 | ~2,172 | fresh audit required |
| Chapter 7 | ~1,966 | ~2,320 | fresh audit required |
| Chapter 8 | ~1,774 | ~2,148 | fresh audit required |
| Chapter 9 | ~1,628 | ~1,937 | fresh audit required |
| Chapter 10 | ~1,848 | ~3,998 | major governed rewrite already mapped |
| Chapter 11 | ~1,622 | ~1,976 | fresh audit + new bridge |
| Chapter 12 | ~2,042 | ~2,488 | fresh audit required |
| Chapter 13 | ~2,303 | ~2,880 | critical vintage delta mapped; remainder open |

Spanish naturally uses different word counts from English, so size difference alone cannot classify a unit. It is only a queue-prioritization signal.

## Additional high-risk occurrence mapping

Direct historical Spanish extraction places the retired Score-performance figures in:

- Chapter 10; and
- the Appendix/glossary `USD Impact Score` entry.

The three release-critical Score `tiempo real` uses are in:

- Chapter 10 case-study framing;
- Chapter 10 contemporaneous-success conclusion;
- Chapter 13 archive/hindsight claim.

Other generic uses of `tiempo real` elsewhere in the book are not automatically errors; they must be evaluated in their own context.

## Paragraph-audit rule for remaining sections

For every remaining section:

1. align current English paragraph/structured unit to historical Spanish unit or `NONE`;
2. compare meaning, factual claims, edition/version references, links, sources, compliance and terminology;
3. classify exactly one:
   - `REUSE_VERIFIED`
   - `REVISE_REQUIRED`
   - `NEW_TRANSLATION_REQUIRED`
   - `RETIRE_DO_NOT_REUSE`
4. record source identifiers and reason;
5. do not infer reuse from structural similarity;
6. do not carry historical page numbers into the new candidate;
7. apply the active Session 13E terminology controls;
8. route new Candidate 2 terminology through the terminology-review gap list;
9. preserve the publication HOLD.

## Batch E completion definition

This structural pass is complete when the deltas above are recorded.

Phase 2A itself remains incomplete until the remaining Introduction/Chapters 1–9/11–12/Chapter 13 remainder/Further Reading/Appendix A/About paragraph units are classified and reviewed.

No translation-candidate generation is authorized by this structural map.
