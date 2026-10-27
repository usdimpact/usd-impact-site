# Spanish Audiobook Private QA Closeout Checkpoint — 2026-10-27

Status: **PRIVATE QA ADVANCED / RELEASE HOLD**
PR: #797
Branch: `feat/spanish-audiobook-pilot-foundation`

This checkpoint reconciles the current private Descript project, the selected 20-track manifest, owner-reported full-track listening, and the remaining release blockers. It does not authorize merge, publication, member delivery, synthesis, Production changes, or public Descript sharing.

## Controls

- `production_enabled=false`
- `public_allowed=false`
- `merge_allowed=false`
- `publication_approval=NOT_GRANTED`
- mastering approval remains **PENDING**
- public/member delivery remains **OFF**
- Descript public publish count remains **0**

## Selected-program state

The canonical private review manifest identifies exactly 20 selected tracks, 00–19, with explicit selected Descript composition IDs.

Owner-reported listening recorded in PR #797 now covers **20/20 selected compositions: PASS**, with no defect notes in the final A/B/C/D listening blocks.

This owner listening result is acoustic/editorial listening evidence only. It is not:
- final mastering certification;
- independent legal clearance;
- lossless-export provenance;
- waveform/true-peak/LUFS certification;
- public distribution approval.

## 2026-10-27 read-only exact-risk verification

Agent Underlord inspected only the exact selected compositions. No composition was changed.

### Track 00 — selected v2
Composition: `ebe7f026-e369-4dd4-a184-9476a6482f5b`

- opening through 2026: 00:00.00–00:04.49
- disclaimer/cautions: 00:43.55–01:22.71
- residual word `Right` is explicitly ignored in the selected v2 transcript
- no active duplicate opening or obvious transcript omission found

Disposition: owner full-track listening PASS already recorded; legal adequacy of spoken rights wording remains a release gate.

### Track 08 — Chapter 6 real-yield example
Composition: `88370601-0fec-4194-90ae-cfbb3a58c89f`

Target range: 11:53.44–12:49.91.

The selected transcript contains the complete real-rate/gold worked example and associated values. ASR renders DFII10 as `DFI uno cero` and +1.5% as `más uno cinco`; these are ASR uncertainties, not proof of an acoustic defect.

Disposition: no regeneration is justified from transcript output alone.

### Track 17 — Appendix A
Composition: `625d0a1a-1bf2-42ac-b363-cb8b525e660b`

- title: 00:00.00–00:03.92
- MXN heading/definition: 11:41.48–12:00.40
- ASR renders the title as `Aprendáis a` and MXN as `Mil pesos mexicano`
- no ignored or duplicated target text found

Disposition: ASR uncertainty only; owner listening PASS remains the controlling acoustic evidence unless a later human listener reports a defect.

### Track 18 — Appendix B repaired candidate
Composition: `6a251168-1d0d-4a9d-b9ea-daed1d1db016`

- title: 00:00.00–00:06.20
- inserted source-reference sentence: 02:52.84–03:25.12
- normalization/formula block: 03:25.12–04:37.36
- pipeline-authority passage: 14:23.34–14:43.03

The complete inserted source-reference sentence appears **once** in active transcript text. A shorter related fragment survives only as ignored text, not as an audible active duplicate.

The repair clip boundaries are identifiable at:
- `172.836489 s`
- `205.123835 s`

The inserted clip duration is `32.287346 s`. Adjacent clip edges meet without a reported clip-level gap or overlap.

## Pipeline authority reconciliation

The authoritative Score v2 production-pipeline commit recorded in the governed publication freeze is:

`f51f7abf2d4ec99890eb5537424f6faab885ef32`

Repository: `usdimpact/usd-impact-pipeline`

The selected Track 18 Descript ASR renders the spoken identifier as:

`F51F7ABF2D4EXE99890EB55374246FAB885F32`

That ASR token contains `X` and is not a valid hexadecimal commit identifier. It must therefore **not** be treated as the authoritative SHA or as evidence that the audio is wrong. The source authority remains the governed repository commit above.

No synthesis or replacement should be triggered from the ASR mismatch alone.

## What is now closed

- 20 selected Descript composition identities: established.
- owner full-track listening: 20/20 PASS recorded.
- selected-track transcript-risk locations: established.
- Track 18 repair sentence active-occurrence count: one.
- Track 18 splice boundaries: structurally identified.
- authoritative Score pipeline SHA: reconciled.
- no evidence requiring new HeyGen synthesis.
- no reason to change selected composition IDs based on ASR.

## Remaining release blockers

### 1. Lossless selected-export provenance
The existing private Drive WAV folder contains alternates and repair candidates. Filename/duration alone cannot certify that each file is the lossless export of the exact selected Descript composition.

Required for each selected track:
- selected composition ID;
- exported filename;
- export timestamp;
- WAV/PCM format;
- sample rate;
- bit depth;
- channel count;
- checksum.

### 2. Final mastering measurements
Run measurements only after exact selected-export identity is established:
- decoder integrity;
- integrated LUFS;
- true peak;
- sample clipping;
- excessive silence;
- cross-track loudness balance;
- beginning/end seam review.

No provisional mastering target becomes binding until explicitly approved.

### 3. Legal/publisher release clearance
Still required:
- spoken rights/copyright adaptation;
- final edition/publication labeling;
- accessible companion/player treatment for non-narrated printed navigation aids;
- final distribution authorization.

### 4. Final release decision
PR #797 must remain Draft/unmerged until the release blockers above are explicitly cleared. A merge is not required for private QA progress and should not be used as a substitute for audio-master evidence.

## Manual UI step required next

The connected Descript tools do not expose a lossless WAV export with verifiable WAV sample-rate/bit-depth/channel controls.

Use the Descript desktop/web export UI on the exact selected compositions and export **private local WAV files only**. Do not use Publish/Share.

After export, record the composition-to-file mapping and retain the files in the private QA folder. Those files can then be measured and reconciled before any final-master decision.

No public publishing, member upload, Production deployment, or entitlement change is part of this step.
