# Chapter 12 — Spanish audiobook private QA checkpoint (2026-10-08)

**Track:** 14 — `Errores frecuentes en el análisis del dólar y multiactivo`  
**Disposition:** PRIVATE CONTENT + ASSEMBLY QA PASS; FINAL EDITORIAL AND MASTERING HOLD  
**Release:** No Production, no member storage, no public publish.

## Authoritative settings

- Source: *Read the Dollar First*, Spanish Edition 1.3 Candidate 1, document lines 764–826.
- Narrator: **Narrator Mateo**, `es-419`, speed `0.92x`.
- Private Descript master: `2f542797-4a70-4d44-a164-76dee15859ca`.
- Chapter 12 composition: `6d0cfdc6-410d-489c-b754-9430421be2ad`.

## Synthesis and recovery

- Original batch run `37832890846` completed segments **1–15**; segment 16 returned provider `internal_error` with no completed result. A guarded, exact recovery run was initiated without re-generating 1–15.
- Recovery run `37835913193`: segments **16–20**, **5/5 generated**.
- Private GitHub artifacts: `11574746300` (1–15) and `11574778953` (16–20), short retention.
- All **20** items imported into Descript; no duplicate generated pieces in the canonical track.
- Segments 1–15: **897.907 s**; segments 16–20: **270.106 s**; completed composition: **1168.013 s (~19:28)**.

## Source and narration validation

- Direct source comparison uses Spanish Edition 1.3 Candidate 1 (literal citation URLs omitted as governed adaptation), versus Descript's completed composition transcript.
- Source tokens: **2,405**; transcript tokens: **2,408**; exact normalized matches: **2,385**.
- Exact-token alignment: **99.17%**; normalized edit rate: **1.12%**.
- **No material multi-word source omissions**. Differences reviewed include natural numbers (`2025` pronounced `dos mil veinticinco`), `EUR/USD` verbalization, chapter number words, short acronym ASR variants, and Part V placement.
- End-of-chapter reference names and the **Nota de cumplimiento** remain present.

## Technical-audio validation

- All 20 files probe/decode as **MP3** and have unique checksums. Some HeyGen output URLs and historical artifact names misleadingly end in `.wav`; this is naming, not PCM-WAV encoding.
- Valid decoded playback across all segments; no completely silent segments or gaps exceeding five seconds.
- MP3 floating-point decoded peaks slightly exceed digital full-scale in isolated samples. **Final mastering must level/limit peaks** before distribution and complete a listening pass.
- The repeated spoken `PARTE CINCO` heading occurs at the end of Chapters 10–12 instead of in the following chapter's opening. Correct the chapter-boundary handoff during final editing; do not blindly re-synthesize completed segments.
- The original segment 20 for Chapter 12 has an extraneous `PARTE CINCO` at the end, sourced from the following chapter's repeated part header.

## Gate

This checkpoint approves **private continuation to Chapter 13 synthesis**, but **does not** authorize publication, member storage, entitlement changes, commerce changes, Production deployment, or publication from Descript. Final release requires editorial transition corrections, audio mastering, full listening QA, complete audiobook review and an independent explicit release approval.
