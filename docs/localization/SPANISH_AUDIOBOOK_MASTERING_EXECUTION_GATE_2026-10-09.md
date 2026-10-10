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

## Chapter 2 and Chapter 3 private import accepted

The owner reported PASS for the offline before/after Chapter 2→3 boundary samples. The same two corrected WAVs were imported into separate private Descript compositions, IDs `ebbadbd2-df11-4cba-95d6-a546dd7b3b51` (Track 04, 1107.380s) and `44599961-6954-4dd1-9970-9c2019b4c010` (Track 05, 1142.259184s). Both imports returned SUCCESS and SRT confirmed the repaired placement of `Parte dos`. The separate `Parte dos` at the end of Track 05 remains pending the next chapter boundary review. Both original compositions are preserved.

The private pre-master manifest now selects the corrected imported compositions for Tracks 04/05. A fresh Descript inventory found 20/20 selected compositions, no duration mismatch, and nominal total **17,747.673136s** (4h 55m 47.673s). **No full-length mastered WAV export or listening sign-off** has been completed. Other six heading checks, true-peak/LUFS tests on actual final renders, full-book acoustic and editorial checks remain PENDING.

**Release boundary unchanged:** PR #797 DRAFT/unmerged; 0 Descript public publishes, Production/member delivery OFF, final mastering approval PENDING.

## Chapter 3 to 4 imported private boundary candidates - October 9

The owner listened to the four private A/B Chapter3→4 samples and replied **PASS**, authorizing private candidate preparation only. The Descript import `project-media-import-9ac911c1-7522-42c5-828b-ab88f5a0dc53` has now successfully created and transcript-verified:
- Track05 selected: `afef9b85-5d80-443b-b39d-6ac07a4e298b` (1140.400000 s), with opening `Parte dos. Capítulo tres` and no extra trailing `Parte dos`.
- Track06 selected: `dcc43206-170d-4202-b868-d2e6d8f804a0` (1376.004490 s), with opening `Parte dos. Capítulo cuatro`, trailing `Parte tres` retained for later transfer.

The original Chapter 3/4 Descript compositions and earlier Chapter 3 candidate remain intact. Current 20/20 private composition metadata reconciles to nominal **17,747.673149s (4h 55m 47.673s)**. No full-length imported-track acoustic PASS or encoded mastering measurement has been performed.

A separate read-only agent inspection of the private corrected Introduction completed and flagged its ~07:59 phrase as present and a possible stray `Parte uno` transcript at the end. This is an **acoustic check pending**, not an authorized edit.

**HOLD unchanged:** PR #797 DRAFT/unmerged, Descript public publishes 0, public/member delivery and Production OFF, mastering approval PENDING, remaining Chapter4→5 and other Part-heading reviews plus full-book listening outstanding.

## Chapter 4 to 5 Part III offline candidate — October 10

A complete Chapter5 WAV (1227.833469s) was received and combined with the selected corrected Chapter4 WAV (1376.004490s) for a **source-preserving private offline transfer** of the original `Parte tres` heading. Chapter4→5 cut at **1374.200s** moved **1.804490s** of existing PCM to Chapter5's beginning. Result: corrected Chapter4 **1374.200s**, corrected Chapter5 **1229.637959s**, zero total-duration change, combined decoded PCM SHA-256 unchanged (`8faf46c7ff3c9194fc2ebd2ad36043c5b5e4c4380052b644d617f15c0a549ee1`). No synthesis or mastering effects.

