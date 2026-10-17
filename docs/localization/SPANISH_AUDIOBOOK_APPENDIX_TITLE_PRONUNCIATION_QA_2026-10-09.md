# Spanish audiobook — Appendix A/B spoken-title pronunciation QA

**Status: HUMAN LISTENING REQUIRED. This is NOT evidence of a spoken error and NOT permission to regenerate.**

## Exact source versus independent speech-to-text

| Private track | Approved written speech source | Current Descript transcript opening | Disposition |
|---|---|---|---|
| 17, Appendix A | `APÉNDICE A. Glosario rápido` | `Aprendáis a glosario. Rápido.` | **UNCLEAR** — ASR may misrecognize `Apéndice A`, punctuation and word spacing |
| 18, repaired Appendix B candidate | `APÉNDICE B. Metodología de la USD Impact Score` | `Appendix B: Metodología de la USD Impact Score.` | **UNCLEAR** — may be an ASR language substitution or actual English-accent pronunciation |

Source prepared scripts:
- `docs/localization/spanish-audiobook-track-17/segment-01.txt`
- `docs/localization/spanish-audiobook-track-18/segment-01.txt`

Existing private Descript compositions:
- Appendix A: `625d0a1a-1bf2-42ac-b363-cb8b525e660b`
- Appendix B, corrected QA candidate: `6a251168-1d0d-4a9d-b9ea-daed1d1db016`

## Acceptance checklist

Listen to the first 10 seconds of each original audio (also included near **2:46–3:07** in the 3:06.9 private listening reel `6b7b9e26-bde5-4b1b-a9f1-3346966a26c6`).

- **Appendix A:** Is `Apéndice A` unmistakably spoken in Spanish? Is `Glosario rápido` clear and naturally separated?
- **Appendix B:** Is `Apéndice B` spoken in Spanish, not `Appendix B` in English? Are `Metodología` and the branded `USD Impact Score` clear?
- Note any silence, clipped first syllable, odd intonation, language-switch or duplicated title.

Record PASS / FAIL / UNCLEAR in `docs/localization/SPANISH_AUDIOBOOK_LISTENER_SIGNOFF_TRACKER_2026-10-09.md` after **actual listening**.

If FAIL, prepare a **short, narrowly scoped** replacement of only the affected opening words in a separate private candidate; obtain acoustic QA before accepting it. Do not regenerate a whole appendix, edit original compositions or spend API credits based only on these speech-recognition transcripts.

**Global status:** publication, member access, PR merge and Production remain HOLD. Human listening and final mastering pending.
