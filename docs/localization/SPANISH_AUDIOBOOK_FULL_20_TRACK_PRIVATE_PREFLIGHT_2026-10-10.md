# USD Impact — Spanish audiobook: private 20-track pre-master readiness audit

**Inspection date:** 2026-10-10  
**Scope:** Private evidence/reconciliation only. **RELEASE HOLD / NOT A MASTERING CERTIFICATE**.  
**Descript project:** https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca  
**Branch / draft PR:** https://github.com/usdimpact/usd-impact-site/pull/797  
**Planning source:** `docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json`.  
**Authoritative editorial source consulted:** Spanish Edition 1.3 Candidate 1 — WORKING HOLD, Google Doc `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`.

## 1. Verified metadata and transcript inventory

- **20/20** selected private Descript compositions exist; all manifest durations agree with live Descript metadata to within **0.005 seconds**.
- Total selected runtime **17749.053398 seconds** = **4h 55m 49.053s**, including approved private Chapter2 duplicate `592e27f8-5337-4058-8f6d-e0f2cb749251` (+1.380224 seconds over prior selected Chapter2).
- All **20/20** selected compositions returned **nonempty Descript SRT transcript exports** by this audit. The export service temporarily throttled some requests; affected tracks were retried after its rate limit cleared. This is evidence of export availability and transcript presence, **not** whole-book alignment against the entire source manuscript, audio decode or audible human acceptance.
- Opening part-heading structure: Part I on Chapter1+Chapter2, Part II Chapter3+Chapter4, Part III Chapter5–9, Part IV Chapter10, Part V Chapter11–13. End-of-chapter disclaimer text is present in sampled last cues for the chapters; Chapter10 and Chapter11 use their distinct shorter compliance language. The exact wording requires separate source parity review.
- No composition was newly synthesized, edited, shared or published during this audit. A targeted Agent Underlord request inspected Appendix B metadata in read-only terms; its job returned `project_changed:true` despite reporting no edits, so selected IDs/durations/publication status were rechecked afterward.

| Track | Selected content | Duration (m:ss) | SRT cues | Opening / special note |
| --- | --- | ---: | ---: | --- |
| 00 | [Opening](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/ebe7f) | 1:49.84 | 25 | USD Impact; copyright-tail v2 |
| 01 | [Acknowledgments and reader guide](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/a65d7) | 3:48.57 | 49 | Reconocimientos |
| 02 | [Introduction, corrected variant](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/aecc1) | 13:57.44 | 191 | Introducción |
| 03 | [Chapter 1, corrected variant](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/686a4) | 17:45.77 | 250 | Parte uno · Capítulo uno |
| 04 | [Chapter 2](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/592e2) | 18:28.76 | 251 | Parte uno · Capítulo dos |
| 05 | [Chapter 3](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/afef9) | 19:00.40 | 258 | Parte dos · Capítulo tres |
| 06 | [Chapter 4, final private variant](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/c99a1) | 22:54.20 | 321 | Parte dos · Capítulo cuatro |
| 07 | [Chapter 5](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/66cda) | 20:28.21 | 291 | Parte tres · Capítulo cinco |
| 08 | [Chapter 6](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/88370) | 16:42.30 | 220 | Parte tres · Capítulo seis |
| 09 | [Chapter 7](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/fc98a) | 17:50.80 | 233 | Parte tres · Capítulo siete |
| 10 | [Chapter 8](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/217a0) | 16:52.68 | 219 | Parte tres · Capítulo ocho |
| 11 | [Chapter 9](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/d1540) | 15:16.03 | 218 | Parte tres · Capítulo nueve |
| 12 | [Chapter 10](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/ade2a) | 18:09.77 | 230 | Parte cuatro · Capítulo diez |
| 13 | [Chapter 11](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/8644e) | 15:30.63 | 225 | Parte cinco · Capítulo once |
| 14 | [Chapter 12](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/fc7b5) | 19:27.66 | 278 | Parte cinco · Capítulo doce |
| 15 | [Chapter 13](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/34e4b) | 22:27.66 | 331 | Parte cinco · Capítulo trece |
| 16 | [Further reading](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/827db) | 2:28.38 | 36 | Lecturas adicionales |
| 17 | [Appendix A, glossary](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/625d0) | 17:23.33 | 237 | «Aprendáis a glosario» in ASR — inspect pronunciation |
| 18 | [Appendix B, repaired private candidate](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251) | 14:43.03 | 175 | «Appendix B» in ASR — inspect pronunciation/tail |
| 19 | [About the author](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/1d15c) | 0:43.60 | 9 | Sobre el autor |

