# Spanish audiobook — private WAV candidate signal QA (October 21, 2026)

**HOLD / NO PUBLIC RELEASE / NOT MASTER ACCEPTANCE.**

Scope: 19/19 numbered selected-track **size-compatible Drive WAV candidates** (Tracks 01–19) and two Drive alternate WAVs (older Track 00; original Track 18), plus three Library WAV variants. **24 individual files** underwent full-file decode, SHA-256 byte and PCM payload hashing, waveform scanning, FFmpeg EBU R128 integrated loudness/true peak, and thresholded silence detection.

The attached machine-readable [private candidate signal evidence](./SPANISH_AUDIOBOOK_PRIVATE_CANDIDATE_SIGNAL_QA_2026-10-21.json) retains **full byte and PCM SHA-256 hashes for every file**, real duration, container, bit depth, channel count, codec, sample peaks, DC, silence results and decoder status.

## Read-only technical summary

| Test | Observed candidate-file result | Important limit |
| --- | --- | --- |
| File bytes and decoded audio | 24/24 hashed and full PCM frame scans completed | No Descript selected-export attestation |
| WAV decode | 24/24 returned exit code zero | No human listening approval |
| Sample rate / channels | 44.1 kHz / mono across all 24 | Processing/mastering provenance not established |
| Format | 21 Drive WAVs PCM 16-bit; Library Track 00 PCM 24-bit; two other Library WAVs PCM 16-bit | Variants cannot be conflated |
| Silence detector | 0/24 detected gaps >=2 s at -50 dBFS | Does not prove acoustically clean seams or speech completeness |
| Near-clipping samples | 0/24 reached normalized 0.9999695 threshold | Rounded true peak may still be near 0 dBTP |
| 19 numbered size matches | -24.0 to -23.8 LUFS; -8.5 to -7.5 dBTP | Loudness consistency is not source proof or mastered approval |
| Library earlier Track 00 | -16.0 LUFS / 0.0 dBTP | Not selected v2, should not be substituted |
| Attested selected WAVs | 0/20 | Mandatory gate remains closed |

## File-specific evidence (SHA prefixes are NOT substitutes for full hashes)

| Track | Source role | Drive ID or Library file ref | Duration s | PCM | LUFS | True peak dBTP | SHA-256 prefix |
| --- | --- | --- | ---: | --- | ---: | ---: | --- |
| 00 | Drive/alternate | `1n3W5nZNuT0jL3mRPvTvvRZCbINIR40S3` | 110.595 | PCM_16 | -23.9 | -7.6 | `d226c7d842ab...` |
| 00 | Library/alternate | `file_00000000c46081f4aa3a6a40dcb235f7` | 110.595 | PCM_24 | -16.0 | 0.0 | `98b5c92d291e...` |
| 01 | Drive/candidate | `1IQRFyBjJW2nb8VmLlsyQ0L_VBq38W7fa` | 228.571 | PCM_16 | -23.8 | -7.8 | `e585aed6ab18...` |
| 02 | Drive/candidate | `1XmwKEM505XGSiZIr24kPvoq9oJ7ZgGmy` | 837.440 | PCM_16 | -24.0 | -8.0 | `8088f7bc8ee5...` |
| 03 | Drive/candidate | `1m5KDb1bznt9wizVXGIJrzSeogc238DFb` | 1065.766 | PCM_16 | -24.0 | -7.9 | `2654a59424ce...` |
| 04 | Drive/candidate | `1ClvMNuvpcwR48aan1OChJeURNV-PL_DJ` | 1108.760 | PCM_16 | -24.0 | -7.9 | `4127b4d84357...` |
| 05 | Drive/candidate | `1QgNqhFMXJHxejcRs-nWT5WEgwYzEKEyw` | 1140.400 | PCM_16 | -24.0 | -7.8 | `e1dad098781c...` |
| 06 | Drive/candidate | `1ltvNu7eL5iovSXGxOglE7z7QHqamolF1` | 1374.200 | PCM_16 | -23.9 | -7.6 | `c5948818a301...` |
| 07 | Drive/candidate | `1j6t_Un1QtECXKg6nEeA2LE9suA_Zw39F` | 1228.210 | PCM_16 | -23.9 | -7.8 | `7cde81b90e55...` |
| 08 | Drive/candidate | `1327OFhKeMsxy3_a0XaaTnmg_FBBzPdGx` | 1002.300 | PCM_16 | -24.0 | -7.7 | `077b28dc597b...` |
| 09 | Drive/candidate | `1NOUIDSZWdAtm_KW_689pohp3ChUy_ldG` | 1070.800 | PCM_16 | -23.9 | -7.7 | `cc389e5fcaad...` |
| 09 | Library/candidate | `file_00000000d4a0820a98693034f4733248` | 1070.800 | PCM_16 | -23.9 | -7.7 | `626b6694c171...` |
| 10 | Drive/candidate | `1o43eWn-f-RbxBnbynEFsWeGWvf3qStcO` | 1012.682 | PCM_16 | -24.0 | -7.9 | `0fed2e34a71a...` |
| 10 | Library/candidate | `file_00000000e50c81f4a2272fa863a143ad` | 1012.682 | PCM_16 | -23.9 | -7.8 | `866dc00ade6c...` |
| 11 | Drive/candidate | `1YEk2CzoYccRAdbkionS2IJLirk2y41IN` | 916.027 | PCM_16 | -24.0 | -7.7 | `84bc50e4a10c...` |
| 12 | Drive/candidate | `12V-RaaXWNm7OpeRMc40bT4BaoFoKOFlH` | 1089.773 | PCM_16 | -24.0 | -7.8 | `a331adad8192...` |
| 13 | Drive/candidate | `1oeYUKir1C5arv9Fg3rApCGqa8Dei1Tk3` | 930.629 | PCM_16 | -23.9 | -7.9 | `1cef29ffd265...` |
| 14 | Drive/candidate | `1-8mHULlao-B4-wawGXOWVSt5OBWGljce` | 1167.664 | PCM_16 | -24.0 | -7.8 | `1db4233918de...` |
| 15 | Drive/candidate | `1phnj7yUgnpdAb39ftUH4rC7tMVVxcq3d` | 1347.663 | PCM_16 | -24.0 | -7.7 | `4cfd3011f130...` |
| 16 | Drive/candidate | `1FnGBFFS8yy9cs1vC4cuZtV8q33zWqF-G` | 148.376 | PCM_16 | -24.0 | -7.8 | `c2e18aa19e64...` |
| 17 | Drive/candidate | `1V5AiOkUcL7LBxd_MM43_bAlp6114gl_5` | 1043.331 | PCM_16 | -24.0 | -7.8 | `9d1d5f746a87...` |
| 18 | Drive/alternate | `1oUwsSyq0dLwprMKvphUjakZucZLAQqGR` | 859.063 | PCM_16 | -23.9 | -5.9 | `a49a248afeb4...` |
| 18 | Drive/candidate | `1AGRHbUe6GEXsi_I_HnuEn-69hSENIIIf` | 883.028 | PCM_16 | -24.0 | -7.5 | `5232cfdc0ea2...` |
| 19 | Drive/candidate | `1xvGfJmCHtF49wFoBrx2_uRdiWmdg28XM` | 43.598 | PCM_16 | -24.0 | -8.5 | `b6a6f8b112ad...` |

