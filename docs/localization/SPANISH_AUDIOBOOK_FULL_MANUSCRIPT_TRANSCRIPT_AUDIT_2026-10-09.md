# Spanish audiobook — entire private source/transcript audit

**2026-10-09. PRIVATE QA ONLY; manuscript unchanged, final mastering and release NOT approved.**

## Source and method

Source is the authoritative 1.3 Candidate 1 Google Doc, `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU` (2026-10-07 revision; 1,182 paragraphs). A distinct older working Google Doc `16rFyUWOvgHt5r7Axp52K56zUQzhhLWOVgGCRymChCWk` still contains older Edition 1.2 metadata and must not be substituted.

Independently retrieved Descript SRT transcripts for **all 20 selected private compositions** and compared each with its source-body chapter boundaries. The metric is the fraction of normalized (case/diacritics/punctuation removed) distinct five-token groups appearing in both text streams; it is NOT a word-error rate, legal proof, acoustic review, or 100% completeness certificate. ASR punctuation and spoken number rendering can legitimately differ.

| Track | Source 5-gram coverage | Transcript 5-gram source alignment |
| --- | ---: | ---: |
| 00 | 87.9% | 98.9% |
| 01 | 70.3% | 97.7% |
| 02 | 97.0% | 97.2% |
| 03 | 95.6% | 96.9% |
| 04 | 93.6% | 95.4% |
| 05 | 90.1% | 90.0% |
| 06 | 92.8% | 95.4% |
| 07 | 93.2% | 95.0% |
| 08 | 90.7% | 92.8% |
| 09 | 92.6% | 95.3% |
| 10 | 93.3% | 95.2% |
| 11 | 92.0% | 93.2% |
| 12 | 92.2% | 89.7% |
| 13 | 90.3% | 90.7% |
| 14 | 93.3% | 95.7% |
| 15 | 86.7% | 84.5% |
| 16 | 96.4% | 96.4% |
| 17 | 91.6% | 91.0% |
| 18 | 87.5% | 83.0% |
| 19 | 18.6% | 100.0% |

**Interpretation:** Most substantive chapters have source coverage approximately 87–97%, with similar transcript alignment. Track 01's source span contains front matter / table of contents not all narrated; Track 19's source span includes a long alphabetical index not narrated, explaining 18.6% source coverage with 100% transcript-source alignment. Do not treat these as missing-book defects. Appendix B's lower alignment reflects technical names, number rendering and previously documented repair material; review against actual spoken audio before any changes.

## Source-boundary findings outside the already approved reels

**One omitted repeated heading:** Edition 1.3 has repeated `PARTE I` before **Chapter 2 / Track04**, but the selected Track04 begins `Capitulo dos`, while Track03 ends without the repeated heading. An existing separate recording of `Parte uno` is available near the beginning of Track03; a future PRIVATE duplicate could reuse it after assessing the pause.

**Six headings on the preceding track's tail rather than at the next chapter opening:**

| Tail with recorded heading | Correct beginning in Edition 1.3 |
| --- | --- |
| Track04 / Chapter 2 ends `Parte dos` | Track05 / Chapter 3 |
| Track05 / Chapter 3 ends `Parte dos` | Track06 / Chapter 4 |
| Track06 / Chapter 4 ends `Parte tres` | Track07 / Chapter 5 |
| Track07 / Chapter 5 ends `Parte tres` | Track08 / Chapter 6 |
| Track08 / Chapter 6 ends `Parte tres` | Track09 / Chapter 7 |
| Track09 / Chapter 7 ends `Parte tres` | Track10 / Chapter 8 |

These findings are based on directly exported SRT and the body source headings. This differs from Chapters 8–13 handoffs already reviewed and corrected in separate PRIVATE compositions. Preserve repeated part headings; do **not** simply delete the recorded words. If edits are made, use isolated duplicates and retain original narrations. The owner PASS on earlier 51s/187s reels does not cover all six new tail/head transfers or the standalone Track04 opening.

## Additional editorial checks (no automatic changes)

- Track00 v2 opening and disclaimer, and the two private chapter/Appendix reels, have owner-reported scoped PASS; full 20-track listening remains pending.
- Appendix A first title is transcribed `Aprendais a` and Appendix B `Appendix B`; these are ASR uncertainty, not proof of pronunciation failure. Do not regenerate blindly, particularly after scoped owner PASS.
- Appendix B audio transcript at its end includes long production/audit identifiers; also Track00 speaks Candidate 1.3 build/version metadata. Confirm what belongs in the consumer audiobook versus internal audit text before final mastering. No canonical manuscript/copyright rewrite is authorized.
- Track19's alphabetic index is present in the source document after the author note but not read in the short Track19 recording; determine audiobook index handling editorially, not by treating five-gram recall as a missing chapter.

**Next gate:** Complete non-destructive heading transfers in private duplicates, independently verify both source/core transcripts and durations, obtain scoped acoustic acceptance, then actual 20-track rendered audio peak/LUFS checks and whole-book listening. All Production/member/publishing flags remain OFF. PR #797 remains DRAFT/unmerged.