### Four practical human listening blocks

These are proposed review blocks for the **actual selected audio files**; prior isolated snippet PASS responses do not satisfy them.

| Block | Tracks | Total time | Status |
| --- | --- | ---: | --- |
| A · Opening + Part I | 00–04 | 55:50.37 | PENDING full-length sequential listening |
| B · Chapters 3–7 | 05–09 | 96:55.91 | PENDING full-length sequential listening |
| C · Chapters 8–13 | 10–15 | 107:44.44 | PENDING full-length sequential listening |
| D · References / appendices / author | 16–19 | 35:18.33 | PENDING full-length sequential listening |

Open each selected private track directly from its linked name in the 20-row inventory. For every selected track, review the **whole file**, chapter/part heading, early and final sentences, internal pauses, pronunciation, loudness continuity and intact legal/educational closing. Record PASS/FAIL/UNCLEAR and exact timecode in the existing signoff tracker. If a block FAILS, fix only a private duplicate and repeat the affected hearing/measurements before moving on. Do not mark any block PASS based only on SRT text.

## 2. Offline measurements — NOT official selected Descript master exports

All measurements below are from private source or offline QA files, using FFmpeg `loudnorm` measurement mode (`input_i`, `input_tp`) at their existing sample rates. Actual final encoded/composition renders still must be exported privately and remeasured.

| Measured private asset | Duration | Integrated LUFS | Input true peak dBTP | Status |
| --- | ---: | ---: | ---: | --- |
| Original Track00 source MP3 | 113.345 s | **−16.09** | **+0.46** | Original source has audible-click report and measured strong transients |
| Offline Track00 declick PCM24 WAV | 113.345 s | **−16.08** | **+0.04** | Two local transients removed in independent offline copy; **not** the selected Descript Track00 render |
| Separate copyright-removed/declicked Track00 QA WAV | 110.595 s | −16.05 | +0.04 | Different unselected private QA variant |
| Appendix B private mastering trial MP3 | 883.069 s | **−16.27** | **−2.21** | Independent offline trial, not exported from selected Descript appendix |
| Appendix B 8ms private mastering trial MP3 | 883.069 s | **−16.31** | **−2.21** | Independent offline test |
| Chapter5 corrected source WAV (selected input equivalent) | 1228.210 s | **−23.99** | **−7.80** | Private source only |
| Chapter6 corrected source WAV (selected input equivalent) | 1002.300 s | **−24.03** | **−7.74** | Private source only |
| Chapter7 corrected source WAV (selected input equivalent) | 1070.800 s | **−23.91** | **−7.73** | Private source only |
| Chapter8 corrected source WAV (selected input equivalent) | 1012.682 s | **−23.89** | **−7.77** | Private source only |

Chapter5–8 source files have close loudness consistency with **each other** (range 0.14 LU) but are approximately **8 LU quieter than the offline opening/appendix test assets**. These are differently staged and possibly already processed variants, not a valid final-master-to-final-master comparison. A mastering step and actual final-render normalization checks are necessary before end-user delivery. The previously tried ~−16 LUFS / ≤−2 dBTP target is a **provisional test reference**, not a locked mastering policy.

A separate 250ms-window RMS scan over the four Chapter5–8 private source WAV files found **no contiguous five-second runs** below −45 dBFS RMS. This does not prove gap-free whole-book playback; all other selected tracks and final encodes remain untested.

### Localized Track00 click evidence

