# Appendix B / Segment 18-03 — private audio repair plan (2026-10-09)

**Status: QA HOLD — suspected material spoken omission; DO NOT PUBLISH.** This document is preparation only. It does not authorize a synthesis request, manual trigger, plan purchase, Production change, or Descript publish.

## Exact source and boundaries

- Source: *Read the Dollar First*, Spanish Edition 1.3 Candidate 1, Appendix B, `Divulgación del proveedor de producción`.
- Existing prepared source text: `docs/localization/spanish-audiobook-track-18/segment-03.txt`.
- Existing private Descript master: `2f542797-4a70-4d44-a164-76dee15859ca`; Appendix B composition `aef945b9-0b31-48ad-9ec6-270c80f639c7`.
- Original media `18-03.mp3`, from successful funded run `37842325398` and short-lived artifact `11577893181`. **Keep this file; do not overwrite blindly.**

## Finding

- Original segment 03 submitted text includes the complete institutional verification sentence quoted below.
- HeyGen provider `word_timestamps` enumerated every submitted word, leading to an apparent 100% script/timestamp-text match. **However, 16 consecutive words in the institutional source-reference passage have zero durations at the same timestamp, 39.4565 seconds.**
- Independent Descript audio-to-text transcription, obtained after the clip 03–08 transcription repair job completed, omitted approximately **28 normalized source words** around this same section; it moves directly from `...no elimina la disciplina de fuentes del libro.` to `FRED para rendimientos y referencias institucionales...`.
- The affected area is around **39.46–41.0 seconds of segment 03**; segment 03 begins at **131.94 seconds** in the composition, so review **02:51–03:01** in the private Descript timeline.
- Conclusion: the missing source passage is **suspected to be omitted or unintelligibly compressed in the audio**, not merely an ASR spelling difference. Provider timestamp text alone must not be used to clear the discrepancy.

## Exact sentence for proposed sentence-level remediation

Las afirmaciones importantes deben poder contrastarse con ICE para DXY, CME/NYMEX para WTI, S&P Dow Jones Indices para S y P quinientos, Cboe para VIX, Treasury/FRED para rendimientos y referencias institucionales o de benchmark claramente identificadas para oro y Bitcoin.

When permitted by credits and after acoustic confirmation, prefer a **targeted sentence-level Mateo resynthesis** using this exact approved source sentence, `es-419`, speed `0.92x`. Avoid a full rerun of unaffected Chapter/Appendix B segments. Keep the original `18-03.mp3` until the replacement is verified; do not splice or overwrite without listening and timeline QA.

## Acceptance criteria after repair

1. Verify the sentence is actually audible and unambiguous, especially `ICE`, `CME/NYMEX`, `S&P Dow Jones Indices`, `Cboe`, `Treasury/FRED`.
2. No duplicate or overlapping sentence remains from original `18-03.mp3`; exact transcript/audio source order restored.
3. The scoring equations and all eight weights/signs remain intact in subsequent Appendix B clips.
4. Verify speech and translation quality across stitch point and natural loudness/peaks, then run the full source/independent transcript QA again.
5. Keep member delivery, commerce/auth, entitlement, GitHub merge, public Descript publish and Production **HOLD** until separate approval.

## Credit constraints

As last verified, HeyGen Creator premium credits are **0**, with next reset `2026-10-13T19:31:48Z`. Do not modify the auto-trigger while credits are zero; do not pay to bypass the hold.
