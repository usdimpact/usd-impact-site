# Spanish audiobook — controlled mastering execution gate

**State:** PREPARED / EXECUTION HELD. This is a sequencing and safety document, **not a mastering PASS** and not authorization to publish.

## Scope and provenance

- 20 private review compositions, in exact order, are pinned by ID in `docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json`.
- All chosen corrected Chapter 8–13 boundary compositions are private duplicates; the original chapters have not been replaced.
- The Appendix B repaired composition `6a251168-1d0d-4a9d-b9ea-daed1d1db016` is also a candidate, not a final master. The offline 8 ms faded version is **not** the audio inside that Descript composition.
- Full-book private metadata duration approximately 4 h 55 m 51 s. Confirm exact sum again at any future export.
- Human listening decision tracker: `docs/localization/SPANISH_AUDIOBOOK_LISTENER_SIGNOFF_TRACKER_2026-10-09.md`. As of writing, there is **no listening sign-off**.

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
