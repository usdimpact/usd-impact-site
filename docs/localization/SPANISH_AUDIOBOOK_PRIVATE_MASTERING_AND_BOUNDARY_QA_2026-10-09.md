# Spanish audiobook — private mastering and chapter-boundary QA

**Date:** 2026-10-09  
**GitHub PR:** #797 (DRAFT, unmerged)  
**Descript project:** `2f542797-4a70-4d44-a164-76dee15859ca`  
**Release disposition:** **HOLD** — private listening, chapter-boundary cleanup, full-book mastering and separate publication approval remain required.

## Private selection control

All 20 expected audiobook tracks (00–19) have a verified private-review composition ID in `docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json`. This is **not a publishing manifest**; its release flags are explicitly false. It avoids selecting obsolete/partial private compositions for corrected Introduction, Chapter 1, Chapter 4, or Appendix B.

Appendix B original composition: `aef945b9-0b31-48ad-9ec6-270c80f639c7`, duration **859.063 s**.  
Appendix B private repaired candidate: `6a251168-1d0d-4a9d-b9ea-daed1d1db016`, duration **883.028 s**.  
Closing track: `1d15c8e2-dc3f-4c2d-9b95-b84a435dcb0b`, duration **43.598 s**.

## Objective audio-file QA

Using existing private HeyGen artifacts and unmodified source audio:

- **15/15** Appendix B raw MP3 segments exist with **15 distinct SHA-256 hashes**.
- **19/19** sampled files decode successfully: 15 Appendix B segments, closing track, and three standalone QA samples (original 18-03, repaired 18-03 short preview, reference sentence).
- The 15 original Appendix B segments have an integrated loudness range of **−16.29 to −15.81 LUFS**. Raw true peaks range **−0.40 to +0.11 dBTP**, so final peak-level control is needed.
- A previously flagged Appendix B segment 03 *text alignment* discrepancy was resolved in an isolated repaired Descript candidate; this does not prove subjective speech intelligibility without listening.

### Non-destructive full-length mastering trial

A separate **offline QA trial**, NOT exported from Descript and NOT approved for publication, was reconstructed from all 15 original Appendix B MP3s. Only in this test audio, segment 18-03 was trimmed at **40.89 s**, the independently transcript-checked **32.287 s** reference sentence was placed immediately after, then original segments 18-04 through 18-15 followed unchanged in order. A peak-limited loudness test was encoded as 44.1 kHz mono MP3, 192 kb/s.

| Metric | Verified QA trial |
|---|---:|
| Duration | **883.069 s / 14:43** |
| Descript private candidate duration | **883.028 s** |
| Post-encode integrated loudness | **−16.27 LUFS** |
| Post-encode true peak | **−2.21 dBTP** |
| MP3 decode errors | **0** |
| Continuous silence longer than 5 s at −45 dB threshold | **0** |
| Auditory sign-off | **PENDING** |

Measured sample jump at the first seam (172.834 s of the complete offline trial) was **0.054** versus local decoded-window 99th-percentile adjacent-sample jump **0.115**. This did not reveal an abnormally large digital discontinuity at the tested cut, but **is not evidence of natural-sounding narration, pronunciation, breath continuity, or click-free subjective audio**.

The offline trial is **not** an approved master or a substitute for listening to the actual Descript duplicate. The ~0.042 s duration difference should be treated as an encoding/assembly discrepancy until independently reviewed.

**Private Library outputs, not public distribution:**

- `/spanish-audiobook-appendix-b-private-mastering-trial-2026-10-09.mp3` — SHA-256 `dac60fb2651b70c7e6c772e389e09c6d895adb9327c3ac13815cd766b8bb2cbd`
- `/spanish-audiobook-appendix-b-private-QA-mastering-trial-2026-10-09.zip` — SHA-256 `8ef9b67c992590fdd5680810033f58fb26ffc46449e728aac61973dbea14b7b3`. ZIP integrity PASS, 7 entries, includes offline HTML audio player and exact splice checkpoints. No installation/network required after extraction.

## Editorial transition issues — require separate cleanup

Read-only private Descript transcript inspection (these are *transcript-based* findings, not confirmed audible outcomes):

| Track | Chapter | Unexpected trailing heading in transcript |
|---|---|---|
| 10 | Chapter 8 | `Parte tres` |
| 11 | Chapter 9 | `Parte cuatro` |
| 12 | Chapter 10 | `Parte cinco` |
| 13 | Chapter 11 | `Parte cinco` |
| 14 | Chapter 12 | `Parte cinco` |

The last three are repeated, suggesting unwanted part-label carryover. Confirm their intended source position before any edit. If confirmed extraneous, remove from **private staging duplicates only** using word-boundary editing, verifying adjoining audio and not blindly resynthesizing entire chapters. Do not alter the source editions or locked originals during QA.

Additional pronunciation/review checks:

- Appendix A opening exported as `Aprendáis a glosario. Rápido` (likely ASR for `Apéndice A — Glosario rápido`): listen to verify actual pronunciation rather than assuming an audio error.
- Appendix B opening transcribes `Appendix B` instead of `Apéndice B`: listen to confirm local-language title quality.
- Chapter 13 last segment `15-23` had `speaker_label_detection_timeout` while audio remained present; check its spoken compliance ending and transcription independently, **no duplicate generation**.

## Next gated sequence

1. Listener opens the offline QA kit or Descript's private repaired candidate. Check seam **02:52.8 / 03:25.1**, ICE, CME/NYMEX, S&P Dow Jones Indices, Cboe, Treasury/FRED, repetition, pace and timbre. Mark PASS/FAIL explicitly.
2. Confirm intentional placement of `Parte tres`, `Parte cuatro`, and repeated `Parte cinco`; repair non-destructively only if extraneous.
3. Complete chapter 13 segment 23 listening/transcript recovery and Appendix A/B heading pronunciation checks.
4. Prepare complete 20-track final mastered delivery set from approved compositions with consistent true-peak and LUFS controls; run full-scope QA, chapter sequence and closing disclaimers.
5. Obtain **separate explicit authorization** before any PR merge, Descript public publish, Production deployment or member-storage/entitlement changes.

**Current confirmed control:** Descript publishes = 0; PR #797 draft and unmerged; no Production/audio commerce/access change authorized.
