# Spanish audiobook — private listening acceptance reel

**Date:** 2026-10-09  
**Status:** QA-only, NOT APPROVED for release. No Production, member Storage, public Descript publishing or PR merge.

**Private Descript project:** `2f542797-4a70-4d44-a164-76dee15859ca`  
**Private QA reel composition:** `6b7b9e26-bde5-4b1b-a9f1-3346966a26c6`  
**Title:** `QA - Spanish Audiobook Boundary and Repair Listening Reel - DO NOT PUBLISH`  
**Verified duration:** **186.888078 seconds (3:06.9)**  
**Browser:** https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca

This new audio-only composition is built solely from copies of already-recorded media in existing private chapters; no additional HeyGen synthesis, credit purchase or other rendering/export was performed. All source compositions are unchanged. The reel contains 13 **written chapter markers** for jumping between samples. It has **no intentionally inserted silence between excerpts**; sample changes are marked only by the timeline/markers, so do not assess seam naturalness *across* unrelated reel sections.

## Listener checklist

Mark **PASS / FAIL / UNCLEAR** separately for each row; do not interpret ASR output as confirmation that the spoken sound is correct.

| Approximate reel time | What to hear | Specific pass condition |
|---|---|---|
| 0:00–0:16 | Chapter 8 compliance ending → `Parte tres` + Chapter 9 opening | Closing legal language intact, part heading correctly precedes next chapter, no clipped or doubled syllables |
| 0:16–0:32 | Chapter 9 ending → `Parte cuatro` + Chapter 10 opening | Correct order, no repeated heading on earlier track, no sudden change in voice or level |
| 0:32–0:48 | Chapter 10 ending → `Parte cinco` + Chapter 11 opening | Chapter 10 disclaimer complete; next part heading cleanly spoken |
| 0:48–1:04 | Chapter 11 ending → second `Parte cinco` + Chapter 12 opening | Repeated source heading is intentional and positioned correctly; join sounds natural |
| 1:04–1:20 | Chapter 12 ending → third `Parte cinco` + Chapter 13 opening | Compliance ending intact; final Part V heading at Chapter 13 start |
| 1:20–2:06 | Private Appendix B repaired segment 03, approximately 165–211s of full candidate | No overlapping/doubled narration at either splice; all institutional names audible and correctly pronounced: ICE, CME/NYMEX, S&P Dow Jones Indices, Cboe, Treasury/FRED |
| 2:06–2:46 | Last 40s of private corrected Chapter 13 | Full source references and educational non-advice disclaimer intelligible through final `Verifica los datos actuales antes de utilizarlos` |
| 2:46–2:57 | Appendix A opening | Title intelligibly spoken in Spanish as `Apéndice A — Glosario rápido`; transcriber previously produced `Aprendáis a glosario. Rápido` so direct listening is required |
| 2:57–3:07 | Appendix B repaired candidate opening | Title intelligibly spoken in Spanish as `Apéndice B — Metodología de la USD Impact Score`; exported transcript said `Appendix B`, which may be ASR noise or real pronunciation |

### Listener response template

- **Transitions 1–5:** PASS / FAIL / UNCLEAR (specify transition number and issue).
- **Appendix B splice / reference pronunciation:** PASS / FAIL / UNCLEAR.
- **Chapter 13 end disclaimer:** PASS / FAIL / UNCLEAR.
- **Appendix A title:** PASS / FAIL / UNCLEAR.
- **Appendix B title:** PASS / FAIL / UNCLEAR.
- **Overall voice, breath continuity, clicks and loudness:** PASS / FAIL / UNCLEAR.

**Do not approve by absence of waveform spikes or high transcript match alone.** Those are technical checks and cannot substitute for a human listening decision.

## Evidence and current gate

- 20 private review tracks: 4h 55m 51s selected audio, validated composition IDs and duration metadata; **all release flags OFF**.
- Source-corrected heading transfers (tracks 10–15): **13,229/13,229 exact normalized core narration words** matched and total six-track duration preserved **6462.693830s**. All original tracks remain intact. Evidence: `docs/localization/SPANISH_AUDIOBOOK_PRIVATE_PART_BOUNDARY_CORRECTION_2026-10-09.md`.
- Appendix B corrected candidate: 95.75% normalized exact-token text alignment, no material multi-word omitted passage detected; private offline mastering test **−16.27 LUFS / −2.21 dBTP**, not an approved Descript export. Evidence: `docs/localization/SPANISH_AUDIOBOOK_PRIVATE_MASTERING_AND_BOUNDARY_QA_2026-10-09.md`.
- Descript has **0 published compositions**; PR **#797** remains draft/unmerged.
- **Once listener results are received:** fix only any failed sections in new private candidates; then complete all-20-track mastering and quality control. Separate explicit authorization remains required for member/public release.