**Human listening PENDING** on four-sample private ZIP [in owner-only Drive](https://drive.google.com/file/d/14pgConEzOOVyZervakTql1EsvrfYlY4c/view). The corrected *full-length* WAV and FLAC source candidates were generated but persistent upload was blocked by expired container session; preserve working files/secure copies before importing. Do **not** switch manifest selections until the reviewer provides scoped PASS and safe private import is verified.

Chapter5's second closing `Parte tres` is intact; subsequent Chapter5→6 alignment is separately pending. Whole-book hearing, encoded mastering measurements, PR merge, public/member/Production release all remain on hold.

## October 10 — Chapter 4→5 private correction selected

- **Owner hearing:** PASS on four private before/after excerpts for moving the existing recorded `Parte tres` from Chapter4 tail to Chapter5 opening. Not a complete chapter or mastering acceptance.
- **Technical import:** Job `project-media-import-21812ed2-3237-4bd6-ac30-3e10825c7db2` completed success, creating private Chapter4 `c99a187a-501f-4a7c-b481-db2f0a179183` (1374.200000s), private Chapter5 `35527a16-bc5e-455a-8989-053d03b0cc41` (1229.637959s). Corrected source recordings preserved 114,829,254 combined PCM frames in unchanged order. Imported SRT confirms heading placement; independent full rendered-sample mastering measurement has not been done.
- **Private plan:** Both new compositions selected in draft manifest; 20/20 selected composition IDs present with nominal sum **17,747.673158 s (4h 55m 47.673s)**. Source originals and prior private correction revisions retained for rollback.
- **Pending heading checks:** Chapter1→2 `03→04`, Chapter5→6 `07→08`, Chapter6→7 `08→09`, Chapter7→8 `09→10`. A second `Parte tres` is intentionally retained at the end of selected Chapter5, pending Chapter5→6 verification.
- **Persistence note:** Full corrected WAV/FLAC standalone storage previously failed due expired container session; Descript imported compositions themselves are now available privately. Owner-only four-sample A/B package remains in Drive.

**HOLD:** final 20-track audio export/encoded LUFS and dBTP tests, end-to-end whole-book listening, legal/editorial verification, mastering approval and publication. PR #797 DRAFT/unmerged; 0 public Descript publishes, member access/Production OFF.

## October 10 — Chapter 5→6 offline correction candidate (not yet selected)

- Owner supplied Chapter6 full 1002.553469-second WAV. The currently selected corrected Chapter5 tail has spoken `Parte tres`; the recorded heading should occur before Chapter6. An offline candidate moved the existing 1.427959-second tail to Chapter6's opening by changing only the split between tracks. The original combined 98,439,642 PCM samples are preserved exactly, SHA-256 `10aca8645f96ed9252ee1d080031d34adce2755c90eb8f854d8d02aaac4c4bee`.
- New unselected full-length private WAV candidate durations: Chapter5 1228.210000s; Chapter6 1003.981429s. Both corrected WAVs are persistent in Library, with lossless FLAC Drive backups. Owner-only [A/B listening kit](https://drive.google.com/file/d/17rjvWeW02CyPf4UyOdWoJiIS1DjJ8pwf/view) is ready.
- **Await owner acoustic PASS on this exact four-sample kit before any private Descript import or review selection.** Selected 20-track manifest still points to prior approved Chapter5 and original Chapter6 compositions; therefore existing duration sum 17,747.673158s is unchanged. On PASS, import two new private compositions, verify SRT/duration, retain rollback IDs and recalculate nominal sum.
- Chapter6 ends with an independent second `Parte tres`, requiring separate Chapter6→7 review. Repeated `Parte uno` at Chapter1→2 and other early headings remain outstanding.

**Release HOLD:** No full-book human pass or final rendered-audio LUFS/true-peak QA. PR #797 draft/unmerged, public Descript publishing zero, Production/member access OFF, mastering approval pending.

## October 10 — Chapter 5→6 private import selected after scoped listening PASS

Owner replied **PASS** on the Chapter5→6 four-sample A/B review of the recorded `Parte tres` transfer. Following PASS, Descript media-import job `project-media-import-a878dc28-6c0e-4bef-a896-32dfa23547b9` completed **SUCCESS** for two lossless FLAC copies of accepted PCM WAVs, creating new private audio-only compositions:

- Selected private **Track07 / Chapter5** `66cdab8b-cb68-4839-82b0-af50fce19c7b` (1228.210000s): final `Parte tres` removed, Chapter5 opening and disclaimer preserved.
- Selected private **Track08 / Chapter6** `d618b058-76c6-4362-94a6-08d681b86224` (1003.981428s): transferred `Parte tres` before `Capítulo seis`, independent closing `Parte tres` preserved for next boundary.

After import, Descript readback confirmed exact durations and expected opening/closing SRT. The private selection reconciles **20/20** compositions with nominal duration **17,747.673165s = 4 h 55 m 47.673s**. Previous and original compositions remain untouched for rollback. All two-track input/corrected PCM samples were preserved in the same order; independently verified pre-import source checksum `10aca8645f96ed9252ee1d080031d34adce2755c90eb8f854d8d02aaac4c4bee`. No speech generation or full render mastering.

**Remaining: Chapter6→7; repeated Part I before Chapter2; Chapter7→8 heading; other editorial QA; completed 20-track human listening and final encoded LUFS/true-peak/silence/clipping measurements.** A scoped sample PASS must not become a full-audiobook mastering PASS.

**Release HOLD unchanged:** PR #797 DRAFT/unmerged; Descript 0 public publishes; Production, membership delivery OFF; mastering PENDING.

## October 10 — Chapter 6→7 offline private boundary candidate (owner listening pending)

- New owner-supplied full Chapter7 WAV paired with corrected selected Chapter6. The separate end-of-Chapter6 `Parte tres` was sample-preservingly transferred into a new **offline-only** Chapter7 opening at a measured quiet cut; total 91,500,669 PCM samples and SHA-256 `cc8b7f8ef4e1a5ff2ecb4caaa6d70dbee8428e7b465925aa2b2989127801538f` are identical in original and corrected combined sequences.
- Corrected unselected candidate durations: Chapter6 1002.300000s, Chapter7 1072.545102s; both corrected full WAVs durable in Library; lossless FLAC backups and [private audition ZIP](https://drive.google.com/file/d/1tVyI5cOrhFWx_mNpVlTMp11OmXEQfkBY/view) stored owner-only in Drive, checksum report linked in chapter-boundary QA.
- **Await new owner PASS on this specific A/B kit before private Descript import/manifest switch.** Existing manifest continues selecting `d618b058-76c6-4362-94a6-08d681b86224` and `f053f190-9233-4869-ba7b-62c5183888da`. Remaining: later Chapter7→8 heading transfer, repeated Part I before Chapter2, whole 20-track listen, actual encoded master LUFS/true-peak tests and legal/editorial signoff.

**Release HOLD:** PR #797 DRAFT/unmerged, Descript publishes 0, member access/Production OFF, mastering approval PENDING.

## October 10 — Chapter 6→7 owner listening PASS; import remains blocked

- Owner replied PASS on four private before/after Chapter6→Chapter7 splice samples; technical pair SHA-256 conserved all 91,500,669 PCM frames and corrected durations are Chapter6 1002.300000s, Chapter7 1072.545102s. This is not the full 20-track listening approval.
- New private Descript import is **not complete**. Import via owner-only Drive links failed because Descript receives an authenticated HTML page; direct-upload PUT was blocked by runtime DNS. Four 6-second empty placeholder compositions from the two stopped/failed upload attempts are not audio candidates and must never be selected.
- Existing 20-track manifest remains on the previously verified, actually available compositions. Await owner-attached lossless Chapter6/Chapter7 files in ChatGPT to finish the two private Descript imports through the supported host attachment workflow; then recheck durations, SRT boundaries and originals before updating the draft manifest.

**Release HOLD:** PR #797 DRAFT/unmerged, Descript public publishes 0, Production and member audio OFF, final mastering, true-peak/LUFS verification and complete-book review PENDING.

## October 10 — Chapter 6→7 private import complete; full mastering still HOLD

**Private accepted source:** owner PASS on four A/B listening samples. Source combined PCM checksum `cc8b7f8ef4e1a5ff2ecb4caaa6d70dbee8428e7b465925aa2b2989127801538f` and expected durations 1002.300000s (Chapter6) plus 1072.545102s (Chapter7). The files were imported successfully as fresh PRIVATE compositions via the supported attached-file route after earlier Drive/direct PUT failures.

- Chapter6 selected `88370601-0fec-4194-90ae-cfbb3a58c89f`: correct opening/closing confirmed in timed editor script; 1002.300000s.
- Chapter7 selected `8ffb044f-fc73-4bf3-8630-9078793a70ae`: correct `Parte tres. Capítulo siete` beginning, independent end heading retained; 1072.545102s.
- Read-only editor inspection confirms full media clip and timed text but `export_transcript` is BLANK; recheck before attempting final archive export. No independent mastered/rendered audio measurement has been done.
- All **20/20** selected private composition IDs and durations reconcile at **17,747.673172s**, about **4h55m47.7s**. Failed 6s placeholders are excluded from selection.

**Still blocked:** Chapter7→8's independent `Parte tres`, Chapter1→2's repeated `Parte uno`, complete 20-track owner listening, mastered encoded audio LUFS/true-peak/silence checks, final compliance/editorial approval and publication decision. **PR #797 remains DRAFT/unmerged, Descript public publishes zero, member and Production release OFF, mastering approval PENDING.**

## October 10 — Chapter7→8 private correction unselected; mastering still HOLD

The accepted corrected Chapter7 WAV (1072.545102s) and the *already selected private corrected Chapter8 candidate* (1010.937098s) were used for a non-destructive offline transfer of Chapter7's final `Parte tres`. New **unselected** candidate durations: Chapter7 **1070.800000s**, Chapter8 **1012.682200s**. Combined PCM samples 91,881,565 preserved exactly, SHA-256 `018fd18b447707a314ec50309e8f9abd50eb75cb14b3f1ccbd3e789dcc27fc50`; full corrected WAVs and verified FLAC backups stored privately.

**Owner listening status: PENDING** for the [Chapter7→8 four-clip listening kit](https://drive.google.com/file/d/1hVRVPCWdcDzwfLSBxn1TM4bsXa3rP7-R/view). No changed private Descript selection or new imported media; current 20-track nominal total remains ~17,747.673172s. After owner sample PASS, import both as private audio-only compositions via supported conversation attachment route; independently verify import lengths/editor script/openings/endings; only then switch the draft manifest. If FAIL/UNCLEAR, repair the offline audio before import.

**Other outstanding requirements:** Repeated `Parte uno` near Chapter1→2; Chapter8's prior private candidate acoustic review, whole 20-track acoustic listening, actual mastered render LUFS/true-peak, legal/editorial sign-off and release approval. PR #797 DRAFT/unmerged, Descript public publishes 0, Production/member delivery OFF, mastering PENDING.

## October 10 — Chapter7→8 samples PASS; private import and master still HOLD

The owner accepted the private Chapter7→Chapter8 four-excerpt audio correction with **PASS**. The repaired samples move a single recorded `Parte tres` from Chapter7's end to the head of the already corrected Chapter8 candidate. Source PCM sample-order and SHA-256 conservation already PASS. The corrected full WAV/FLAC sources are owner-only.

**Import not yet done.** Accepted corrected Chapter7 and Chapter8 audio must be uploaded via private supported path and verified as distinct full-length Descript audio-only compositions (1070.800000s and 1012.682200s). Until then, the current 20-track draft manifest continues to point to the previous selected compositions; do not claim mastering readiness. Chapter1→2 repeated Part I, full-book listening, final rendered LUFS/true-peak tests, legal/editorial QA and final release remain outstanding.

**HOLD unchanged:** PR #797 draft/unmerged, Descript public publishes 0, Production/member delivery OFF, final mastering approval PENDING.

## October 10 — Chapter7→8 private selection verified; mastering still HOLD

After the owner-approved four-clip private Chapter7→Chapter8 `Parte tres` transfer, both corrected lossless FLAC audio attachments were successfully imported via Descript job `project-media-import-85ef7163-ede7-487b-87cb-c94a2f2cfd86`. New private selected compositions:

- **Track09 / Chapter7**: `fc98ab59-811a-4e42-81f6-a08471dc7b0a`, **1070.800000s**: existing opening `Parte tres` preserved, closing moved out.
- **Track10 / Chapter8**: `217a0453-50cb-4b62-9117-e8009c2b1244`, **1012.682199s**: recorded `Parte tres` placed before `Capítulo ocho`; earlier text corrections retained.

Both imported SRT transcripts are nonblank and verify correct first and last words. Source decoded PCM SHA-256 and duration checks pass. New imported Descript audio has not yet been independently rendered and bitwise/audio-mastered; the owner heard only the local excerpt kit, not these full imported compositions. All **20/20** selected private composition IDs and nominal durations reconcile to **17,747.673174s**. Originals and earlier private corrected versions remain available for rollback.

**Still blocking release:** Review the omitted repeated `Parte uno` before Chapter2; complete human listening across the full audiobook; verify actual rendered final audio (integrated loudness, true peak, silences, clipping, missing passages and final selection); obtain final editorial/legal/compliance and owner release approval. The earlier Chapter8 candidate's separate audio QA status is not silently promoted.

**Release HOLD unchanged:** PR #797 DRAFT/unmerged, Descript public publishes 0, public/member delivery and Production OFF, mastering approval PENDING.

## October 10 — Chapter2 repeated Part I unselected private QA candidate

Authoritative Spanish Edition 1.3 Candidate 1 requires an extra recorded `PARTE I` before Chapter2. Agent Underlord duplicated the *currently selected corrected Chapter2* (1107.380s) into a new PRIVATE, UNSELECTED candidate `592e27f8-5337-4058-8f6d-e0f2cb749251` (1108.760224s), then reportedly copied the already-recorded `Parte uno` sound from selected Chapter1's first ~1.06s with natural pause, without any TTS/synthesis or changing Chapter1. New Descript SRT starts with `Parte uno. Capítulo dos`; after dropping those two opening heading tokens, all 2301 baseline normalized Chapter2 core words match exactly, including end disclaimer and no misplaced trailing `Parte dos`.

**Evidence limit:** Descript composition metadata and SRT text verified. Actual copied opening playable audio, absence of clicks/clips and continuity of full Chapter2 recording have **not** been independently listened to or rendered. Source-window report 0–1.600s and net composition increase +1.380224s are not proof of exact signal conservation. Human QA must play new candidate first 8 seconds and separately close the prior Introduction 07:59 / end and Chapter1 start seam checks. On acoustic PASS only, re-verify 20/20 lengths, update Track04 private pre-master selection and retain previous source as rollback.

**HOLD:** The existing 20-track selected manifest is unchanged; current total remains ~17,747.673174s. Full 20-track listening, final rendered LUFS/true-peak and clipping check, legal/editorial signoff, PR merge, public publishing and Production/member delivery remain blocked.

## October 10 — Part I PASS ALL and revised 20-track pre-master total

The owner explicitly replied **PASS ALL** after listening to three targeted Part I checkpoints: selected Introduction around 07:59 and final ~10s, selected Chapter1 opening ~8s, and duplicated corrected Chapter2 opening ~8s with copied recorded `Parte uno` ahead of `Capítulo dos`.

**Private Chapter2 selection advanced:** `592e27f8-5337-4058-8f6d-e0f2cb749251` (**1108.760224s**) replaces prior private pointer `ebbadbd2-df11-4cba-95d6-a546dd7b3b51` (**1107.380000s**) for Track04. New SRT verifies preserved 2301/2301 Chapter2 core normalized tokens and intact disclaimer. Original/previous audio retained. The extra **1.380224s** changes the 20-track nominal selection sum from **17,747.673174s** to **17,749.053398s (4h55m49.053s)**, with **20/20** selected composition IDs available and metadata durations reconciled. No final mastered render was created.

**Acoustic scope:** Owner-targeted clips PASS; complete audio files, all 20 chapters, post-encode peaks, LUFS and silence QA remain untested as a single final delivery set. The original Intro scene-boundary history and other distinct Appendix B, Track00, and source/compliance gates are not erased by this PASS.

**Release HOLD:** Final multitrack private render/encode, whole-book human listening, true-peak/LUFS/clipping/silence measurements, editorial/legal/compliance signoff, distinct owner release authorization, PR merge and Production/member delivery remain PENDING/OFF. Public Descript publishes 0; PR #797 DRAFT/unmerged.

## October 10 — Full 20-track private preflight: METADATA PASS, MASTERING HOLD

**Detailed [private 20-track evidence report](./SPANISH_AUDIOBOOK_FULL_20_TRACK_PRIVATE_PREFLIGHT_2026-10-10.md).** As of the October 10 readback, all 20 selected composition UUIDs exist with duration agreement (<0.005s), nominal total **17,749.053398s = 4h55m49.053s**, and 20/20 nonblank SRT transcript exports. **Do not confuse transcript/metadata QA with acoustic or final delivery approval.** Report includes exact private Descript composition links and four suggested sequential owner listening blocks.

**Partial offline (non-master) loudness evidence:** Preserved corrected Chapter5/6/7/8 source WAVs measure **−23.99 / −24.03 / −23.91 / −23.89 LUFS** and **−7.80 / −7.74 / −7.73 / −7.77 dBTP**. Their 250ms-block RMS checks found no five-second silence runs at −45dBFS. Existing Track00 original MP3 measures **−16.09 LUFS / +0.46 dBTP** and has independently confirmed transient spikes near 46.779s and 46.874s; a separate offline declick copy measures **−16.08 LUFS / +0.04 dBTP** but has not been verified as the selected Descript final render. An independent Appendix B mastering test MP3 measures **−16.31 LUFS / −2.21 dBTP**. Cross-stage source results **must not be treated as comparable final master exports**; output normalizing/encoding measurements remain PENDING.

**New blockers / evidence reconciliation:**
1. **Track00 selector conflict:** 20-track manifest points to copyright-tail v2 `ebe7f026-e369-4dd4-a184-9476a6482f5b`, but `track00_current_selection` explicitly records owner preference for first original `91240c6b-78df-4910-a994-43c616f9b53f` with unresolved click. Do NOT silently choose; require an explicit final Track00 decision, then rerun 20-track reconciliation and audible check.
2. **Appendix B ending:** selected `6a251168-1d0d-4a9d-b9ea-daed1d1db016` SRT stops at **869.884s**, while duration is **883.028s**, leaving **13.144s** uncovered by SRT. Read-only Descript timeline inspection confirms full unmuted source `18-15.mp3` runs **823.547–883.028s**, no identified gap/overlay, but it cannot tell whether this final section contains speech. Separate offline MP3 test has substantial audible-level signal in the equivalent final 13s. Owner audition **14:25–14:43** required, especially hash/production authority readout; no automatic edits.
3. **Appendix A/B titles:** ASR `Aprendáis a glosario` and English `Appendix B` differ from Spanish Edition1.3 source `Apéndice A / Apéndice B`. Previous owner PASS of short appendix reel remains recorded, but a check in actual selected full-length renders is still needed; never resynthesize based solely on ASR.
4. **Final 20 rendered masters absent:** Connected Descript export-timeline produces metadata only, not audio. Browser connector is disconnected; no authenticated Descript cloud-browser session is available. Do not publish simply to export. Obtain strictly PRIVATE audio exports, then run full decode/silence/peak/LUFS/channel/duration and 20-track sequential hearing QA.
5. **Editorial and legal review** of source headings, copyright exception wording, checksums/production metadata and track-level compliance remains separate.

**Mastering gate remains PENDING.** PR #797 is DRAFT/unmerged, Descript public publishes remain zero; member delivery, Prod and merge OFF. No release authorization is inferred from prior snippet/reel PASS responses or this preflight.

## October 10 — Track00 choice delegated and selected v2 retained; Appendix B source narrowed

**Track00 private selection conflict CLOSED:** Owner said `it doesn't matter, continue`. The 20-track selected private manifest remains on previously listened and currently selected `ebe7f026-e369-4dd4-a184-9476a6482f5b` (copyright-tail QA v2, 109.835306s). The conflicting `track00_current_selection` was updated to that ID and historic first-original `91240c6b-78df-4910-a994-43c616f9b53f` preserved under `track00_selection_history`, not deleted. Current choice is **only for PRIVATE pre-master**; prior owner v2 PASS applied to 0–9s and 42–51s, not the full rendered master. Actual WAV/encoded LUFS, true peak and click checks remain PENDING. Original's click is not assumed to be present in v2.

**Appendix B ending issue refined:** Private source asset `18-15.mp3` is present and continuous through selected composition's 883.028s end. Its SRT ends at 869.884s. Source manuscript pipeline hash `f51f7abf2d4ec99890eb5537424f6faab885ef32` differs from Descript's TXT ASR `F51F7ABF2D4EXE99890EB55374246FAB885F32`. Cannot conclude audio is incorrect or silent; check 14:25–14:43 on actual selected track and verify intended audiobook treatment of hash. Selected Appendix A/B opening ASR needs targeted pronunciation review. No source changes, TTS or speculative edits.

Full [private 20-track evidence report](./SPANISH_AUDIOBOOK_FULL_20_TRACK_PRIVATE_PREFLIGHT_2026-10-10.md) retains four whole-book listening blocks and exact private links. The 20 selected compositions reconcile to 17,749.053398s, with 0 Descript publishes.

**RELEASE HOLD unchanged:** Descript private selected candidates only, final media masters not exported/measured, complete listening PENDING, PR #797 draft/unmerged, Production/member delivery OFF, editorial/legal/mastering approval PENDING.

## October 10 — Private browser export and QA runbook linked

Created [browser-only private 20-track export and acceptance runbook](./SPANISH_AUDIOBOOK_PRIVATE_20_TRACK_EXPORT_AND_QA_RUNBOOK_2026-10-10.md) with 20 exact selected composition URLs/UUIDs, expected durations, private WAV filenames, four end-to-end listening blocks, mandatory Track00 and Appendix A/B targeted playback checks, and provisional exported-media signal tests. This reduces manual ambiguity and excludes failed 6-second placeholders.

**Track00 choice is resolved for private pre-master** as copyright-tail QA v2 `ebe7f026-e369-4dd4-a184-9476a6482f5b`, with original rollback preserved. **No selection preference question remains.** The remaining audio gate is factual: actual private exported v2 full playback, LUFS/true peak and click verification. The selected Appendix B last 13.144 seconds needs direct audio listening, not changes based solely on incomplete ASR.

The connected Descript tools cannot privately export the final WAV media themselves (timeline is metadata only; publication is prohibited), so **full mastering must not be called complete** until the actual private audio exports are present, objectively measured and owner-approved. No Production or member delivery. PR #797 DRAFT and unmerged, Descript public publishes 0, mastering status PENDING.
