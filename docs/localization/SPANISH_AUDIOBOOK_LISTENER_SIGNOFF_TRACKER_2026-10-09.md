# Spanish audiobook — human listening sign-off tracker

**Status: FAIL reported at Track 00 opening (00:47.07); all further listening PENDING. No full-book acoustic approval.**
**Private project:** https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca
**Private reel:** `6b7b9e26-bde5-4b1b-a9f1-3346966a26c6` (3:06.888; 13 markers; excerpts play without inserted silence).
**Private appendix B A/B audition kit:** `/spanish-audiobook-appendix-b-8ms-private-listening-kit-2026-10-09.zip` in Library.
**Private full smoothed trial:** `/spanish-audiobook-appendix-b-8ms-private-mastering-trial-2026-10-09.mp3` in Library.

## User-reported listening defect — October 9

- **Track 00 opening click:** **FAIL (listener-reported)** near `00:47.07`, at `Este libro tiene un propósito exclusivamente educativo e informativo.` The listener stopped there. Cause not yet independently verified.
- **Copyright paragraph grammar:** parallel-list issue identified in opening copyright notice. Editorial candidate proposed only, no canonical or audio revision, legal sign-off required.
- **Remediation evidence:** `docs/localization/SPANISH_AUDIOBOOK_OPENING_TRACK_CLICK_GRAMMAR_QA_2026-10-09.md`.
- **All subsequent listening checkpoints: PENDING**; no implied approval.

## Reviewer decisions (unfilled until actual listening)

Use PASS / FAIL / UNCLEAR, add evidence or a timecode. Do not mark PASS from transcript or waveform alone.

| Check | Approx. reel time | Status | Evidence / issue |
|---|---|---|---|
| 1. Chapter 8 → 9: Parte tres | 0:00–0:16 | PENDING | |
| 2. Chapter 9 → 10: Parte cuatro | 0:16–0:32 | PENDING | |
| 3. Chapter 10 → 11: Parte cinco | 0:32–0:48 | PENDING | |
| 4. Chapter 11 → 12: Parte cinco | 0:48–1:04 | PENDING | |
| 5. Chapter 12 → 13: Parte cinco | 1:04–1:20 | PENDING | |
| 6. Appendix B original/corrected reference seam; ICE, CME/NYMEX, S&P Dow Jones, Cboe, Treasury/FRED | 1:20–2:06; A/B clips at 0:14.84 and 0:47.12 | PENDING | |
| 7. Chapter 13 compliance ending | 2:06–2:46 | PENDING | |
| 8. Appendix A Spanish opening title | 2:46–2:57 | PENDING | |
| 9. Appendix B Spanish opening title | 2:57–3:07 | PENDING | |
| 10. Overall click, breath continuity, volume, pronunciation | Across reel and A/B comparison | PENDING | |

**Appendix title review evidence:** `docs/localization/SPANISH_AUDIOBOOK_APPENDIX_TITLE_PRONUNCIATION_QA_2026-10-09.md` documents source wording versus ambiguous speech-to-text only. The two title checks must remain PENDING until actual listening. Do not regenerate from ASR alone.

## Additional front-matter listening gate — October 9

- **Introduction → Chapter 1 boundary:** PENDING — new Intro candidate `aecc180b-4513-455b-a3e4-fce58da36fac` and new Chapter 1 candidate `686a4f65-8ff9-4141-aedb-bab9b4296602`. Listen to the restored mid-Introduction `la parte uno` near 07:59, the final 10s of the Intro, and first 8s of Chapter 1. Check for altered pauses, duplicate headings, silence, and clip artifacts.
- Evidence: `docs/localization/SPANISH_AUDIOBOOK_PART_I_FRONTMATTER_BOUNDARY_QA_2026-10-09.md`.
- **Status: PENDING — not approved by transcript equality alone.**

## Reviewer declaration

- Reviewer name / role: **NOT PROVIDED**
- Listening date: **NOT PROVIDED**
- Overall acoustic decision: **FAIL — Track 00 click reported; remaining content unreviewed**
- Defect tickets and exact timecodes: **NONE FILED — NOT EQUIVALENT TO PASS**
- Preferred Appendix B seam: **UNDECIDED** (Descript candidate / offline 8ms-smoothed alternative / neither)
- Permission to start production mastering: **NOT GRANTED BY THIS TRACKER**
- Permission to publish, merge PR, upload to member storage, or deploy Production: **NOT GRANTED**

## Machine checks already passed (not substitutes for listening)

- Six corrected Chapters 8–13 preserve 13,229 normalized core narration words, with intended part headings moved to correct opening.
- 20 private review tracks listed; all release flags OFF.
- Independently reconstructed Appendix B 8ms trial: 14:43, −16.31 LUFS, −2.21 dBTP, decoding PASS, no >5s silence at tested threshold.
- **Important:** Descript's editing interface cannot apply a verified 8ms fade; it did not change the actual Descript master/candidate. A/B smoothed audio exists only as private offline reconstruction.

## Gate to advance

Only after a real listener marks each checkpoint and supplies specific comments can accepted edits be selected for final mastering. Any FAIL/UNCLEAR must remain open until corrected and re-reviewed. After listening, conduct consistent mastering and a whole-book listen; require **separate explicit release authorization** for Production, member access, public Descript publishing or PR merge.

Current controls: PR #797 **draft/unmerged**, Descript public compositions **0**, Production/member distribution **OFF**.

## Owner approval — shortened Track 00 (2026-10-09)

- Owner approved continuing with the new shorter Mateo reproduction, excluding the spoken version/production-build announcement. Candidate private offline file: `/spanish-audiobook-track00-mateo-no-version-private-2026-10-09.wav`, approximately 1:45.31, preserved in Library.
- **Original Track 00:** listener reported clicks/poor narration — FAIL and archived, Descript original composition `91240c6b-78df-4910-a994-43c616f9b53f` remains untouched.
- **Shortened replacement:** approved for continuing **private QA only**; it has not been imported into Descript or independently approved for mastering/publication. The remaining frontmatter and chapter-join checks remain pending.
- Compliance/copyright text must not be silently altered or released without legal/editorial acceptance. NO PR merge, public publishing, member access, or Production change.
