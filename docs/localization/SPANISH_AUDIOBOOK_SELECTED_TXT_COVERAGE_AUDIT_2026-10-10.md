# Spanish audiobook — selected TXT coverage audit (2026-10-10)

**Private QA evidence only — release HOLD.** Scope: selected Spanish Edition 1.3 Candidate 1 Descript transcripts against authoritative manuscript. No acoustic testing, voice regeneration, editing, publication, Production changes or merge.

## Inputs and selection

- Authoritative source: Google Doc `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU` (Spanish Edition 1.3 Candidate 1 — WORKING HOLD).
- Canonical selected review set: [20-track private manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json), tracks 00–19; all review IDs immutable during this scan.
- Audio-text source: read-only Descript **TXT** exports of the canonical selected private compositions in project `2f542797-4a70-4d44-a164-76dee15859ca` (not historical originals or alternate candidates).

## Bounded repeatable method

1. Partition manuscript paragraphs into selected track ranges, excluding the printed `Contenido` (page-numbered table of contents) and `Índice analítico` (print page-reference index). Track 00 is treated separately below.
2. For tracks 01–19, inspect narrative paragraphs of at least **28 normalized tokens** with no literal URL. Normalize Unicode accents, case, punctuation and whitespace; do **not** normalize units, equations, spelled numerals, abbreviations or speaker text.
3. Sample three consecutive **eight-token exact phrase anchors** from each eligible source paragraph, starting at approximately 11%, 42% and 75% of the source word sequence. Search for each exact normalized anchor in the selected track TXT.
4. Count **3/3**, **1–2/3**, or **0/3** anchors. Zero-match paragraphs require a manual check against source narration segments and surrounding Descript TXT, since ASR, natural numbers and acronyms can change exact word forms.
5. These counts are **sparse probe coverage only**. Three phrase hits cannot establish every intervening word, entire printed paragraph, exact audio articulation, copyright approval, clip completeness, timestamps, mastering quality, or release readiness. Short paragraphs, table cells, references, live links and formulas with fewer than 28 tokens are not exhaustively checked.

## Result: tracks 01–19

| Private track | Content | Eligible paragraphs | 3/3 anchors | 1–2/3 anchors | 0/3 anchors |
| --- | --- | ---: | ---: | ---: | ---: |
| 01 | Acknowledgments and guide | 4 | 4 | 0 | 0 |
| 02 | Introduction | 25 | 24 | 1 | 0 |
| 03 | Chapter 1 | 28 | 25 | 3 | 0 |
| 04 | Chapter 2 | 28 | 28 | 0 | 0 |
| 05 | Chapter 3 | 23 | 21 | 2 | 0 |
| 06 | Chapter 4 | 33 | 28 | 5 | 0 |
| 07 | Chapter 5 | 28 | 26 | 2 | 0 |
| 08 | Chapter 6 | 27 | 23 | 3 | 1 |
| 09 | Chapter 7 | 28 | 26 | 2 | 0 |
| 10 | Chapter 8 | 30 | 27 | 3 | 0 |
| 11 | Chapter 9 | 22 | 19 | 3 | 0 |
| 12 | Chapter 10 | 34 | 27 | 7 | 0 |
| 13 | Chapter 11 | 24 | 19 | 5 | 0 |
| 14 | Chapter 12 | 27 | 25 | 2 | 0 |
| 15 | Chapter 13 | 36 | 26 | 10 | 0 |
| 16 | Further reading | 1 | 1 | 0 | 0 |
| 17 | Appendix A (glossary) | 36 | 20 | 15 | 1 |
| 18 | Appendix B (methodology) | 19 | 12 | 6 | 1 |
| 19 | About the author | 1 | 1 | 0 | 0 |
| **Total (01–19)** | **Sparse eight-token probes** | **454** | **382** | **69** | **3** |

**All 454 eligible source paragraphs had either one or more literal anchors (451), or separately traced speech-adapted content (3), without a confirmed missing passage.** Do not report this as a complete audiobook parity pass.

## The three 0/3 cases — individually investigated

| Track / manuscript paragraph | Why the literal anchor scan fails | Positive follow-up evidence | Disposition |
| --- | --- | --- | --- |
| 08 / paragraph 436: gold 2021–2022 worked numbers | Printed dates, `DFII10`, `1.800`, `250`, `1.650` expressed as spoken words; clauses split across segments | Prepared track08 source segments 13 and 14 retain the full example; selected private Descript TXT contains start and end of example, real-rate change, cost-of-opportunity explanation and spoken amounts | **Present at TXT content level**; DFII10 pronunciation/acronym exactness pending final listening |
| 17 / paragraph 1038: MXN glossary | `USD/MXN` and `EE. UU.` expanded to `dólar frente al peso mexicano`, `Estados Unidos`; spans segment boundary | Prepared track17 source segments 11 and 12 hold the entry and its explanation; selected private TXT contains `Usado como par representativo dólar emergentes`, `Dólar frente al peso mexicano`, types/oil/trade risk clause | **Present at TXT content level**; heading is transcribed awkwardly as `Mil pesos mexicano` and exact MXN enunciation pending final listening |
| 18 / paragraph 1079: Score normalization definitions | Formula names `mean(i,T)`, `sd(i,T)` and `2015-01-01` expanded as speech; no exact eight-word print anchors | Prepared track18 source segment 05 verbalizes full-sample mean, sample standard deviation and production start date; selected private TXT includes `La media de IT`, `desviación estándar muestral`, `1 de enero de 2015` | **Present at TXT content level**; formula-letter and v2 notation remain targeted spoken-accuracy QA items |

**No text correction or new private generation is recommended solely from these sparse-probe exceptions.** Literal 0/3 is not evidence of a missing recording. Conversely, ASR-provided paraphrases do not close phonetic accuracy or quantitative-data pronunciation.

## Track 00 special legal-text check

Track 00 is excluded from the 454 count. The selected private TXT and authoritative manuscript match **61/61 normalized ordered tokens** in the rights restrictions/exception paragraph and **68/68 normalized ordered tokens** in the educational/non-advice paragraph. The printed opening label `Copyright © 2026` differs from selected private transcript `USD Impact. 2026` and still needs explicit editorial/legal acceptance. See [non-audio closeout](./SPANISH_AUDIOBOOK_NON_AUDIO_CLOSEOUT_2026-10-10.md).

## Acceptance boundaries

- Source/selected-track presence and sampled coverage: **COMPLETE within method above**.
- Printed TOC/index adaptation, copyright adaptation and publication-candidate metadata: **PENDING editorial/publisher decision**.
- Appendix B exact spoken pipeline commit SHA, `MXN` and quantitative acronym/formula pronunciation: **PENDING final targeted acoustic review**; prepared source and source-commit provenance previously checked.
- Full whole-track listening, actual 20 WAV exports, encoded-master measurements, legal clearance and distribution approval: **PENDING / DEFERRED LAST**.
- Preserve `production_enabled=false`, `public_allowed=false`, `merge_allowed=false`, private-synthesis approval absent, `mastering_approval=PENDING`. PR #797 **DRAFT and unmerged**. No publication or member delivery.

This is a **read-only manuscript/TXT comparison record**. It does not provide legal approval or authorize changing the selected Descript project.