The original user-provided MP3 has strong waveform transients at approximately **46.779274s** and **46.873764s**. Maximum sample jump near the first event is ~1.112 normalized units and peak reaches ~1.003. The offline, private declick WAV reduces that affected silent-pause region to peak ≤0.004394 and local maximum jump ~0.002504 while retaining later speech. The verified audio repair is **not** proof that the selected `ebe7f026-e369-4dd4-a184-9476a6482f5b` composition has that exact correction. Do not silently replace owner-preferred recordings.

## 3. Release-blocking and unresolved QA findings

### Track00 selection conflict RESOLVED for private pre-master (final audio QA pending)

- **Owner delegated the choice on 2026-10-10:** “it doesn't matter, continue”. Kept the already selected/listener-tested copyright-tail v2 private composition `ebe7f026-e369-4dd4-a184-9476a6482f5b` (**109.835306s**) and updated `track00_current_selection` to match. Manifest commit `6bbdb4a522771c31eaeb1846905fb57141dc89f0` archives the earlier conflicting field in `track00_selection_history`.
- **Reason for choice:** v2 previously passed the owner's targeted opening **0–9s** and disclaimer **42–51s** reviews, has correct “USD Impact. 2026” opening without the spoken English word “Copyright” or residual “Right”, and derives from a separately declicked private source. Its opening and disclaimer SRT were re-read successfully. This is not proof of final exported audio waveform equality.
- Original first recording `91240c6b-78df-4910-a994-43c616f9b53f` (**113.345306s**) is **preserved, not selected**. Original click at ~47.07s is a historical source defect, **not automatically a defect in v2**.
- **Remain on mastering HOLD:** selected v2 still needs full-track listening, private rendered WAV/MP3 decode, peak/LUFS/click test and editor/legal approval of copyright wording. The working Candidate1 manuscript includes `v5.95-candidate.2`; that spoken metadata is source-aligned but optional member-facing wording requires editorial review.
- No changes were made to any audio, the original or other 19 selected compositions. PR draft/unmerged, publishes 0 and Production OFF.

### P1 — Actual final 20 private audio renders unavailable for objective QA

- Descript connector supports metadata/transcript/timeline exports, but its timeline export **does not bundle audio**. Do not invoke `publish_project` or any share-link publication to access audio.
- The browser connector is not connected, and the available cloud browser profile has no established Descript sign-in. Without a supported authenticated private export, the model cannot truthfully mark 20/20 final rendered audio files measured.
- Safe handoff: export the **20 selected** composition audio files privately (lossless WAV recommended) from Descript and attach/upload privately; avoid exporting all 65 compositions or invalid 6-second upload placeholders. Reconcile file names, durations and SHA-256 hashes against the selected IDs, then measure full encoded and lossless outputs.

### P1 — Appendix B: ~13.144s transcript/media-tail discrepancy

- Selected Appendix B `6a251168-1d0d-4a9d-b9ea-daed1d1db016` lasts **883.028s**, but its exported SRT's last cue ends at **869.884s**. This leaves ~**13.144s** not covered by exported spoken cues.
- Agent Underlord read-only timeline inspection found the complete, **unmuted** source media clip `18-15.mp3` spanning **823.547–883.028s**, so the composition metadata show no missing clip/gap. The final scene has a long checksum-like text string outside clearly timed spoken words. It did not confirm audible content.
- The **separate offline Appendix B trial**, approximately 883.069s long, has substantial audio-level signal (roughly −13.5 to −20 dBFS 1s RMS) throughout seconds 871–882. This is evidence against assuming silence in the *trial*, **not** proof that the selected Descript candidate carries identical speech.
- Spanish Edition1.3 Candidate1 manuscript concludes Appendix B with two production-authority SHA-like strings, including a pipeline hash. Request targeted audition of **14:25–14:43** in the **selected composition** to determine whether identifier recitation is complete, appropriate and intelligible. Do not delete/replace it from ASR alone.

### P2 — Appendix pronunciation and transcript ambiguity

- Selected Appendix A opens in ASR as **“Aprendáis a glosario. Rápido.”** rather than the source heading **“Apéndice A — Glosario rápido.”**
- Selected Appendix B opens in ASR as **“Appendix B”**, while the Spanish source says **“Apéndice B.”**
- The owner previously reported PASS on a 3m06s multi-boundary/appendix reel which sampled these titles. This offsets, but does not replace, a check on the **selected full-length compositions**. Treat as ASR ambiguity until heard, not as proven pronunciation failures.

