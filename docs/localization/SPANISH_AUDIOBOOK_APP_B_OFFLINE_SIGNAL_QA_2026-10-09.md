# Spanish audiobook — Appendix B independent signal QA (2026-10-09)

**Release disposition: PRIVATE QA HOLD — NOT A MASTERING PASS.**

This document records a read-only, independent reconstruction from preserved **private** GitHub Actions audio artifacts. It is **not** a rendered/exported Descript composition; waveform and acoustic conclusions about the actual Descript playback remain unverified. No member delivery, Descript publication, Production deployment, paid synthesis, original-master overwrite, entitlement, or commerce change is authorized by this record.

## Source evidence

- Canonical unmodified Descript Appendix B composition: `aef945b9-0b31-48ad-9ec6-270c80f639c7` (859.062850 s).
- Separate **DO NOT PUBLISH** repair candidate: `6a251168-1d0d-4a9d-b9ea-daed1d1db016` (883.027503 s).
- Original `18-01`–`18-08`: GitHub artifact `11577893181` (run `37842325398`).
- Original `18-09`–`18-11`: artifact `11579291355` (run `37844306100`).
- Original `18-12`: artifact `11581316339` (run `37848963290`).
- Original `18-13`–`18-15`: artifact `11580478314` (run `37849165505`).
- Targeted `99-02-reference-repair`: artifact `11581931482` (run `37850234396`).
- Every recovered source is MP3, mono, 44,100 Hz; the 15 original segments decode independently, and the replacement measures 32.287344 s (Descript reports 32.287346 s).

## Objective, reproducible findings

1. **Structural duration cross-check:** sum of FFprobe original segment durations = **859.062658 s** vs original Descript **859.062850 s** (minor decoder/metadata rounding). The inferred end of retained original `18-03` = **40.891995 s**. Constructing 18-01, 18-02, retained 18-03, 99-02, and 18-04 through 18-15 in order produces **883.027506 s** PCM audio, **0.000003 s** from the Descript private repair candidate's reported duration. This strongly supports timing arithmetic, **not** identity of Descript-exported audio.
2. **Repair positioning:** reconstruction places insertion around **172.836464–205.123810 s**, versus Descript transcript scene bounds **172.836489–205.123835 s** (~25 microseconds offset due to duration/sample rounding). Adjacent paragraph ordering matches the candidate transcript.
3. **Unmastered reconstructed audio — FFmpeg loudnorm first-pass measurement:** integrated **−15.99 LUFS**, maximum true peak **+0.20 dBTP**, loudness range **2.20 LU**; conventional sample peak reaches **0.0 dBFS**, with 43 decoded 16-bit samples at absolute full-scale out of 38,941,513. The positive true peak and sample saturation require **peak-safe mastering review**. They do not establish the same peaks in Descript's final export, nor a subjective audible defect.
4. **Potential splice-click risk at retained `18-03` → repair:** reconstructed raw PCM stops on a nonzero sample (~752/32768) before zero-valued samples, a discrete step of about **−32.8 dBFS** relative to full scale. Unlike the other silence-to-silence joins, this trimmed transition may click; **listen before approving**. This is reconstruction evidence, not acoustic QA of the Descript candidate.
5. **Repair → 18-04:** the measured below−40 dBFS pause crossing the join is ~**586 ms**, comparable to the other non-repair joins (median ~**612 ms**). This supports a natural-sized pause, but does not confirm absence of all sub-frame issues or pronunciation errors.
6. **Private A/B test, not published:** create two identical 58-second **QA-only** excerpts spanning 02:38–03:36 from the independent reconstruction, one raw cut and one with an **8 ms fade-out applied only to the original clip immediately before the cut**. In the unencoded 44.1-kHz PCM, the end samples change from `[1441, 752, 0, 0]` to `[8, 2, 0, 0]`. The test affects 351 samples; no unrelated passage was modified. The short MP3 previews are private workspace QA references, **not** delivery masters or proof of Descript output.

## Remaining acceptance gates

