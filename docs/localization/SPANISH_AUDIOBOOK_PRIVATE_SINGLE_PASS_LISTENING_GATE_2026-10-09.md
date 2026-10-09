# USD Impact — Spanish audiobook: single-session private listening gate

**Date:** 2026-10-09  
**Status:** PREPARED FOR HUMAN REVIEW — NOT ACOUSTICALLY APPROVED  
**Private Descript project:** https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca  
**Draft PR:** https://github.com/usdimpact/usd-impact-site/pull/797  
**Release controls:** PR DRAFT/unmerged; public Descript publishes 0; member storage, Production and mastering OFF/HOLD. Do not export/publish or switch the canonical Track00 based on this note.

## Why the final QA uses three existing compositions

A new ~4m30s compound reel was evaluated, but Descript Agent Underlord **did not create it**: it could not safely extract non-contiguous script-based audio ranges with verified cut fidelity. Existing isolated compositions are present, ready and avoid another editing artifact. The owner said "approved, continue" after the Track00 v2 listening request; **this is authorization to proceed with QA, not an explicit acoustic PASS for the new v2**.

## Listen in this order (about 5 minutes total)

| Order | Existing private composition in Descript | Length | Play and verify | Human result |
| --- | --- | ---: | --- | --- |
| 1 | `00 - Copyright Tail QA v2 - DO NOT PUBLISH` (`ebe7f026-e369-4dd4-a184-9476a6482f5b`) | 1:49.835 | Listen **00:00–00:09**: only `USD Impact. 2026. Todos los derechos reservados.`; year begins cleanly, no residual `Right`, no click. Listen **00:42–00:51**: intact `Este libro tiene un propósito exclusivamente educativo e informativo`, no click/clipping. | PENDING |
| 2 | `QA - Part I Introduction to Chapter 1 - DO NOT PUBLISH` (`db76c850-5004-4be7-bf56-70b93b04d779`) | 0:51.101 | Listen **00:00–00:51**: the body reference `La parte uno` around 0:09 is intentionally distinct from the separate heading `Parte uno` at 0:35.5, followed by `Capítulo uno` at 0:37.3. No clipped phrases or unnatural joins within the actual Intro→Ch1 handoff. | PENDING |
| 3 | `QA - Spanish Audiobook Boundary and Repair Listening Reel - DO NOT PUBLISH` (`6b7b9e26-bde5-4b1b-a9f1-3346966a26c6`) | 3:06.888 | Listen **00:00–03:07** for five part/chapter handoffs, Appendix B repaired reference seam, Chapter13 final disclaimer, and Appendix A/B spoken Spanish titles (details below). | PENDING |

**Separate Intro-body check:** In corrected Introduction composition `aecc180b-4513-455b-a3e4-fce58da36fac`, listen at approximately **07:59** for the restored earlier body phrase `la parte uno`; ensure no clipped syllables or new silence. The Part I 51s reel samples this region but cannot certify every source-scene boundary.

### Technical transcript audit (not listener acceptance)

- New private v2 Track00 length **109.835306s**. Imported v1 length **110.595306s**. Its first SRT lines now show `USD Impact. / 2026. / Todos los derechos reservados.` and the disclaimer begins at ~**00:43.550**.
- **25 SRT cues in each version; 189 normalized transcribed tokens in v1 vs 188 in v2; removing the solitary `Right` token reproduces the entire v2 token sequence exactly.** This establishes transcript consistency for the reversible 0.760s word-ignore, **not** acoustic splice quality.
- Part I reel (**14 SRT cues**) has `La parte uno` in Intro body ~00:08.857 and the independent heading `Parte uno` ~00:35.518; `Capítulo uno` begins ~00:37.261. Their repetition is intentional.
- Chapter/Appendix reel (**52 SRT cues**) contains the part headings at 00:07.900, 00:23.956, 00:40.301, 00:55.718, 01:11.846. Compliance ending and appendix title excerpts appear later. Text timing verified; no actual human acoustic decision is inferred.

### Detail for the 3:06.888 chapter/Appendix reel

| Reel time | Review |
| --- | --- |
| 00:00–00:16 | Chapter 8 closing → `Parte tres` → Chapter 9, with complete compliance ending |
| 00:16–00:32 | Chapter 9 closing → `Parte cuatro` → Chapter 10 |
| 00:32–00:48 | Chapter 10 closing → `Parte cinco` → Chapter 11 |
| 00:48–01:04 | Chapter 11 closing → repeated source `Parte cinco` → Chapter 12 |
| 01:04–01:20 | Chapter 12 closing → repeated source `Parte cinco` → Chapter 13 |
| 01:20–02:06 | Appendix B repaired institutional-name/splice excerpt: ICE, CME/NYMEX, S&P Dow Jones Indices, Cboe, Treasury/FRED. Check no overlap, double speech, click or abrupt level |
| 02:06–02:46 | Chapter 13 source references and educational non-advice disclaimer intact |
| 02:46–02:57 | Appendix A heading should **sound** like `Apéndice A — Glosario rápido` |
| 02:57–03:07 | Appendix B heading should **sound** like `Apéndice B — Metodología de la USD Impact Score` |

**Do not diagnose errors from ASR alone.** The transcript currently says `Aprendáis a glosario` for Appendix A and `Appendix B` for Appendix B. These could be recognition errors or real pronunciation defects: direct listening required. The reel is stitched from intentionally unrelated excerpt boundaries and has no inserted silence; **judge joins inside each original handoff, not the transitions between unrelated excerpts**.

### Requested listener response

Provide **PASS / FAIL / UNCLEAR** for:
- v2 Track00 opening + disclaimer;
- Part I / Introduction-to-Chapter 1 (and ~07:59 Intro phrase);
- chapter heading joins 1–5;
- Appendix B reference splice and names;
- Chapter 13 legal/compliance ending;
- Appendix A and Appendix B titles.

On FAIL/UNCLEAR, give approximate timecode. **Do not transpose the earlier owner's v1 targeted PASS to this new v2 composition.**

### Next after listening

Only scoped audible PASS permits selecting the relevant repaired private candidate for **subsequent** consistent mastering and a whole-book listening pass. Even an all-PASS result on these samples is **not** a full-book sign-off, PR merge, member-access grant, public Descript publishing approval, Production authorization or change to financial/legal source copy.