### P2 — Chapters 10–13 and legal/editorial alignment

- Chapter10 and Chapter11 have shorter specialized educational compliance endings than the standardized disclaimers on some other chapters. Their SRT ending text is present; **do not overwrite** automatically with a generic disclaimer without source matching.
- Chapter13 ending was included in an earlier short approved QA reel; complete source-accurate last-section hearing and end-to-end book review still required.
- Opening copyright/permission wording was previously flagged for an editorial parallel-structure issue; revised permissions wording can have legal consequences. No change to the canonical disclaimer or source copy is permitted absent legal/editorial approval.

## 4. Exact remaining gates

1. **Track00 selection RESOLVED for private pre-master:** v2 retained after owner's no-preference instruction, original and offline declick source preserved. Still verify full v2 playback and actual private exported master before approval.
2. **Check Appendix B ending 14:25–14:43** and Appendix A/B full-composition openings with ears. Distinguish ASR defects from actual spoken defects; do not resynthesize automatically.
3. **Complete four whole-book listening blocks** in the table above, recording reviewer/timecode/verdict per selected composition. No prior four-clip, boundary or three-reel PASS automatically extends to full tracks.
4. **Privately export the selected 20 audio outputs**; verify IDs, filenames, durations, channel/sample rate, decode, long silences, clipping, interchapter pauses, loudness, loudness range, true peak and final MP3/AAC encodes. Compare channel format and exact final audio against the locked selection, not with source QA WAVs.
5. **Editorial/source/legal review:** resolve any material source deviations, Appendix B provenance/hash recitation and copyright wording. Obtain separate owner approval of final mastered deliverables.
6. **Release only by separate explicit later authorization.** Keep PR DRAFT/unmerged, public Descript publishes = 0, Production/member delivery OFF, and `mastering_approval = PENDING`.

## 5. Audit limitations and explicit no-go

- No actual five-hour audio listening was performed by the assistant. An SRT can confirm text presence/timestamps but not phonetic audio quality, clipping, breaths, pacing or end-to-end semantic source fidelity.
- Only the **offline/private source and test** files in the measurement table were independently decoded and measured. The selected Descript compositions were not exported as 20 verified audio masters.
- This audit makes **no changes** to Descript compositions, source audio, public URLs, Production, member entitlement, main branch or public publishing.
- **DISPOSITION: HOLD** until the named blockers and final encoded-audio/owner checks pass.

## 6. October 10 — Appendix B source identifier and selected source-clip reconciliation

Read-only `Descript.search_drive` resolved the **actual** final `18-15.mp3` source media in the selected Appendix B project to asset `a84ec5a3-4e7b-4bb8-a6e8-5f2a2a50640b` (59.480816s): [open source asset in private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca?file=a84ec5a3-4e7b-4bb8-a6e8-5f2a2a50640b). The current selected composition `6a251168-1d0d-4a9d-b9ea-daed1d1db016` places this clip at **823.547–883.028s** and does not mute it, according to read-only Agent Underlord inspection. This does **not** prove sound quality or that the last 13.144s are intelligible speech.

**Exact source-text comparison:** Spanish Edition 1.3 Candidate1 — WORKING HOLD, Google Doc `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`, finishes Appendix B with:
- site authority `a86e57dafe91da67553e73e01bb0c703a868c949`;
- pipeline authority `f51f7abf2d4ec99890eb5537424f6faab885ef32`.

Descript **TXT** transcript of selected Appendix B finishes with site authority `A86E57DAFE91DA67553E73E01BB0C703A868C949` and pipeline transcription `F51F7ABF2D4EXE99890EB55374246FAB885F32`. **The latter text is not identical to the source identifier** (including a non-hex `X`), but it may be an ASR error rather than an audio error. Do not infer a wrong spoken identifier; the text may also be an untimed script artifact. Its SRT stops at 869.884s despite the 883.028s audio clip duration.

