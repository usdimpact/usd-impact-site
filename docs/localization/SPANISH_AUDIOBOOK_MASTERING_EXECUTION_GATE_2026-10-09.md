# Spanish audiobook — controlled mastering execution gate

**State:** PREPARED / EXECUTION HELD. This is a sequencing and safety document, **not a mastering PASS** and not authorization to publish.

## Scope and provenance

- 20 private review compositions, in exact order, are pinned by ID in `docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json`.
- All chosen corrected Chapter 8–13 boundary compositions are private duplicates; the original chapters have not been replaced.
- The Appendix B repaired composition `6a251168-1d0d-4a9d-b9ea-daed1d1db016` is also a candidate, not a final master. The offline 8 ms faded version is **not** the audio inside that Descript composition.
- Full-book private metadata duration with selected Track00 v2 = **17,747.673118 s (4h 55m 47.7s)**. Reconfirm exact sum at the actual export.
- Human listening decision tracker: `docs/localization/SPANISH_AUDIOBOOK_LISTENER_SIGNOFF_TRACKER_2026-10-09.md`. This was drafted before the later **owner PASS on three limited private listening sections**; full 20-track acoustic sign-off remains PENDING.

## Stage 1 — safe tasks that may be performed before human listening

1. Freeze the 20 private source IDs and SHA-256 hashes of any recovered byte-exact source audio; do not overwrite originals.
2. Validate filenames, recording codec, mono channel count, sample rate, track order, source transcript and legal/compliance endings.
3. Design the offline QA measurements: integrated LUFS, true peak (dBTP), sample clipping, >5s silence detection, decoder errors, duration drift, chapter-boundary joins and tags/artwork.
4. Record all test outcomes as **measured QA only**, never as human-reviewed acoustic approval.
5. Resolve any audio download or export limitation explicitly; do not substitute older original tracks for edited Descript candidate tracks.

## Stage 2 — blocked until actual listening review

The following must be reviewed directly by ear and marked PASS/FAIL/UNCLEAR:

- Five Part III/IV/V relocation transitions (Chapters 8→9 through 12→13).
- Appendix B 18-03 splice: raw candidate versus offline 8ms-smoothed audition; decide which, if either, is acceptable. Inspect both cut points, intended source references and breath continuity.
- Appendix A/B opening pronunciation: `Apéndice A` and `Apéndice B`. ASR differences are not proof of an acoustic error.
- Chapter 13 concluding disclaimer and overall narrator consistency.

Any FAIL/UNCLEAR requires scoped correction in a **new private candidate** and repeat listening. No automatic PASS from transcript, sample amplitude or metadata.

## Stage 3 — final mastering after reviewed selection

1. Export or otherwise retrieve the actual **reviewer-selected** final private Descript composition for each of 20 tracks, using authorized private paths; verify composition IDs and sequence.
2. Apply a documented mastering standard consistently. Initial test target may be **−16 LUFS integrated** with ceiling **≤−1.5 dBTP** for mono voice, subject to listening and measured test; do not declare this an approved production standard until selected and verified.
3. Validate 20/20 outputs for decoder errors, loudness, true peak, unexpected long silence, clipping, correct source words, beginning/end handles, title and track metadata, and complete compliance notes.
4. Listen to the full 20-track exported set after encoding. A passed private short reel is not a whole-book listening PASS.
5. Produce a checksum manifest, total duration, track-level measurement report and rollback plan. Keep exports private and unlinked from user/member entitlements.

## Release boundary — independent authorization

Before any PR merge, public Descript publish, member-storage upload, payment/entitlement/access modification or Production deployment: verify **both** human acoustic QA sign-off and complete final mastering QA, followed by a **separate explicit release authorization**. Do not infer release permission from prior approval to continue QA.

**Current hold:** PR #797 DRAFT/UNMERGED, Descript publications 0, review manifest `public_allowed=false`, mastering PENDING, listener sign-off PENDING.

## Updated owner QA checkpoint - October 9, after source recovery

- Owner confirmed PASS on three private listening sections (Track00 v2, Part I 51.101s reel, Chapters8-13/Appendix 186.888s reel). This is **not** whole-book listening or final-master sign-off.
- The selected Track00 v2 composition is `ebe7f026-e369-4dd4-a184-9476a6482f5b`; its original remains preserved.
- Entire 20-track Edition 1.3 manuscript/SRT audit: `SPANISH_AUDIOBOOK_FULL_MANUSCRIPT_TRANSCRIPT_AUDIT_2026-10-09.md`.
- New Chapters2-8 part-heading transcript QA: `SPANISH_AUDIOBOOK_CH02_TO_CH08_HEADING_REVIEW_2026-10-09.md`. Six trailing headings and a repeated Part I missing before Chapter 2 require listening validation. The attempted two-duplicate Descript pilot stopped without edits due an unsafe media boundary.
- Appendix B original sources and reference repair archived privately before GitHub expiry; 16 source MP3s and the existing offline 8ms trial were measured. See `SPANISH_AUDIOBOOK_APPENDIX_B_SOURCE_RECOVERY_AND_SIGNAL_QA_2026-10-09.md`. All 16 unmastered source MP3s exceed provisional -1.5 dBTP true-peak; the smoothed offline trial measures -16.31 LUFS / -2.21 dBTP. These are NOT the selected final Descript renders.
- Final blocker remains the absent actual selected 20-track Descript rendered audio for offline measurement and full-length human listening. Do not substitute old MP3s or the Track00 v1 WAV.

**Latest state: private source backups PASS; targeted listening PASS; 20/20 metadata present; additional chapter-heading audible verification PENDING; actual mastering and release HOLD. PR #797 remains DRAFT, zero Descript public publishes, Production/member delivery OFF.**
