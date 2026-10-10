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
| 00 | Opening | 1:49.84 | 25 | USD Impact; copyright-tail v2 |
| 01 | Acknowledgments and reader guide | 3:48.57 | 49 | Reconocimientos |
| 02 | Introduction, corrected variant | 13:57.44 | 191 | Introducción |
| 03 | Chapter 1, corrected variant | 17:45.77 | 250 | Parte uno · Capítulo uno |
| 04 | Chapter 2 | 18:28.76 | 251 | Parte uno · Capítulo dos |
| 05 | Chapter 3 | 19:00.40 | 258 | Parte dos · Capítulo tres |
| 06 | Chapter 4, final private variant | 22:54.20 | 321 | Parte dos · Capítulo cuatro |
| 07 | Chapter 5 | 20:28.21 | 291 | Parte tres · Capítulo cinco |
| 08 | Chapter 6 | 16:42.30 | 220 | Parte tres · Capítulo seis |
| 09 | Chapter 7 | 17:50.80 | 233 | Parte tres · Capítulo siete |
| 10 | Chapter 8 | 16:52.68 | 219 | Parte tres · Capítulo ocho |
| 11 | Chapter 9 | 15:16.03 | 218 | Parte tres · Capítulo nueve |
| 12 | Chapter 10 | 18:09.77 | 230 | Parte cuatro · Capítulo diez |
| 13 | Chapter 11 | 15:30.63 | 225 | Parte cinco · Capítulo once |
| 14 | Chapter 12 | 19:27.66 | 278 | Parte cinco · Capítulo doce |
| 15 | Chapter 13 | 22:27.66 | 331 | Parte cinco · Capítulo trece |
| 16 | Further reading | 2:28.38 | 36 | Lecturas adicionales |
| 17 | Appendix A, glossary | 17:23.33 | 237 | «Aprendáis a glosario» in ASR — inspect pronunciation |
| 18 | Appendix B, repaired private candidate | 14:43.03 | 175 | «Appendix B» in ASR — inspect pronunciation/tail |
| 19 | About the author | 0:43.60 | 9 | Sobre el autor |

### Four practical human listening blocks

These are proposed review blocks for the **actual selected audio files**; prior isolated snippet PASS responses do not satisfy them.

| Block | Tracks | Total time | Status |
| --- | --- | ---: | --- |
| A · Opening + Part I | 00–04 | 55:50.37 | PENDING full-length sequential listening |
| B · Chapters 3–7 | 05–09 | 96:55.91 | PENDING full-length sequential listening |
| C · Chapters 8–13 | 10–15 | 107:44.44 | PENDING full-length sequential listening |
| D · References / appendices / author | 16–19 | 35:18.33 | PENDING full-length sequential listening |

For every selected track, review the **whole file**, chapter/part heading, early and final sentences, internal pauses, pronunciation, loudness continuity and intact legal/educational closing. Record PASS/FAIL/UNCLEAR and exact timecode in the existing signoff tracker. If a block FAILS, fix only a private duplicate and repeat the affected hearing/measurements before moving on. Do not mark any block PASS based only on SRT text.

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

### P1 — Track00 selection conflict (must resolve before rendering final 20)

- The private 20-track planning manifest selects `ebe7f026-e369-4dd4-a184-9476a6482f5b` (**109.835306s**, copyright-tail QA v2) and records an owner's scoped PASS on its opening/disclaimer listening reel.
- The **same manifest's** `track00_current_selection` field states `FIRST_ORIGINAL_RECORDING`, composition `91240c6b-78df-4910-a994-43c616f9b53f` (**113.345306s**), and flags a click. These are contradictory selection instructions, not two approved final deliverables.
- **Do not choose between them automatically.** Resolve the owner's explicit final preference, confirm the reported click and copyright word/tail choice on the *actual chosen recording*, then update the one authoritative selection and rerun reconciliation. Old recordings and repaired alternates must remain intact.
- The working Candidate1 manuscript **does** contain `v5.95-candidate.2` as its production compilation notation. Therefore hearing/transcribing `candidate 2` in Track00 is source-aligned metadata, **not evidence of edition drift**. Whether production metadata should be spoken in member audio remains an editorial approval matter.

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

1. **Resolve Track00 selection discrepancy** before final audio assembly. Preserve both v2 and original, plus offline declick candidate; confirm final owner choice and targeted playback.
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