**Mandatory reviewer checkpoint:** Listen in the exact selected private Appendix B composition [from 14:25 through 14:43](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251). Decide whether production authority hashes are intended to be *spoken* at all in the audiobook; if yes, verify intelligible, source-aligned narration; if no, request editorial/legal confirmation of an audiobook adaptation rather than simply deleting. Record verdict/timecode, then preserve or repair in a **new private duplicate only**.

Selected Appendix A `625d0a1a-1bf2-42ac-b363-cb8b525e660b` starts `Aprendáis a glosario. Rápido.` in Descript TXT, and selected Appendix B starts `Appendix B`; the source titles are **Apéndice A — Glosario rápido** and **Apéndice B — Metodología de la USD Impact Score**. These are **ASR-vs-source observations, not acoustically verified pronunciation defects**. Review first 10s of both selected compositions before any edits.

**No private source `18-15.mp3` was found as a standalone Library or Google Drive download.** The source is present inside the private Descript project. No master audio import/export or public sharing was done, and prior offline Appendix B MP3 trials are not certified as the current selected composition.

## 7. October 10 — Owner PASSED selected Appendix B ending excerpt

After the pending request to listen to **14:25–14:43** of [selected repaired Appendix B](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251), the owner replied **PASS**. Treat this as a scoped listening signoff for the **last 18 seconds** with no reported audible defect, not as independently measured selected output, complete Appendix B playback or approval of the book.

The source-media coverage **823.547–883.028s** and SRT end **869.884s** remain factual metadata. The owner PASS does not reconcile their timestamps or independently attest that the pipeline hash was spoken character-for-character. The mismatch between the Spanish manuscript's closing identifier and the Descript TXT remains a **source/ASR editorial verification gate**, not a confirmed audio defect. No sound, transcript or source media was edited on this verdict.

**Status:** Appendix B targeted tail listening: **PASS**. Appendix A/B opening pronunciation, Appendix B complete-track listening, 20 private mastered renders/whole-book audio and legal/editorial checks: **PENDING/HOLD**. Release conditions unchanged.

## 8. October 10 — Both selected appendix opening pronunciations PASSED

The owner replied **PASS BOTH** after hearing **0–10 seconds** of [selected Appendix A](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/625d0) and [selected Appendix B](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251). These scoped acoustic PASS decisions address the earlier opening ASR renderings that did not match the Spanish headings. No audio repairs are indicated by the owner's report.

Combined with the earlier owner PASS for selected Appendix B **14:25–14:43**, the specified **three appendix excerpts** are now accepted. **Not accepted:** complete appendices, literal accuracy of the final identifier transcript, 20 exported audio masters or end-to-end full-book listening. The selected compositions remain unchanged. Release is HOLD.


## Editorial identifier parity check — 2026-10-10 (read-only)

Compared the closing Appendix B paragraph in the authoritative Spanish Edition 1.3 Candidate 1 Google Doc (`1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`, paragraph near document index 1134) to a new private Descript TXT transcript export from selected Appendix B `6a251168-1d0d-4a9d-b9ea-daed1d1db016`.

| Authority token | Manuscript | Descript ASR/TXT | Text comparison |
| --- | --- | --- | --- |
| Website | `a86e57dafe91da67553e73e01bb0c703a868c949` | `A86E57DAFE91DA67553E73E01BB0C703A868C949` | MATCH case-insensitively |
| Score pipeline | `f51f7abf2d4ec99890eb5537424f6faab885ef32` | `F51F7ABF2D4EXE99890EB55374246FAB885F32` | MISMATCH at manuscript `c` versus ASR `X`, and manuscript `4f` versus ASR `46` near the ending |

**Interpretation:** ASR text parity **FAIL/UNCERTAIN** for the Score-pipeline token, not a demonstrated acoustic defect. The owner-reported PASS of Appendix B at 14:25–14:43 is a scoped audible acceptance, not an exact character-by-character hash transcription signoff. Do not replace source authority tokens, alter narration, or generate a repair solely from ASR. Keep literal pipeline authority verification as an editorial release gate. Other wording/compliance approvals remain pending; no public publishing, merge, member delivery or Production change.
