# Spanish audiobook — private part-heading boundary correction

**Checkpoint:** 2026-10-09. **Disposition:** private staging only; final acoustic listening and mastering HOLD. **Do not merge, publish, export as member final, or deploy Production.**

## Source of truth

*Read the Dollar First*, Spanish Edition 1.3 Candidate 1 (Google document `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`). These *section-part* headings are meant to precede the chapter that follows:

| Source line | Spoken heading | Correct beginning | Incorrect previous track ending |
|---|---|---|---|
| 582 | `PARTE III` | Chapter 9 / Track 11 | Chapter 8 / Track 10 |
| 632 | `PARTE IV` | Chapter 10 / Track 12 | Chapter 9 / Track 11 |
| 695 | `PARTE V` | Chapter 11 / Track 13 | Chapter 10 / Track 12 |
| 764 | `PARTE V` | Chapter 12 / Track 14 | Chapter 11 / Track 13 |
| 826 | `PARTE V` | Chapter 13 / Track 15 | Chapter 12 / Track 14 |

The source repeats `PARTE V` before each of Chapters 11, 12 and 13. Preserve all three headings and put each at the intended next chapter's opening; do NOT simply delete repeats.

## Final private corrected candidates (all PRIVATE / DO NOT PUBLISH)

| Track | Chapter | Unedited original composition | Final private boundary-corrected candidate | Original seconds | Candidate seconds |
|---|---|---|---|---:|---:|
| 10 | Chapter 8 | `66c4f264-0abd-4f33-97f4-45532cf8b702` | `2f2d2ff3-e05a-43a5-99af-4d789082a305` | 1011.931421 | 1010.937095 |
| 11 | Chapter 9 | `090cb5b9-2dd4-4197-a4f6-7053321eddb8` | `d154039c-2b7d-4002-9bd3-032e3531eef1` | 916.375501 | 916.026929 |
| 12 | Chapter 10 | `5856dedb-b4e4-4fec-aa74-94882956fa74` | `ade2a5e4-2b8d-4342-8fc4-1869f61cd42d` | 1089.593464 | 1089.772811 |
| 13 | Chapter 11 | `2b44f958-cc0f-4b6f-96a5-14d76f13e2c9` | `8644e0dc-4fc1-475a-ab30-85a53521445b` | 930.768972 | 930.629217 |
| 14 | Chapter 12 | `6d0cfdc6-410d-489c-b754-9430421be2ad` | `fc7b5ff2-9f63-4e36-ba53-00240cb05058` | 1168.013053 | 1167.664319 |
| 15 | Chapter 13 | `0c5ac266-93a5-4ed1-83a6-0238bb38120a` | `34e4b853-0b77-4a21-9830-f231a9045383` | 1346.011419 | 1347.663459 |

**Audio-conservation invariant:** six original durations total **6462.693830 s**; six corrected durations total **6462.693830 s**. **Difference 0.000000 seconds.** This validates aggregate timing preservation, NOT exact acoustic or language correctness.

**Editing method:** Agent Underlord created independent Descript duplicates, then moved the **already-recorded** heading audio at the word boundaries from source track ending to next track opening. Intermediate candidates were retained unselected. No chapter rerender, HeyGen regeneration, new media synthesis, public publish, member entitlement/storage or Production changes. Prior originals remain as listed.

## Specific final arrangements expected

- Track 10 begins `Capítulo ocho` and ends with the compliance conclusion, without trailing `Parte tres`.
- Track 11 begins `Parte tres` followed by `Capítulo nueve`; ends without trailing `Parte cuatro`.
- Track 12 begins `Parte cuatro` followed by `Capítulo diez`; ends without trailing `Parte cinco`.
- Track 13 begins `Parte cinco` followed by `Capítulo once`; ends without trailing `Parte cinco`.
- Track 14 begins `Parte cinco` followed by `Capítulo doce`; ends without trailing `Parte cinco`.
- Track 15 begins `Parte cinco` followed by `Capítulo trece`; ends with the full educational disclaimer.

### Independent QA gate

1. Export each **candidate** transcript, compare beginning/end markers and all normalized core narration tokens against its corresponding original, after removing only correctly relocated part-heading words. **QA readback was temporarily rate-limited during this checkpoint; not every candidate was independently reviewed yet.**
2. Listen around **all five source tail/destination opening joins** for clipping, repeated syllables, pauses, timbre differences, and correct part/chapter titles. Confirm no compliance ending was cut.
3. Chapter 13 final segment `15-23.mp3`: despite past Descript `speaker_label_detection_timeout`, existing audio remains 36.858775 seconds. Its final prepared script and Descript transcript match **67/67 normalized tokens exactly**. Speaker labels and audible ending must still be accepted separately; do NOT regenerate that clip.
4. Keep all selections labeled **PRIVATE BOUNDARY CANDIDATES, NOT APPROVED FINAL MASTERS** until listening/mastering and owner authorization.
5. Maintain PR #797 as draft and unmerged. Publication gate is independent and remains **OFF**.

**Existing Appendix B special gate:** corrected Track 18 source-reference candidate `6a251168-1d0d-4a9d-b9ea-daed1d1db016` still awaits private splice/acronym listening, despite successful transcript and offline mastering-trial metrics.