- Listen to **both** the raw and smoothed splice excerpts for a click or abrupt voice change; inspect the actual Descript composition at ~02:52.836 and ~03:25.124.
- Verify the ignored residual `FRED para rendimientos … Bitcoin` is truly silent in Descript, not audible twice.
- Listen for exact ICE, CME/NYMEX, S&P Dow Jones Indices, Cboe, Treasury/FRED pronunciation; the independent transcript alone is not a spoken-audio PASS.
- Before member release, export the actual **private** Descript candidate through an approved controlled QA path and measure integrated loudness, true peak, clipping, joins, and final encoded output. Select/approve the mastering target before normalization; a suggested candidate test is −16 LUFS / at most −1.5 dBTP, **not a binding production standard**.
- Run full listening/editorial QA across the entire Spanish audiobook. Keep original and repair candidate separate, PR #797 **DRAFT/UNMERGED**, all public/member release operations OFF.

**Current decision: technical timeline consistency PASS; actual Descript acoustic QA UNVERIFIED; mastering HOLD; release HOLD.**

## Independent 8 ms full-length fade audition — October 9

**QA-ONLY, non-public, NOT a Descript export or final mastering approval.** Agent Underlord confirmed its available editing interface has **no supported sub-second linear audio-fade control**, and therefore **made no changes** to the original Appendix B or repaired Descript candidate.

A sample-accurate alternative was built *offline* from the five existing private GitHub audio artifacts listed above, without a new HeyGen synthesis call. All 15 original MP3 files plus the already-validated `99-02` reference sentence were decoded to **mono 44,100 Hz float32 PCM**. The source segment 18-03 was kept until its independently inferred **40.891995 s** boundary, after which the reference sentence was inserted. The full reconstructed audio measures **883.0275057 s**, within **2.7 microseconds** of the Descript private candidate duration **883.027503 s**.

A **353-sample linear fade-out (8.0045 ms)** was applied to only the final retained samples of source segment 18-03, immediately before the reference recording. On this uncompressed reconstruction, the instantaneous splice jump changed from **0.0229512** to **0.0000000** full-scale units at **172.836485 s**; the next splice is around **205.123832 s**. The fade does not alter text, clip sequence or any unrelated audio. **It does not establish click-free MP3 playback or the actual Descript candidate's acoustic result.**

The new private full-length audition was encoded MP3, 44.1 kHz mono, 192 kb/s, with a separate FFmpeg loudnorm mastering **test**; independent decoding of the encoded file measured:

| Check | Measured result |
|---|---:|
| Encoded duration | **883.069388 s (14:43.07)** |
| Integrated loudness | **−16.31 LUFS** |
| True peak | **−2.21 dBTP** |
| Decoder errors | **0** |
| Silence events over 5 s at −45 dBFS | **0** |
| 58-s A/B original and smoothed excerpts | **Both encoded, matching duration 58.044082 s** |

**Private Library deliverables (not public):**
- `/spanish-audiobook-appendix-b-8ms-private-listening-kit-2026-10-09.zip` — SHA-256 `50d84947b691851e98b244977f96c39215c681f44ba0d26f2e1d611c6fc0d9cf`, ZIP test PASS (6 entries): an offline browser player, 58-second A/B audio clips, full smoothed private trial, diagnostic JSON and readme.
- `/spanish-audiobook-appendix-b-8ms-private-mastering-trial-2026-10-09.mp3` — SHA-256 `2b78ad49fc0024dd7a01abe2e1da49dcec599338d3d9b878ecf504f51756ab69`.

**Listening gate (remains PENDING):** In the A/B kit listen at **00:14.84** (source-to-insert splice) and **00:47.12** (insert-to-following speech), and check ICE / CME / NYMEX / S&P Dow Jones Indices / Cboe / Treasury / FRED pronunciation and breath continuity. Compare the direct Descript private repaired candidate at **02:52.84** and **03:25.12**. Do not equate the offline faded test with a changed Descript timeline, approved final master, human listening PASS or publication approval.

**Control:** PR #797 remains DRAFT/UNMERGED, Descript has zero published compositions, and member storage, Production and entitlement are unchanged.