## Same duration does not mean same samples

Three original-vs-Library candidate pairs have exactly matching playback durations but **different decoded sample contents and unequal SHA-256s**. No pair is asserted to be the exact selected composition WAV. Correlation is for QA diagnosis only.

| Track | Exact matching duration s | Fraction of exactly equal sample values | Waveform correlation | Best-fit Library gain versus Drive |
| --- | ---: | ---: | ---: | ---: |
| 00 | 110.595 | 0.52% | 0.9989777 | 2.4674x |
| 09 | 1070.800 | 15.71% | 0.9997558 | 0.9993x |
| 10 | 1012.682 | 17.91% | 0.9999623 | 1.0141x |

**Track 00:** the older Drive cleanup is 110.595306 s and the selected Descript v2 is **109.835306 s**. The documented 0.760-second removed residual word explains that mismatch. The older 24-bit Library candidate is processed differently (+7.9 LUFS relative to the older Drive cleanup, with true peak rounded to 0.0 dBTP); neither WAV constitutes certified v2.

**Track 18:** the original and repaired Drive candidates are separately hashed. The repair candidate matches the selected repaired-composition duration, but its provenance and splice, spoken normalization notation, and exact pipeline SHA remain unverified by hearing.

**Tracks 02–15:** repairs, headings, and transfers remain distinct candidates even when WAV durations align exactly with the selected composition metadata. Differences in the 09/10 Library-vs-Drive decoded sample comparisons reinforce this caution.

## CI note — unrelated blocker

Web quality job [39519959391](https://github.com/usdimpact/usd-impact-site/actions/runs/39519959391) failed early at `npm audit --audit-level=high` on **one high-severity Vite/launch-editor Windows command handling advisory**, before content and localization checks executed. CodeQL and Dependency review on that earlier head passed. The audiobook QA docs do not amend npm packages, CI routing, or Vercel; separate dependency owners must verify remediation. This is **not** a clean CI acceptance.

## Required before final WAV/master approval

1. From the actual [private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca), obtain the explicitly selected lossless PCM export for **each of the 20 composition IDs** using a non-publishing export mechanism; source of selected Track 00 v2 is still missing.
2. Record exact selected Descript project/composition, export timestamp and settings, immutable file name, object ID, original bytes SHA-256 and decoded PCM SHA-256. **Do not reuse** candidate-level signal results as export acceptance unless SHA-256 identity itself is established.
3. Replay critical joins, Track 00 opening/click, Appendix A MXN, Appendix B formula and pipeline identifier from the **specific hashed selected files**, then the entire book. Collect reviewer/time/verdict for each file. Listen to word transitions, not waveform graphs alone.
4. Only after full accepted identity, listening and mastering review, seek separate legal, publisher, edition metadata and distribution approvals. Preserve `production_enabled=false`, `public_allowed=false`, `merge_allowed=false` and Draft PR #797 until then.

**Provenance references:** [existing 20-track selected manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json), [exact Drive inventory](./SPANISH_AUDIOBOOK_WAV_PROVENANCE_REGISTER_2026-10-21.json), [private export blocker](./SPANISH_AUDIOBOOK_WAV_EXPORT_GATE_2026-10-21.md) and [draft PR #797](https://github.com/usdimpact/usd-impact-site/pull/797).
