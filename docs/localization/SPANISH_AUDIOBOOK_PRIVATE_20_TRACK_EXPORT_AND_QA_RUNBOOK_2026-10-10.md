# Spanish audiobook — private 20-track export and acceptance runbook

**Created:** 2026-10-10 · **Scope:** Private pre-master/owner QA only · **Do not publish, merge or deploy**

- [Live evidence report](./SPANISH_AUDIOBOOK_FULL_20_TRACK_PRIVATE_PREFLIGHT_2026-10-10.md)
- [Current selected 20-track private manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json)
- [Listener signoff tracker](./SPANISH_AUDIOBOOK_LISTENER_SIGNOFF_TRACKER_2026-10-09.md)
- [Descript private project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca)
- [Draft PR #797](https://github.com/usdimpact/usd-impact-site/pull/797)

## Decision already made: Track 00

The owner delegated Track00 preference: “it doesn't matter, continue”. Keep currently selected **copyright-tail v2** `ebe7f026-e369-4dd4-a184-9476a6482f5b` (109.835306s), which was previously heard and passed for targeted opening and disclaimer clips. The historical original `91240c6b-78df-4910-a994-43c616f9b53f` has a reported click at ~47s and remains as rollback, **not** in this export list. The manuscript copyright exception wording remains unchanged. This decision is PRIVATE selection only, **not approval of a final mastered opening**.

## First: targeted checks before whole-book export

1. **Appendix B last 18 seconds** — open the [selected private Appendix B](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251) and play from **14:25 to 14:43**. Its Descript SRT stops at 14:29.884 but the source clip `18-15.mp3` continues unmuted through 14:43.028. Verify whether the final spoken material is intelligible and source-aligned. The manuscript finishes with a site/pipeline authority identifier; Descript TXT shows a non-identical last hash with `X`, which may be ASR confusion. Do not delete/fabricate any checksum speech without editorial approval.
2. **Appendix A opening** — play **0–10s** of [selected Appendix A](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/625d0). Descript ASR prints “Aprendáis a glosario” but manuscript requires “Apéndice A — Glosario rápido”. Is the **actual audio** acceptable?
3. **Appendix B opening** — play **0–10s** of [selected Appendix B](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251). Descript ASR prints “Appendix B” but manuscript requires “Apéndice B”. Determine whether this is an ASR error or an actual language mismatch.
4. **Track00 v2** — play **0–110s** of [selected copyright-tail v2](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/ebe7f). Check opening words, absence of click around the *corrected* disclaimer transition, intact educational disclaimer, absence of stray “Right”, and no lost syllables. Prior owner PASS covered only the opening **0–9s** and disclaimer **42–51s**.

Record PASS / FAIL / UNCLEAR and exact segment time in the existing listener tracker. A FAIL blocks the affected composition; repair only a fresh private duplicate and require a new scoped listening decision. Do not modify canonical source or shared effects settings such as Studio Sound.

## Export: beginner instructions in Descript

No local software installation required. Use the existing browser at `web.descript.com` with your authorized account.

1. Open the **specific selected private composition** by clicking its name in the inventory table below. Do not use a previous or original version, and never export any of the incomplete 6-second upload placeholders.
2. With the correct composition selected, click **Export** (upper-right in Descript).
3. Choose **Audio**. Set **Destination → Local export**, **Export options → Selected compositions (1)** and **Format → Lossless WAV audio (.wav)**. This is the export flow previously visible in the user's Descript screenshots; controls may be labeled slightly differently after UI updates.
4. Expand Advanced only if needed; keep the unaltered private candidate and avoid hidden speech enhancement, new voice generation or automatic gain processing at this stage.
5. Click **Export**. Save/download the WAV into a private folder, renaming it to the table's `ES_XX_PRIVATE_QA.wav` filename if necessary. Repeat for each of the **20 selected** IDs below. Do not export the whole Descript project containing 65 compositions or create a public share link.
6. Keep the unmodified exported WAV alongside any later mastered MP3/AAC. Upload/attach the resulting private files to the QA chat or a secured, explicitly chosen private location for automated measurement. Do not make them public.

**If Descript supports reliably selecting exactly these 20 compositions as a batch**, batch-export may be used only after checking the list against the UUID table. If exact selection is uncertain, use the one-at-a-time method above.

## Exact selected inventory for private QA export

Export formats, names and exact composition IDs matter. Durations below are LIVE composition metadata, not yet audio-file measurements.

| # | Selected private composition | UUID | Expected duration | Private export filename | Acoustic/encoded QC |
| --- | --- | --- | ---: | --- | --- |
| 00 | [Opening](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/ebe7f) | `ebe7f026-e369-4dd4-a184-9476a6482f5b` | 1:49.835 | `ES_00_PRIVATE_QA.wav` | PENDING |
| 01 | [Acknowledgments and reader guide](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/a65d7) | `a65d72b2-4c79-454c-9215-0c292d856b69` | 3:48.571 | `ES_01_PRIVATE_QA.wav` | PENDING |
| 02 | [Introduction, corrected variant](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/aecc1) | `aecc180b-4513-455b-a3e4-fce58da36fac` | 13:57.440 | `ES_02_PRIVATE_QA.wav` | PENDING |
| 03 | [Chapter 1, corrected variant](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/686a4) | `686a4f65-8ff9-4141-aedb-bab9b4296602` | 17:45.766 | `ES_03_PRIVATE_QA.wav` | PENDING |
| 04 | [Chapter 2](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/592e2) | `592e27f8-5337-4058-8f6d-e0f2cb749251` | 18:28.760 | `ES_04_PRIVATE_QA.wav` | PENDING |
| 05 | [Chapter 3](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/afef9) | `afef9b85-5d80-443b-b39d-6ac07a4e298b` | 19:00.400 | `ES_05_PRIVATE_QA.wav` | PENDING |
| 06 | [Chapter 4, final private variant](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/c99a1) | `c99a187a-501f-4a7c-b481-db2f0a179183` | 22:54.200 | `ES_06_PRIVATE_QA.wav` | PENDING |
| 07 | [Chapter 5](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/66cda) | `66cdab8b-cb68-4839-82b0-af50fce19c7b` | 20:28.210 | `ES_07_PRIVATE_QA.wav` | PENDING |
| 08 | [Chapter 6](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/88370) | `88370601-0fec-4194-90ae-cfbb3a58c89f` | 16:42.300 | `ES_08_PRIVATE_QA.wav` | PENDING |
| 09 | [Chapter 7](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/fc98a) | `fc98ab59-811a-4e42-81f6-a08471dc7b0a` | 17:50.800 | `ES_09_PRIVATE_QA.wav` | PENDING |
| 10 | [Chapter 8](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/217a0) | `217a0453-50cb-4b62-9117-e8009c2b1244` | 16:52.682 | `ES_10_PRIVATE_QA.wav` | PENDING |
| 11 | [Chapter 9](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/d1540) | `d154039c-2b7d-4002-9bd3-032e3531eef1` | 15:16.027 | `ES_11_PRIVATE_QA.wav` | PENDING |
| 12 | [Chapter 10](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/ade2a) | `ade2a5e4-2b8d-4342-8fc4-1869f61cd42d` | 18:09.773 | `ES_12_PRIVATE_QA.wav` | PENDING |
| 13 | [Chapter 11](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/8644e) | `8644e0dc-4fc1-475a-ab30-85a53521445b` | 15:30.629 | `ES_13_PRIVATE_QA.wav` | PENDING |
| 14 | [Chapter 12](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/fc7b5) | `fc7b5ff2-9f63-4e36-ba53-00240cb05058` | 19:27.664 | `ES_14_PRIVATE_QA.wav` | PENDING |
| 15 | [Chapter 13](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/34e4b) | `34e4b853-0b77-4a21-9830-f231a9045383` | 22:27.663 | `ES_15_PRIVATE_QA.wav` | PENDING |
| 16 | [Further reading](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/827db) | `827db26b-1a82-4f29-a588-48eadadca1a7` | 2:28.376 | `ES_16_PRIVATE_QA.wav` | PENDING |
| 17 | [Appendix A, glossary](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/625d0) | `625d0a1a-1bf2-42ac-b363-cb8b525e660b` | 17:23.331 | `ES_17_PRIVATE_QA.wav` | PENDING |
| 18 | [Appendix B, repaired private candidate](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/6a251) | `6a251168-1d0d-4a9d-b9ea-daed1d1db016` | 14:43.028 | `ES_18_PRIVATE_QA.wav` | PENDING |
| 19 | [About the author](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca/1d15c) | `1d15c8e2-dc3f-4c2d-9b95-b84a435dcb0b` | 0:43.598 | `ES_19_PRIVATE_QA.wav` | PENDING |

**Total selected duration: 4:55:49.053 = 17,749.053398 seconds.** This sum is across separate chapters and does not include added global spacing, mastering tail pads or encoder delay.

## Whole-book human listening blocks

The required playback is **the entire currently selected composition set**, not a transcript sample or a previously approved short reel.

| Block | Tracks | Nominal total | Full-audio decision |
| --- | --- | ---: | --- |
| A | 00–04 | 55:50.372 | PENDING |
| B | 05–09 | 1:36:55.910 | PENDING |
| C | 10–15 | 1:47:44.439 | PENDING |
| D | 16–19 | 35:18.332 | PENDING |

For each selected track, record: start time, full duration heard, voice/timbre/pacing; part heading and title; pronunciation and abbreviations (DXY, WTI, GNL, BIS, FRED, ICE, CME, CFTC etc.); whether the complete chapter body appears; all compliance endings and natural transitions; silence/dropouts/clicks; playback device; owner verdict PASS/FAIL/UNCLEAR. Preserve exact timecoded defect notes. **Do not mark tracks passed based on SRT or duration alone.**

## Automated private WAV checks (read-only)

A Python/FFmpeg checker is now available on this **draft branch only**:
- [Source](../../scripts/audio/spanish_audiobook_private_qc.py)
- [Synthetic tests](../../scripts/audio/tests/test_spanish_audiobook_private_qc.py)

It reads exactly the 20 private export files listed above, matches expected manifest filenames/durations, calculates SHA-256, probes sample rate/channel layout, decodes via FFmpeg, measures **input** integrated LUFS, true peak and LRA, identifies amplitude-based intervals below **−45dB for at least 5 seconds**, and flags files with loudness spread more than **2.5 LU from the median**. All thresholds are **provisional review triggers, not an approved mastering profile**. It never edits, uploads, normalizes or publishes the source audio.

**Once the 20 WAVs have been privately exported to a secure working directory**, run this from the repository's cloud development environment, not on your desktop:

~~~bash
python3 -m unittest discover -s scripts/audio/tests -p 'test_spanish_audiobook_private_qc.py'
python3 scripts/audio/spanish_audiobook_private_qc.py \
  --manifest docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json \
  --audio-dir /secure/private/spanish-audio-wavs \
  --output /secure/private/audio-qa/private_audio_qc.json
~~~

Use \`--metadata-only\` for the initial fast completeness/duration pass. Requires Python 3 and FFmpeg/FFprobe on the **cloud runner**; the user need not install anything locally. Exit codes: **0** = measured without automatic review flags, **2** = files missing or review flags, **3** = setup/manifest failure. Neither exit code 0 nor a clean JSON report implies acoustic, legal or mastering approval.

**Security/identity caveat:** WAV filenames and expected composition UUIDs in the JSON report do not cryptographically prove which Descript composition generated each file. The reviewer must confirm exact UUID and selected private composition before and during export. Keep exported WAVs and generated QA JSON in **private storage**, not in GitHub commits, public Actions artifacts or published Descript links. Runbook and code contain **no customer audio or credentials**.

The core checker was tested locally on generated synthetic WAVs for a normal tone, a missing export, an invalid track name and a long silence. CI run verification on this GitHub branch is separate and has not been claimed.

### Actual corrected-source smoke test (not exported Descript master)

The QA checker was additionally run against one actual private **corrected source WAV** (not a final selected Descript audio export) for selected Track08 / Chapter6, using a synthetic one-track manifest to avoid falsely claiming the other 19 are available. Results: **1002.300s** duration matching its source baseline, **−24.03 LUFS**, **−7.74 dBTP**, LRA **2.1 LU**, no ≥5s intervals under the amplitude-based −45dB threshold, and no review flags. The decoded metrics agree with the earlier source-audio audit.

**This is a functional smoke test of the QA pipeline, not a PASS for 20 Descript exports or an approval of final mastering.** The exact private source remains unmodified; JSON test evidence was retained only in the temporary QA workspace, not published or attached to PR #797.

## Objective QA to run on actual uploaded private WAVs

For each **actual final selected export**, capture a machine-readable result with: basename; matching composition UUID; file byte size; SHA-256; sampling frequency/channels/bit depth; frame count and exact decoded length; decode failures; peak sample amplitude; true peak dBTP; integrated LUFS and short-term range (LRA); longest low-RMS silence interval plus its start/end; potential sudden discontinuities; source/content parity and identity of exported track.

Suggested provisional **flag thresholds**, not finalized production policy:
- Missing/nonmatching file, decode error, mismatch with selected composition name/UUID, truncated first or last phrase: **FAIL**.
- WAV duration discrepancy beyond ~**0.5 second** from selected composition metadata: **INVESTIGATE** (possible export tail behavior); document encoding padding and any intentional trim.
- Measured true peak at or above **0 dBTP**, audible clipping/distortion: **INVESTIGATE/FAIL**.
- Long low-RMS interval beyond **5 seconds** under **−45 dBFS RMS**: **FLAG** for listening; not automatic deletion (intentional silence may exist).
- Uneven integrated loudness across *final mastered* chapters: **INVESTIGATE**. Offline Chapter5–8 source WAVs currently measure near **−24 LUFS** while a different-stage Appendix B mastered trial measures near **−16 LUFS**; do not compare these as final masters. An earlier **−16 LUFS / ≤−2 dBTP** mastering trial is a *reference only*, not a locked approved spec.

The QA agent may generate review results/reports and a **new isolated candidate master** after an explicit, scoped private mastering workflow. It must not overwrite sources, normalize selected Descript compositions in place, re-synthesize voices, publish, modify Production or change entitlements. Any final encoded files must be measured **after** encoding, not solely as lossless WAVs.

## Release gate

**HOLD** until all of: exact private exported audio availability, 20/20 objective file and mastered-encode checks, targeted Appendix A/B issues resolved by listening, 20/20 complete playback PASS, source/copyright/compliance review, separate owner mastering and release authorization.

**Current invariants:** [PR #797](https://github.com/usdimpact/usd-impact-site/pull/797) DRAFT/unmerged; Descript publishes 0; current selected IDs preserved; Production/member delivery OFF; mastering approval PENDING; publicAllowed false; mergeAllowed false.

## October 10 — Appendix opening checkpoints closed for selected recordings

Owner reply **PASS BOTH** closes the first 10 seconds of selected Appendix A and selected Appendix B as targeted pronunciation checks. Earlier owner PASS separately closes selected Appendix B's ending **14:25–14:43** as an audible excerpt. **Do not re-request these same checks unless the selected recordings change.**

Remaining open: Appendix B identifier character-level manuscript/ASR reconciliation; complete playback of 20 selected compositions including full Appendix A/B; full selected Track00 v2 playback; actual private audio WAV exports, objective master checks and legal/editorial approval. No publication or merging is authorized.
