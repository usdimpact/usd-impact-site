# Spanish Audiobook Track 00 — EDL Reconstruction Evidence

Date: 2026-10-27  
Scope: private QA only  
Release authority: none

## Purpose

Resolve the selected Track 00 v2 provenance/edit question without requiring browser login to Descript.

Selected composition:

`ebe7f026-e369-4dd4-a184-9476a6482f5b`

Prior rendered v1 composition:

`8efce146-f4c8-4a8f-89c0-b0bd5402abac`

Raw imported source:

`spanish-track00-copyright-removed-declicked-private-QA-2026-10-09-1.wav`

## Descript EDL evidence

Both v1 and selected v2 were exported through Descript's non-publishing timeline export.

### v1

- sample rate: 44,100 Hz
- output channels: 1
- one source clip
- source/play range: sample 0 -> 4,877,253
- record/output range: sample 0 -> 4,877,253
- clip gain shown by EDL: -8.0 dB

### selected v2

Two source ranges from the same media:

1. source 0 -> 115,542 maps to output 0 -> 115,542
2. source 149,058 -> 4,877,253 maps to output 115,542 -> 4,843,737

Therefore the selected v2 removes exactly:

- start sample: 115,542
- end sample (exclusive): 149,058
- removed samples: 33,516
- removed duration: 33,516 / 44,100 = **0.760000 s**
- output samples: **4,843,737**
- output duration: **109.835306122449 s**

This matches the selected Descript composition duration.

The exact removed source interval is therefore **2.620000 s -> 3.380000 s**. Earlier ASR word boundaries around "Right" were approximate and should not be used as sample edit coordinates.

## Preserved source evidence

Private raw source retrieved from Drive:

- format: PCM 24-bit
- sample rate: 44,100 Hz
- channels: mono
- duration: 110.595306 s
- SHA-256: `98b5c92d291ed09881a7d1bef284a937fad04f2a61f4de4160767bb616efb0d5`

Existing private rendered v1 WAV:

- format: PCM 16-bit
- sample rate: 44,100 Hz
- channels: mono
- frames: 4,877,253
- duration: 110.595306122449 s
- SHA-256: `d226c7d842ab8c6efb219c972ca4fce86c942f0a06fc140f9a0c0504b8553e49`

## Offline render-equivalent QA candidate

A private QA candidate was produced by removing the exact v2 EDL output interval from the existing rendered v1 WAV.

Result:

- frames: **4,843,737**
- duration: **109.835306122449 s**
- sample rate: 44,100 Hz
- channels: mono
- bit depth: 16-bit PCM
- SHA-256: `fcef044efb009088e78d42dfdf5a280213ac2379275eff533b286381c94612f1`
- EDL output-frame match: **PASS**

At the reconstructed splice, the last retained sample before the cut is 0 and the first retained sample after the cut is 4,247, corresponding to an instantaneous difference of approximately -17.75 dBFS relative to full scale. Owner targeted listening of the selected v2 opening was already recorded as PASS, so this measurement is not independently classified as an audible click.

## Important render limitation

The raw 24-bit source plus a simple -8 dB conversion does **not** reproduce the known Descript v1 rendered WAV sample-for-sample. Descript therefore applies additional rendering/processing or conversion behavior not captured by the EDL.

Consequently:

- the EDL establishes the **exact edit and duration**;
- the offline candidate is a strong **render-equivalent QA reconstruction** from the already-rendered v1;
- it must **not** be called a byte-identical Descript v2 export;
- final mastered-release provenance still requires either an actual private Descript WAV render or a separately approved mastering source workflow.

## Login disposition

Google SSO browser automation reached a Google MFA challenge. No password, MFA code or device approval was requested in chat.

The EDL reconstruction path removes the need for Descript browser login for:
- exact Track 00 cut coordinates;
- selected v2 duration confirmation;
- private QA reconstruction;
- structural provenance.

Browser login is now required only if the project demands an actual Descript-rendered WAV byte stream for final-master provenance.

## Controls

No composition edits, publish/share action, synthesis, member upload, Production deployment, entitlement change or PR merge occurred.

PR #797 remains Draft/unmerged; release HOLD remains active.
