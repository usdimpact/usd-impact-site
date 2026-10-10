# Spanish audiobook — Chapters 2–8 part-heading audio verification

**Date:** 2026-10-09  
**Disposition:** TRANSCRIPT FLAG / HUMAN AUDIO CONFIRMATION REQUIRED. Do not master affected boundaries or change original recordings until confirmed.

## Authoritative source

[Spanish Edition 1.3 Candidate 1](https://docs.google.com/document/d/1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU/edit), body sections, repeats its Part I/II/III label immediately **before each applicable chapter**. This comparison is to the body, not the front table of contents. Source wording is unchanged.

## 7 targeted listening checks

Open the [private Descript audiobook project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca). Listen to the ending of the first composition and the beginning of the next. Each listed time is from the current private SRT, approximate and **not a certified audible cut boundary**.

| Transition | Private source compositions | First composition: inspect | Next composition: inspect | Expected source |
| --- | --- | --- | --- | --- |
| 03→04 (Chapter 1→2) | `686a4f65` → `b6df4dcc` | Track03 last ~00:17:39–00:17:45 | Track04 00:00–00:06 | A new `Parte uno` before `Capítulo dos`; currently missing in SRT |
| 04→05 (Chapter 2→3) | `b6df4dcc` → `478f0683` | 00:18:27.8–00:18:28.6: `Parte dos` | 00:00–00:06 | This `Parte dos` belongs before `Capítulo tres` |
| 05→06 (Chapter 3→4) | `478f0683` → `3166b677` | 00:18:59.5–00:19:00.4: `Parte dos` | 00:00–00:09 | `Parte dos` belongs before `Capítulo cuatro` |
| 06→07 (Chapter 4→5) | `3166b677` → `1e8ae260` | 00:22:52.6–00:22:53.8: `Parte tres` | 00:00–00:07 | `Parte tres` belongs before `Capítulo cinco` |
| 07→08 (Chapter 5→6) | `1e8ae260` → `2b9e5a60` | 00:20:26.9–00:20:27.6: `Parte tres` | 00:00–00:06 | `Parte tres` belongs before `Capítulo seis` |
| 08→09 (Chapter 6→7) | `2b9e5a60` → `f053f190` | 00:16:41.1–00:16:42.2: `Parte tres` | 00:00–00:06 | `Parte tres` belongs before `Capítulo siete` |
| 09→10 (Chapter 7→8) | `f053f190` → `2f2d2ff3` | 00:17:49.4–00:17:50.5: `Parte tres` | 00:00–00:07 | `Parte tres` belongs before `Capítulo ocho` |

**Reviewer result for each:** HEARD HEADING AT PRIOR TAIL / SILENT OR ASR-ONLY / UNCLEAR. Also note clipped audio or abrupt pauses. A single unqualified PASS to this checklist does not establish which interpretation applies; specify the seven results when possible.

## Automatic repair attempt and stop

Descript Agent Underlord was authorized to test **only** an isolated two-duplicate Chapter2→Chapter3 transfer, without publishing. The agent **ABORTED BEFORE ANY MODIFICATION** because its script-word search could not isolate the final `Parte dos` clip and could not confidently bind Chapter3 opening to the correct media. **No duplicate, rendered audio, synthesized speech or edited source was produced**. This may be a limitation of the agent's script parsing, not proof of damaged audio.

An isolated read-only timeline export was produced for Track04 (EDL, no media bundled), but its timeline file has not been independently inspected. Do not assume the EDL proves an acoustic edit boundary.

**Next safe action:** listen at these specific timestamps in Descript; if the words are genuinely audible at the prior tail, carry out exact boundary corrections only with a reliable editor/media alignment workflow in NEW private duplicates. Recheck core narration, total duration and sample joins. Do not use text-only transcript edits to sever uncertain audio. The existing owner-approved 3-reel checkpoint covered different boundaries.

## Final release boundary

20/20 private selected compositions remain present. Mastering, complete 20-track listening, PR #797 merge, public Descript publishing, member delivery and Production are NOT approved here. Preserve all canonical originals.

## Owner confirmed audible Part II heading at Chapter 2 tail — 2026-10-09

**Listening evidence:** Asked to play private Chapter 2 composition `b6df4dcc-811f-4ec5-a577-f33c5e81b415` at **18:27–18:29** and say HEARD / NOT HEARD / UNCLEAR. The owner replied **HEARD**, confirming **audible `Parte dos` after Chapter 2's disclaimer** (SRT locates it approximately **18:27.832–18:28.612**). This is no longer merely an ASR/transcript flag for transition **04→05**.

**Required editorial placement:** Authoritative Spanish Edition 1.3 Candidate 1 places the repeated `PARTE II` at the start of Chapter 3 (`05`), before `Capítulo tres`. Track 04 should end after `Verifica los datos actuales antes de utilizarlos`. Preserve the **different** `Parte dos` spoken at the end of Track 05 for the separate Track05→06 boundary investigation.

**Attempted automatic edit remains ABORTED:** Agent Underlord could not find a reliable source-media/word edit boundary, so no audio clip was moved, no duplicates created, and the originals were not modified. Audible presence confirms the defect, **not** a safe waveform cut location. EDL metadata alone has no bundled audio.

**Repair method:** First obtain private actual **audio-only exports** of Chapter 2 and Chapter 3 (WAV preferred, no mastering or public publish); then use a precise editor to isolate the known tail phrase by listening and waveform, move recorded speech to a **separate private corrected candidate**, verify intact disclaimers and track-duration conservation, and solicit new acoustic PASS. Do not cut at SRT timestamps without waveform verification. Do not regenerate with HeyGen/ElevenLabs.

**Other six checklist transitions (03→04 and 05→06 through 09→10) remain unconfirmed by this single `HEARD` response.** PR #797 draft/unmerged; public Descript sharing, member audio, Production and mastering remain held.

## Offline recorded-heading transfer — private WAV candidates (2026-10-09)

Following the owner's `HEARD` confirmation, the owner uploaded native lossless WAV exports of source Descript Chapter2 (`b6df4dcc-811f-4ec5-a577-f33c5e81b415`) and Chapter3 (`478f0683-3203-43f1-b78b-4f1dbc4ec144`). Both uploads were validated as signed 16-bit PCM, 44.1kHz, mono and fully decoded. Their native durations were **1108.924081633s** and **1140.715102041s** respectively.

**Exact offline repair:** Split source Chapter2 at **1107.380000s** (silence/low-energy interval between the disclaimer ending ~1107.22s and `Parte dos` starting ~1107.48s), then move its whole remaining **1.544081633s** of existing PCM audio, including the heading and pause, to the beginning of an unchanged copy of Chapter3. The output Chapter2 ends after the compliance sentence at **1107.380000s** and Chapter3 begins with the recorded heading at **1142.259183673s** total length. Leave the separate original `Parte dos` at Chapter3's end intact. No resynthesis, editing within voiced speech, filtering or level changes.

**Strong sample-preservation verification:** SHA-256 of combined input Chapter2 PCM followed by input Chapter3 PCM is **`a7435b492c6a1c884d320c0296a583e50e34b2f8b4753aa419bbbdb910586432`**. Repaired Chapter2 PCM followed by repaired Chapter3 PCM is **byte-for-byte identical** across the same 99,209,088 total frames; duration and content are conserved. Split quiet gap RMS **0.00020779** full scale; zero sample jump at split.

**Saved private, owner-only Drive recordings:**

- [Corrected Chapter 2 WAV](https://drive.google.com/file/d/1q5ljVsqJRHNJ9FYxThfa1sjsbskVmyKH/view) — 97,670,960 bytes.
- [Corrected Chapter 3 WAV](https://drive.google.com/file/d/1NcGQb_Y_ZOt5FiEeZQZzrGeZisAEWMwG/view) — 100,747,304 bytes.
- [Browser-ready listening kit (four before/after WAV excerpts and local `index.html`)](https://drive.google.com/file/d/1sb55w7Dsb09ZO14jnptIAVB54mZJQvAY/view).
- [Private full QA report](https://drive.google.com/file/d/1tagWn7hsrOf0A42PiezUdp06u2m_wy53/view) and [machine-readable hashes/metrics](https://drive.google.com/file/d/1Mw85FlDnbp8gXbJ37E8MCVO1YNpLhHI-/view).

**Human acoustic verdict:** PENDING. Listen to Chapter2's last 10 seconds for a complete disclaimer without `Parte dos`, and Chapter3's first 10 seconds for `Parte dos` followed by `Capítulo tres`, with no clicks/clips. This was an **offline** audio repair; the approved private Descript review manifest still points at original Chapter2 and Chapter3 compositions until the corrected WAVs are auditioned, imported as new private duplicates, and approved.

**Remaining 6 heading checks** and whole-book listen/mastering are still pending. PR #797 DRAFT/unmerged; public/member/Production unchanged; original files preserved.

## Owner PASS and verified private Descript imports — October 9

The owner replied **PASS** after reviewing the four before/after WAV samples for Chapter 2's ending and Chapter 3's opening. This is acceptance of the scoped **offline source recordings**, not a full-length Chapter 2/3 listening pass.

Using the two existing corrected WAV files, a single private Descript import job `project-media-import-af0e2f05-d944-4299-9906-958efe2eab4e` completed with **status success for both files** and created **two separate audio-only private compositions**:

- **Track 04 / Chapter 2:** `ebbadbd2-df11-4cba-95d6-a546dd7b3b51`, `04 - Chapter 2 - Heading Transferred - PRIVATE QA - DO NOT PUBLISH`, duration **1107.380000 s**. Descript SRT begins `Capítulo dos` and ends with `Verifica los datos actuales antes de utilizarlos`; the trailing `Parte dos` is absent.
- **Track 05 / Chapter 3:** `44599961-6954-4dd1-9970-9c2019b4c010`, `05 - Chapter 3 - Heading Prefixed - PRIVATE QA - DO NOT PUBLISH`, duration **1142.259184 s**. Descript SRT starts `Parte dos. Capítulo tres: USD no es DXY` and retains the second `Parte dos` at the end.

Both compositions' durations match the owner-approved WAV sources; both original Descript compositions remain available and unchanged. Independent decoded-PCM verification of the four local original/corrected WAV files showed **the same SHA-256** `a7435b492c6a1c884d320c0296a583e50e34b2f8b4753aa419bbbdb910586432` when hashing original Chapter2+Chapter3 sample streams and corrected Chapter2+Chapter3 sample streams, proving the same combined audio samples were preserved in the source files. Descript import confirmed correct timing and expected opening/closing transcript; **actual imported rendered audio has not undergone a second separate full-chapter human listen**. Descript's ASR has some numeric transcription variation within Chapter 3, so SRT is not considered a lossless word-level proof.

The private 20-track pre-master **planning manifest now selects these two verified imported compositions**. The original composition IDs are preserved under `original_review_composition_id`. No canonical source media or public content is overwritten. Remaining heading questions: 03→04 and 05→06 through 09→10, plus full-book mastering/listening. No public publish, merge, member-access or Production permission was granted.

## Offline Chapter 3→4 recorded heading repair — pending listening

**Date:** 2026-10-09. After Chapter2→3 import, the owner supplied the complete Descript Chapter 4 export (06F, 44.1 kHz mono PCM16, 1374.145306s). The selected corrected Chapter 3 WAV is 1142.259184s and its SRT ends with a separate `Parte dos` at ~19:00.99–19:01.95. Original Chapter 4 begins `Capítulo cuatro` without a leading `Parte dos`. This is an offline **technical repair candidate**; it has NOT received human acoustic PASS.

The exact cut is after Chapter 3's final educational disclaimer, at **1140.400000s (frame 50,291,640)** in a quiet gap, before the spoken `Parte dos`. The final **1.859184s** of already-recorded Chapter 3 audio, including the heading and trailing pause, were moved to the beginning of an unchanged copy of Chapter 4. No synthesis, gain changes, compression, re-sequencing of other words, or editing within the spoken phrase.

**Corrected file durations:** Chapter 3 **1140.400000s**; Chapter 4 **1376.004490s**. Both 44.1kHz mono PCM16 WAV. Source Chapter3+Chapter4 and corrected Chapter3+Chapter4 have exactly **110,973,438** combined decoded PCM frames, in identical order. Both have the exact SHA-256 `4de48aa80a35bb8837084e2841f86b8cccbfa4091938266aacea1c4e77057c13`. Boundary sample pair and the join to original Chapter 4 are zeros (delta=0), and the cut region is quiet. This establishes technical sample preservation, **not** human acoustic approval.

**Private storage and review materials:**
- [Corrected Chapter 3 WAV, owner-only Google Drive](https://drive.google.com/file/d/1MAJFYTOxtFGor93LglEq7BpFCGV2VCRn/view).
- Corrected Chapter 4 **WAV**: native Library `/06F - Capitulo 4 - Part II heading prefixed - PRIVATE QA.wav` (Library file `libfile_daf04360ca508191b858f6d6103a8249`); Drive could not accept the >100MB WAV. The WAV remains available privately for listening/upload.
- [Corrected Chapter 4 lossless FLAC owner-only Drive backup](https://drive.google.com/file/d/1yaEpeTF28sX4KuHAG_Y-uzEHV511Hi3i/view); decoded SHA-256 is identical to the WAV's PCM, `58c3f1ca91c50156c9187eaa307e53d3d0d202728b1ebb541528a6bdf6261311`.
- [Browser-ready four-sample A/B listening kit, owner-only Drive](https://drive.google.com/file/d/1IQIQbltN_msxY73_4U706xWwxke_JUQH/view).
- [QA technical report](https://drive.google.com/file/d/1JSYH55aOxYL7DGCsUA6Q4MWDH9HhHf_3/view) and [machine-readable results](https://drive.google.com/file/d/1lsiHejnM21VujuY7q_WfhK4Ydukl-TDN/view).

**Human QA required:** Audition corrected Chapter 3 last 10s for full disclaimer without trailing `Parte dos`, and corrected Chapter 4 first 14s for intact `Parte dos. Capítulo cuatro` with a natural pause and no clicks/clipping. Reviewer response PASS/FAIL with specific sample and timecode if failing. Do not switch selected Descript composition IDs or import these candidate WAVs before scoped approval. Original compositions untouched. Prior Chapter 3's *opening* `Parte dos` remains intact after this change. Chapter 4's separate trailing `Parte tres` remains for the subsequent Chapter4→5 review.

**Release holds unchanged:** 20-track private selection not changed; other heading checks, full-book hearing, final mastered audio, PR #797 merge, public Descript publishing, member delivery and Production remain PENDING/OFF.

## Owner PASS for private Chapter 3 to 4 A/B recording

Owner replied **PASS** after being asked to listen to four original/corrected WAV excerpts in the private Chapter 3→4 kit. This is **scoped human listening acceptance of the supplied local WAV excerpts**, not a full-Chapter 3/4 or final mastered audio sign-off. The approved candidate has Chapter 3 finishing after the intact disclaimer without the trailing `Parte dos`; Chapter 4 opens with the transferred existing `Parte dos` followed by `Capítulo cuatro`. The earlier `Parte dos` at the **opening** of Chapter 3 remains intact.

Private corrected WAV recordings:
- Chapter 3 (1140.400000s), Library/local working copy and [owner-only Drive](https://drive.google.com/file/d/1MAJFYTOxtFGor93LglEq7BpFCGV2VCRn/view).
- Chapter 4 (1376.004490s), Library file `libfile_daf04360ca508191b858f6d6103a8249`; lossless PCM-equivalent [owner-only Drive FLAC](https://drive.google.com/file/d/1yaEpeTF28sX4KuHAG_Y-uzEHV511Hi3i/view).
- Before/after A/B kit: [private Drive](https://drive.google.com/file/d/1IQIQbltN_msxY73_4U706xWwxke_JUQH/view); archived technical frame/hash measurements linked above.

**Transfer disposition:** Samples PASS. A separate private Descript import is authorized for these two approved audio WAVs, once no other job is editing the project. Do not alter original compositions. The imported compositions, once created, need readback checks of duration, first/last SRT and release protections before *private pre-master* selection. No assumption of whole-track acoustic PASS.

**Release boundary:** Remain on draft PR #797, no public Descript publish, Production OFF, member delivery OFF, mastering PENDING. Other headings still require independent review.

### Private Descript import wait — existing project job

A private two-composition import of the owner-approved corrected Chapter3/4 WAVs was attempted. Descript rejected the request with `A job is already running for this project`; **no import job was created**, no compositions were added and no existing audio was changed. The unrelated active Descript project job `project-agent-edit-2f542797-4a70-4d44-a164-76dee15859ca-712fd1fb-eba7-4d77-89c4-c92f3f1ccbe6` remained RUNNING at last check, with progress `Querying scenes`. Do not cancel or overlap that job without confirming its owner/scope. After it finishes, import the approved Chapter3 WAV (1140.400000s) and Chapter4 WAV (1376.004490s) into **new private audio-only compositions** and verify transcript boundaries/durations before selecting them. Originals, currently selected compositions, mastering approval and public release flags remain untouched.

## Descript imported corrections — Chapter 3→4 private selection confirmed

The owner replied **PASS** to the four before/after offline Chapter 3→4 A/B samples. This verdict covers the tested excerpts, not the complete chapters. A separate, previously running read-only Descript agent job `project-agent-edit-2f542797-4a70-4d44-a164-76dee15859ca-712fd1fb-eba7-4d77-89c4-c92f3f1ccbe6` finished successfully **without making changes**, clearing the project import lock.

The private Descript media-import job `project-media-import-9ac911c1-7522-42c5-828b-ab88f5a0dc53` completed **SUCCESS for both source WAVs**, creating two separate audio-only unpublished compositions:
- **Track 05 / Chapter 3**: `afef9b85-5d80-443b-b39d-6ac07a4e298b`, `05 - Chapter 3 - Part II Tail Transferred - PRIVATE QA - DO NOT PUBLISH`, **1140.400000 s**. Imported SRT begins with the *prior* `Parte dos. Capítulo tres` and ends `Verifica los datos actuales antes de utilizarlos`; the misplaced extra `Parte dos` is gone from its tail.
- **Track 06 / Chapter 4**: `dcc43206-170d-4202-b868-d2e6d8f804a0`, `06F - Chapter 4 - Part II Heading Prefixed - PRIVATE QA - DO NOT PUBLISH`, **1376.004490 s**. Imported SRT begins `Parte dos. Capítulo cuatro` and still ends with the independent **`Parte tres`** cue for the subsequent Chapter4→5 transition review.

Both composition durations exactly match their corrected source WAVs, and the originals remain present and unchanged. Source PCM was already verified to preserve all combined samples in the original order. The imported SRTs confirm text sequence and boundary placement, but do **not** replace a full-length human review of each newly imported track.

The private 20-track planning manifest now selects these two imported candidates for **pre-master QA only**, retains each prior selection and original for rollback, and reconciles all **20/20** selected composition IDs. Total nominal duration **17,747.673149 seconds (4h 55m 47.673s)**.

**Outstanding:** Confirm the `Parte tres` Chapter4→5 boundary by listening and obtain Chapter5 full audio for a lossless transfer if appropriate; other unverified headings, full-book listening, final encoded mastering, PR merge, Descript publish, member delivery and Production remain HOLD/OFF.

## October 10 — Chapter 4 to 5 private recorded Parte III transfer

**New source**: Owner supplied full `07 - Capítulo 5 - El petróleo no es solo una operación de dólar.wav`, **1227.833469s**, PCM16/44.1 kHz/mono. The currently selected corrected Chapter 4 private file (`06F - Capitulo 4 - Part II heading prefixed - PRIVATE QA.wav`, Library file `libfile_daf04360ca508191b858f6d6103a8249`) is **1376.004490s**. Descript SRT: Chapter4 ends with `Verifica los datos actuales antes de utilizarlos. Parte tres` (heading at approximately 22:54.434–22:55.634). Chapter5 begins with `Capítulo cinco` (without a leading `Parte tres`), and contains a *different* final `Parte tres` at 20:26.883–20:27.583. The second instance must remain for the future Chapter5→6 review.

**Private OFFLINE audio repair**: Moved the intact last **79,578 PCM16 samples (1.804489796s)** from Chapter4 to the **front** of Chapter5, splitting Chapter4 at frame **60,602,220 (1374.200000s)**, in a low-energy interval after the disclaimer and before the heading. No TTS, silence insertion, fading, recompression, sample-rate conversion, or alteration of words. The two corrected PCM16 WAVs now last **1374.200000s** (Chapter4) and **1229.637959s** (Chapter5). Combined duration remains exactly **2603.837959s**.

**Technical evidence:** The source and corrected WAV pairs each contain **114,829,254 total PCM frames / 229,658,508 decoded bytes** in exactly the same order. SHA-256 of the combined raw PCM is **`8faf46c7ff3c9194fc2ebd2ad36043c5b5e4c4380052b644d617f15c0a549ee1`** for both. The split's adjacent source samples equal -7/-7 in signed PCM16 (zero discontinuity); the transferred tail ends at sample 0 and original Chapter5 starts at sample 0 (zero join discontinuity). Measured quiet-window RMS **0.0002137** full-scale around the split. These measurements establish sample conservation, **NOT a human acoustic PASS**.

**Private listening kit:** Google Drive `USD Impact/09_QA_Reports/Chapter04_to_Chapter05_PRIVATE_listening_kit.zip`, [owner-only link](https://drive.google.com/file/d/14pgConEzOOVyZervakTql1EsvrfYlY4c/view), with offline browser `index.html` and four before/after lossless WAV samples. The ZIP passed integrity checks; Google Drive permission readback verified `shared=false`, owner-only.

**Full corrected audio handoff:** Full Chapter4 and Chapter5 corrected 16-bit WAVs and equivalent lossless FLAC files were generated in the working sandbox, plus a private two-FLAC bundle. WAV↔FLAC decoded samples compared bit-for-bit equal. Uploading the full outputs into the persistent Library/Drive was attempted but blocked by `container_session_expired`; **do not claim those full-length masters are durably stored**. The *small listening kit* was saved successfully via its exported file reference. Preserve these local working candidates or repeat a verified export before any subsequent import. Do not switch the current selected Descript composition IDs until human PASS and successful new private import.

**Review gate:** Listen to Chapter4 corrected final 12s for complete disclaimer with no trailing `Parte tres`; Chapter5 corrected first ~11.8s for complete `Parte tres. Capítulo cinco`, natural pause and no click. Chapter5's later `Parte tres` is left untouched. Reply **PASS/FAIL/UNCLEAR**; only the reviewed samples are within the verdict. All other heading checks, the full 20-track listening pass and actual output mastering remain PENDING. PR #797 DRAFT/unmerged; 0 public Descript publishes; Production/member release OFF.
