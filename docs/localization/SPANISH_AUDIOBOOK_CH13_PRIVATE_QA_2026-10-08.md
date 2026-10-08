# Chapter 13 — Spanish audiobook private QA checkpoint (2026-10-08)

**Track:** 15 — `Qué vigilar a partir de aquí`  
**Disposition:** PRIVATE AUDIO ASSEMBLY AND TRANSCRIPT/SOURCE QA PASS; FINAL LISTENING / MASTERING HOLD  
**Publication:** HOLD (no member delivery, no Production changes, no public Descript publish).

## Canonical production

- Source: Spanish Edition 1.3 Candidate 1, Google Drive ID `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`, source lines 827–950.
- Voice: **Narrator Mateo** (`626ca51acb2e496f8dcee8d7591fda3c`), `es-419`, `0.92x`.
- Private Descript project: `2f542797-4a70-4d44-a164-76dee15859ca`.
- Private full composition: `0c5ac266-93a5-4ed1-83a6-0238bb38120a`.
- Batch A: segments 1–12, GitHub run `37837533744`, artifact `11576786039`, 721.398 seconds.
- Batch B: segments 13–23, GitHub run `37838725606`, artifact `11576014130`, 624.614 seconds; artifact SHA-256 `8f1659c91afbab1518ea92f681b071bb2ffa455488d0a4b978efef5d3a46aa30`.
- Canonical composition: **23/23 media clips**, **1,346.011 seconds (~22:26)**; exact sum of generated segment durations.
- All 23 MP3 files independently probed and decoded, 44.1 kHz, with 23 distinct SHA-256 audio hashes. None were generated twice in the canonical track.

## Transcript QA versus prepared narration

- Batch A (1–12): **98.59%** exact normalized token alignment, no multiword omission blocks.
- Batch B (13–23): **98.65%** exact normalized token alignment, no material multiword omission found.
- Minor normalization differences include hyphenated compound words, numbers spoken as Spanish words, acronym transcription, and punctuation.

## Original-book source reconciliation

- Source section after omitting literal citation URLs: **2,657 normalized tokens**.
- Descript chapter transcript: **2,752 normalized tokens**.
- Exact normalized token matches: **2,583 (97.21%)**. This is an **exact-text metric**, not a direct semantic accuracy percentage, because audio narration restructures source tables and verbalizes labels and numerals.
- A five-token alignment gap (`Por qué importa / Fuente prioritaria`) is the original table header, **not an omitted material claim**: the audio repeats both labels row by row with each corresponding question, explanation, and institution. The six-step decision table is narrated row-by-row with confirmation and challenge conditions.
- Source institutions, weekly operational prompts, selected references, and educational/legal compliance disclaimer remain audible in the exported transcript.
- No material prose omission or changed compliance meaning found during transcript/source comparison; separate final listening QC is still required.

## Outstanding non-release gates

1. **Descript import terminal result: PARTIAL.** Batch B audio files 13–23 are all visible in the private composition, and the 22:26 timeline plus end-of-chapter transcript are complete. Clips 13–22 have `media_status=success`; clip `15-23.mp3` has `media_status=failed` because `speaker_label_detection_timeout` despite existing 36.858775 seconds of audio in the composition. This is a transcription speaker-label service exception, **not** evidence of a missing or silent segment. Retain the canonical audio; do not regenerate HeyGen speech or append a duplicate clip. Verify the final clip's playback and speaker-label requirements during finishing QA.
2. Complete a full listening, pronunciation, and transitions pass, including the Part V repeated heading issues in prior chapters.
3. Apply final mastering, peak-level control, and accurate MP3 naming. Verify chapter order and metadata in final masters.
4. Perform whole-audiobook acceptance QA including front matter, Chapters 1–13, further reading, appendices, and closing track.
5. Obtain independent owner approval before any public publish, member Storage upload, entitlement change, or Production deployment.

Private synthesis may continue to Track 16 (Further Reading) after this checkpoint. This does **not** authorize member release or any payment/billing change.
