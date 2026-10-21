# Spanish audiobook — 20-track WAV provenance register

**PRIVATE QA ONLY · HOLD · 2026-10-21**  
Repository: `usdimpact/usd-impact-site` · branch: `feat/spanish-audiobook-pilot-foundation` · [draft PR #797](https://github.com/usdimpact/usd-impact-site/pull/797).

**Complete machine-readable inventory:** [20 manifest selections and all 63 Drive WAV objects](./SPANISH_AUDIOBOOK_WAV_PROVENANCE_REGISTER_2026-10-21.json). Source: [private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca), [Drive folder](https://drive.google.com/drive/folders/1l5vmUukQpw4HoBhvs0N50fr2I4Wg3o8e), and [private review manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json).

## Verified and unverified facts

- **20/20** selected private Descript composition IDs/durations match live Descript project metadata; this is **composition metadata verification**, not export verification.
- Drive lists **63 WAV objects**. A narrowly defined **file-size proxy** finds one matching-size WAV for **19/20** track slots and **none** for Track 00. Those 19 objects are **possible candidates, not selected masters**.
- **0/20** track slots has an authenticated Descript composition-to-export record, file checksum for the attested selected WAV, or full-waveform mastering signoff in this register. Earlier targeted audio checks and owner listening on Descript compositions do **not** certify these Drive files.
- Timestamps retained from Google Drive are Drive file created/modified times, **not** attested Descript export times. No SHA-256 has been computed for the selected 20 lossless exports.
- The size proxy assumes **44-byte WAV header, 44.1 kHz mono, 16-bit PCM** and computes `(size_bytes - 44) / 88200`, with a ±0.04-second window around live Descript duration. This has **not** parsed WAV headers, decoded the complete files, or checked source identity.

## Per-track identity ledger — NOT master approval

| Track | Selected composition ID | Live composition duration (s) | Matching-size Drive candidate ID and exact filename | Result |
| --- | --- | ---: | --- | --- |
| 00 | `ebe7f026-e369-4dd4-a184-9476a6482f5b` | 109.835 | **NONE** (earlier Drive variants only) | No selected v2 size match |
| 01 | `a65d72b2-4c79-454c-9215-0c292d856b69` | 228.571 | [`1IQRFyBjJW2nb8VmLlsyQ0L_VBq38W7fa`](https://drive.google.com/file/d/1IQRFyBjJW2nb8VmLlsyQ0L_VBq38W7fa/view?usp=drivesdk) — 01 - Reconocimientos y guía del lector.wav | Provisional size lead; source unproven |
| 02 | `aecc180b-4513-455b-a3e4-fce58da36fac` | 837.440 | [`1XmwKEM505XGSiZIr24kPvoq9oJ7ZgGmy`](https://drive.google.com/file/d/1XmwKEM505XGSiZIr24kPvoq9oJ7ZgGmy/view?usp=drivesdk) — 02 - Introducción - PART I BOUNDARY QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 03 | `686a4f65-8ff9-4141-aedb-bab9b4296602` | 1065.766 | [`1m5KDb1bznt9wizVXGIJrzSeogc238DFb`](https://drive.google.com/file/d/1m5KDb1bznt9wizVXGIJrzSeogc238DFb/view?usp=drivesdk) — 03 - Capítulo 1 - PART I BOUNDARY QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 04 | `592e27f8-5337-4058-8f6d-e0f2cb749251` | 1108.760 | [`1ClvMNuvpcwR48aan1OChJeURNV-PL_DJ`](https://drive.google.com/file/d/1ClvMNuvpcwR48aan1OChJeURNV-PL_DJ/view?usp=drivesdk) — 04 - Chapter 2 - Repeated Part I Heading Added - PRIVATE QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 05 | `afef9b85-5d80-443b-b39d-6ac07a4e298b` | 1140.400 | [`1QgNqhFMXJHxejcRs-nWT5WEgwYzEKEyw`](https://drive.google.com/file/d/1QgNqhFMXJHxejcRs-nWT5WEgwYzEKEyw/view?usp=drivesdk) — 05 - Chapter 3 - Part II Tail Transferred - PRIVATE QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 06 | `c99a187a-501f-4a7c-b481-db2f0a179183` | 1374.200 | [`1ltvNu7eL5iovSXGxOglE7z7QHqamolF1`](https://drive.google.com/file/d/1ltvNu7eL5iovSXGxOglE7z7QHqamolF1/view?usp=drivesdk) — 06F - Chapter 4 - Part III Tail Transferred - PRIVATE QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 07 | `66cdab8b-cb68-4839-82b0-af50fce19c7b` | 1228.210 | [`1j6t_Un1QtECXKg6nEeA2LE9suA_Zw39F`](https://drive.google.com/file/d/1j6t_Un1QtECXKg6nEeA2LE9suA_Zw39F/view?usp=drivesdk) — 07 - Chapter 5 - Part III Tail Transferred - PRIVATE QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 08 | `88370601-0fec-4194-90ae-cfbb3a58c89f` | 1002.300 | [`1327OFhKeMsxy3_a0XaaTnmg_FBBzPdGx`](https://drive.google.com/file/d/1327OFhKeMsxy3_a0XaaTnmg_FBBzPdGx/view?usp=drivesdk) — 08 - Chapter 6 - Part III Tail Transferred - PRIVATE QA - DO NOT PUBLISH - FIXED AUDIO.wav | Provisional size lead; source unproven |
| 09 | `fc98ab59-811a-4e42-81f6-a08471dc7b0a` | 1070.800 | [`1NOUIDSZWdAtm_KW_689pohp3ChUy_ldG`](https://drive.google.com/file/d/1NOUIDSZWdAtm_KW_689pohp3ChUy_ldG/view?usp=drivesdk) — 09 - Chapter 7 - Part III Tail Transferred - PRIVATE QA - DO NOT PUBLISH - FIXED AUDIO.wav | Provisional size lead; source unproven |
| 10 | `217a0453-50cb-4b62-9117-e8009c2b1244` | 1012.682 | [`1o43eWn-f-RbxBnbynEFsWeGWvf3qStcO`](https://drive.google.com/file/d/1o43eWn-f-RbxBnbynEFsWeGWvf3qStcO/view?usp=drivesdk) — 10 - Chapter 8 - Part III Heading Prefixed - PRIVATE QA - DO NOT PUBLISH - FIXED AUDIO.wav | Provisional size lead; source unproven |
| 11 | `d154039c-2b7d-4002-9bd3-032e3531eef1` | 916.027 | [`1YEk2CzoYccRAdbkionS2IJLirk2y41IN`](https://drive.google.com/file/d/1YEk2CzoYccRAdbkionS2IJLirk2y41IN/view?usp=drivesdk) — 11 - Capítulo 9 - BOUNDARY V2 QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 12 | `ade2a5e4-2b8d-4342-8fc4-1869f61cd42d` | 1089.773 | [`12V-RaaXWNm7OpeRMc40bT4BaoFoKOFlH`](https://drive.google.com/file/d/12V-RaaXWNm7OpeRMc40bT4BaoFoKOFlH/view?usp=drivesdk) — 12 - Capítulo 10 - BOUNDARY V2 QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 13 | `8644e0dc-4fc1-475a-ab30-85a53521445b` | 930.629 | [`1oeYUKir1C5arv9Fg3rApCGqa8Dei1Tk3`](https://drive.google.com/file/d/1oeYUKir1C5arv9Fg3rApCGqa8Dei1Tk3/view?usp=drivesdk) — 13 - Capítulo 11 - BOUNDARY V2 QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 14 | `fc7b5ff2-9f63-4e36-ba53-00240cb05058` | 1167.664 | [`1-8mHULlao-B4-wawGXOWVSt5OBWGljce`](https://drive.google.com/file/d/1-8mHULlao-B4-wawGXOWVSt5OBWGljce/view?usp=drivesdk) — 14 - Capítulo 12 - BOUNDARY V2 QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 15 | `34e4b853-0b77-4a21-9830-f231a9045383` | 1347.663 | [`1phnj7yUgnpdAb39ftUH4rC7tMVVxcq3d`](https://drive.google.com/file/d/1phnj7yUgnpdAb39ftUH4rC7tMVVxcq3d/view?usp=drivesdk) — 15 - Capítulo 13 - BOUNDARY V1 QA - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 16 | `827db26b-1a82-4f29-a588-48eadadca1a7` | 148.376 | [`1FnGBFFS8yy9cs1vC4cuZtV8q33zWqF-G`](https://drive.google.com/file/d/1FnGBFFS8yy9cs1vC4cuZtV8q33zWqF-G/view?usp=drivesdk) — 16 - Lecturas adicionales - PRIVATE QA.wav | Provisional size lead; source unproven |
| 17 | `625d0a1a-1bf2-42ac-b363-cb8b525e660b` | 1043.331 | [`1V5AiOkUcL7LBxd_MM43_bAlp6114gl_5`](https://drive.google.com/file/d/1V5AiOkUcL7LBxd_MM43_bAlp6114gl_5/view?usp=drivesdk) — 17 - Apéndice A - Glosario rápido - PRIVATE QA.wav | Provisional size lead; source unproven |
| 18 | `6a251168-1d0d-4a9d-b9ea-daed1d1db016` | 883.028 | [`1AGRHbUe6GEXsi_I_HnuEn-69hSENIIIf`](https://drive.google.com/file/d/1AGRHbUe6GEXsi_I_HnuEn-69hSENIIIf/view?usp=drivesdk) — 18 - Apéndice B - PRIVATE REPAIR CANDIDATE - DO NOT PUBLISH.wav | Provisional size lead; source unproven |
| 19 | `1d15c8e2-dc3f-4c2d-9b95-b84a435dcb0b` | 43.598 | [`1xvGfJmCHtF49wFoBrx2_uRdiWmdg28XM`](https://drive.google.com/file/d/1xvGfJmCHtF49wFoBrx2_uRdiWmdg28XM/view?usp=drivesdk) — 19 - Sobre el autor - PRIVATE QA.wav | Provisional size lead; source unproven |

Every exact alternate ID, full filename, size, approximate duration, and Drive timestamp is preserved in the linked JSON. Three support/reel entries do not map to the canonical 00–19 track slots.

## Non-interchangeable candidates

**Track 00.** Selected v2 composition `ebe7f026-e369-4dd4-a184-9476a6482f5b` is **109.835306 seconds**. Drive file [`1n3W5nZNuT0jL3mRPvTvvRZCbINIR40S3`](https://drive.google.com/file/d/1n3W5nZNuT0jL3mRPvTvvRZCbINIR40S3/view) (`00 - Copyright Fixed - PRIVATE QA.wav`) is **110.595306 seconds**, an earlier cleanup candidate. The documented removal of a **0.760-second** residual word explains the difference; it does **not** turn that WAV into the selected v2. An exact v2 WAV export is missing from this Drive inventory.

**Tracks 02–15.** Older baseline WAVs, heading transfers, boundary versions, and private repair variants must remain distinguishable. The size-compatible object for each is only an identification lead; even a perfect duration would not prove the exported Descript revision or an acoustically clean seam.

**Track 18.** Original candidate [`1oUwsSyq0dLwprMKvphUjakZucZLAQqGR`](https://drive.google.com/file/d/1oUwsSyq0dLwprMKvphUjakZucZLAQqGR/view) and repair candidate [`1AGRHbUe6GEXsi_I_HnuEn-69hSENIIIf`](https://drive.google.com/file/d/1AGRHbUe6GEXsi_I_HnuEn-69hSENIIIf/view) are distinct. The repair WAV's size-derived duration matches the selected *private repaired* Descript composition `6a251168-1d0d-4a9d-b9ea-daed1d1db016`; composition-to-file lineage is **not attested**. The full spoken pipeline identifier and repair seam still require WAV-specific listening.

**Tracks 01, 16, 17, 19.** Having one candidate in the folder does not prove export provenance, identity, mastering, or release approval.

## Gated next operations

1. Privately export or positively attest an **actual lossless WAV of each exact selected Descript composition** (20/20). Record selected composition ID, export method and UTC export time, exact target filename/Drive object ID, and full file SHA-256. Do not export by using public Descript publishing.
2. Verify format and full decode **on those identified bytes**: container/codec, rate, channel count, bit depth, sample count/duration, truncation, silence, DC, clips, integrated loudness, true peak and cross-track balance. Store the measurement beside the exact file SHA-256, not beside a name-only match.
3. Listen to those **same SHA-256 files** at opening/closing boundaries, heading transfers, Track 00 at the removed-word seam, glossary `MXN`, DFII10, Appendix B repair and normalization wording, and the literal spoken pipeline SHA. Complete a full-file listening pass for all 20 WAVs and record reviewer/time/verdict.
4. Independently resolve legal/editorial, candidate edition metadata, accessibility/companion delivery, mastering and publisher signoff. No automatic PASS from the technical checks.

## Non-release invariants

`production_enabled=false` · `public_allowed=false` · `merge_allowed=false` · `publication_approval=NOT_GRANTED` · `mastering_approval=PENDING`.

**This is a private provenance register, not a 20-track approved-master manifest.** Keep PR #797 draft and unmerged. No synthesis, public sharing, member storage/upload, entitlement change, Vercel, Supabase, Render, Resend, Lovable, or Production modification is authorized.

See also: [private non-audio closeout register](./SPANISH_AUDIOBOOK_NON_AUDIO_CLOSEOUT_2026-10-10.md).

## October 21 candidate-level byte fingerprints and signal probes (not selected masters)

The [private WAV candidate signal report](./SPANISH_AUDIOBOOK_PRIVATE_CANDIDATE_SIGNAL_QA_2026-10-21.md) and [exact machine-readable measurements](./SPANISH_AUDIOBOOK_PRIVATE_CANDIDATE_SIGNAL_QA_2026-10-21.json) now provide **SHA-256 for 21 exact Drive WAV objects** (19 duration-compatible candidates, earlier Track 00 cleanup, and original Track 18), plus separate fingerprints of three older Library WAV variants. Each hashed Drive object retains its exact Drive ID, original byte hash, decoded PCM hash, WAV format/duration, complete-decoder result, integrated loudness and true-peak measurement in the JSON registry.

**Scope limitation:** These 21 hashes certify only the bytes read from those 21 Google Drive objects. They do **not** establish an export link to the selected Descript composition IDs. All 20 selected master-hash fields remain `null` and all 20 selected export attestations remain outstanding. Track 00 selected v2 is still absent. Full listening, master approval, public release and PR merge remain prohibited. In particular, the Drive/Library PCM samples for Tracks 00, 09 and 10 differ despite exact duration matches.

The latest Web quality CI failure was caused by a high-severity dependency audit finding in Vite/launch-editor before content checks ran; it is separately owned and **not** a successful content CI test. No npm dependency, application code, Production route, Descript audio or access control was changed by this private QA update.
