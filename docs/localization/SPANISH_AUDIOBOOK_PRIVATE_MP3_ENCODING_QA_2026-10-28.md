# Spanish audiobook — private 192 kbps MP3 encoding QA — 2026-10-28

Status: **ENCODING PROFILE TECHNICALLY VALIDATED / FINAL MASTER MATERIALIZATION HOLD**

This checkpoint tests the conservative delivery profile defined in the current-main release blueprint. It does not authorize upload, member delivery, public publication, entitlement changes, PR #797 merge or Production release.

## Inputs

Tracks 01–19:
- exact-title private Drive WAVs corresponding to the selected Descript compositions;
- previously passed decoder/duration/loudness/true-peak/silence/clipping QA.

Track 00:
- private deterministic render-equivalent WAV built from the Descript-rendered 110.595306 s base with the exact selected-v2 0.76 s source interval removal;
- duration 109.835306 s;
- source/edit geometry verified read-only against selected Descript composition `ebe7f026-e369-4dd4-a184-9476a6482f5b`;
- **not claimed byte-identical to the exact Descript v2 rendered binary**.

## Encoding method

Each private candidate was encoded with no gain, EQ, compression, denoise or other mastering processing:

`ffmpeg -map_metadata -1 -ac 1 -ar 44100 -c:a libmp3lame -b:a 192k`

Target:
- MP3 / `audio/mpeg`
- 44.1 kHz
- mono
- 192 kbps

This matches the effective bitrate of the current English member audiobook and the existing private bucket MIME contract.

## Result

20-track private candidate set:
- 20/20 decoder PASS;
- 20/20 MP3;
- 20/20 44.1 kHz mono;
- observed bitrate range approximately 192.0–192.1 kbps;
- total bytes: **426,007,633** (**406.27 MiB**);
- largest file: **32,982,665 bytes** (**31.45 MiB**), below the existing 40 MiB per-object bucket limit;
- integrated loudness: **-24.29 to -24.09 LUFS**;
- maximum true peak: **-7.79 dBTP**;
- no >=5 s silence events at the -45 dB threshold;
- decoder errors: none.

### Gapless duration validation

MP3 container duration includes encoder delay/padding. Every candidate includes explicit MP3 skip/discard metadata.

After applying the encoded skip/discard samples:
- maximum absolute effective programme-duration delta across all 20 candidates is **<0.023 ms**;
- no programme-length expansion was found.

For Tracks 01–19, the encoded programme therefore reproduces the selected source duration to sample-level timing tolerance.

Track 00's render-equivalent candidate likewise resolves to the exact 109.835306 s selected programme duration after gapless trim metadata.

## Per-track ledger

| Track | Bytes | SHA-256 | LUFS | TP dBTP | Effective duration delta ms | Provenance |
|---|---:|---|---:|---:|---:|---|
| 00 | 2637574 | `72cca91652ee0caf50c2ee43e89ee91c0ddd170c7c83aaa99517dda9fe240664` | -24.17 | -7.83 | -0.000 | render-equivalent candidate; exact Descript v2 bytes pending |
| 01 | 5487011 | `12b18fec327803f1321681aa5235c71089d77a17a1b792b49fa61e3872e5ff79` | -24.09 | -8.11 | +0.001 | exact selected Drive WAV -> MP3 |
| 02 | 20100327 | `ac272aae1b2442f8c434c30440e0a2708ea5247e0f42e028d8f77328a8a71f47` | -24.27 | -8.25 | -0.000 | exact selected Drive WAV -> MP3 |
| 03 | 25579772 | `4b7a4f9203b53bd494ef78257449ba9377f5f2fe13de9c307b11d3145ce31dee` | -24.28 | -8.21 | +0.012 | exact selected Drive WAV -> MP3 |
| 04 | 26611713 | `5a2b19da5bbde10660e7fc3fb89491e6898726fa929595e5e0a0c9e6fcda9149` | -24.26 | -8.18 | +0.002 | exact selected Drive WAV -> MP3 |
| 05 | 27370936 | `61abd1e4d99e801f20e47047d626445ed429654a8c1e07a7371eb3ca864164fe` | -24.27 | -8.05 | +0.023 | exact selected Drive WAV -> MP3 |
| 06 | 32982665 | `27ec1f11d13bf220675935074fccffef53246c27eddac543e501fc4b064df3a5` | -24.20 | -7.84 | +0.000 | exact selected Drive WAV -> MP3 |
| 07 | 29478704 | `00f76320317e2b28f70a183cac2beb495a98c9f84e09d28dd00617bb36764280` | -24.25 | -8.03 | +0.000 | exact selected Drive WAV -> MP3 |
| 08 | 24056937 | `aec11d5b3b8c2093c1a666f1e3216683960b34fd5f0288999a7e4e4e5e775b52` | -24.27 | -7.97 | +0.000 | exact selected Drive WAV -> MP3 |
| 09 | 25700771 | `c5332d4ed109e9e4d69481c6136c4196259bf372bde16eb1e1502a304932f348` | -24.17 | -7.94 | -0.000 | exact selected Drive WAV -> MP3 |
| 10 | 24305832 | `aa66ccd41937f74d0f5b74ac7a6dc6c1a8e15e8d882336d986ebe8792a1d656b` | -24.28 | -8.14 | +0.001 | exact selected Drive WAV -> MP3 |
| 11 | 21986159 | `73023af999af5b46380866f1611cc289983d0d4284e5f545b9f713a296534866` | -24.25 | -7.90 | +0.010 | exact selected Drive WAV -> MP3 |
| 12 | 26155928 | `623e54b02f1ebc1a2aba29fdaf259852eb2aca6ddc24faca3e408c546db555b7` | -24.26 | -8.05 | +0.001 | exact selected Drive WAV -> MP3 |
| 13 | 22336617 | `1368a14327ca788ba88e902c149de2723b6d79286f0f03302c2241314ac8eb2e` | -24.18 | -8.18 | +0.012 | exact selected Drive WAV -> MP3 |
| 14 | 28025460 | `9c1af34c8784918e44f81960234c7f7f3ac805dd9f438e831000b8acb6ef9ca9` | -24.25 | -8.08 | +0.012 | exact selected Drive WAV -> MP3 |
| 15 | 32345695 | `258bf6fea74f23aae41e84e430f3f2eb779d4753b9a8e005eb97623897805bf9` | -24.26 | -7.97 | +0.011 | exact selected Drive WAV -> MP3 |
| 16 | 3562309 | `bc66d2f794f087258c0e96893b0d4fbe314d04cd6f256879042c8eedeeb970f5` | -24.29 | -8.05 | +0.001 | exact selected Drive WAV -> MP3 |
| 17 | 25041231 | `74deb91832e28ccc8453854cf405511bd86be218a8546e52688e098c427d4df1` | -24.25 | -8.09 | +0.008 | exact selected Drive WAV -> MP3 |
| 18 | 21194335 | `32b58b8cd41eb232b94390ab0304ee6ec01b8460592dd97573b873c3281968df` | -24.27 | -7.79 | +0.003 | exact selected Drive WAV -> MP3 |
| 19 | 1047657 | `fd00f7f9f8f5f3b527b6a11e6daeb365b9656bdcfe1938cfeb4038e72cc35a78` | -24.29 | -8.80 | +0.001 | exact selected Drive WAV -> MP3 |

## Interpretation

The conservative 192 kbps encode does not require loudness normalization or dynamics processing to achieve cross-track consistency. The selected programme already forms a narrow loudness band.

Do **not** apply the historical provisional -16 LUFS mastering idea automatically. That would be a material gain/master change and would require a new final-master listening cycle.

The current private 192 kbps encoding profile is technically compatible with the existing member-delivery bucket:
- allowed MIME: `audio/mpeg`;
- maximum object size: 40 MiB;
- all candidate tracks fit.

## Track 00 boundary

Track 00 remains the only provenance caveat:
- actual selected Descript v2 has owner full-track listening PASS;
- read-only Descript inspection confirms the exact 0.76 s ripple edit and no other edit found;
- a private Descript audio share exists only at access level `private`;
- the connected execution runtime cannot currently ingest the signed private rendered binary for byte-level comparison;
- therefore the deterministic render-equivalent candidate may be used for private encoding evaluation, but must not be silently labeled the exact Descript export.

Before final production storage, choose one of:
1. obtain and hash the exact selected Descript v2 binary, then encode it;
2. explicitly approve the deterministic render-equivalent Track 00 master as the release source after its existing human listening/provenance evidence is reviewed.

## Release boundary

Still required before member delivery:
- final Track 00 source/provenance disposition;
- legal/publisher release clearance;
- final publication/edition/disclosure/accessibility decisions;
- explicit distribution authorization;
- current-main runtime release PR with exact asset manifest/hashes;
- private storage upload and signed-route smoke;
- separate Production release authorization.

No MP3 candidate from this QA was uploaded to Supabase, Drive, Descript, public storage or GitHub.


## Current-main disposition — 2026-10-28

This record is now promoted as the authoritative encoding-profile QA evidence for the Spanish audiobook.

Important distinction:
- the 20 MP3 candidates were generated and measured successfully;
- their hashes/sizes/measurements are reproducible evidence of the chosen encoding profile;
- they were **not** uploaded to Production member storage;
- they were **not** persisted as final release masters;
- therefore this record closes the **encoding-profile validation**, not the final-master materialization/storage gate.

Before final private master materialization:
1. resolve Track 00 release-source provenance: exact selected Descript v2 binary vs explicitly approved deterministic render-equivalent source;
2. re-encode the frozen 20 sources with the same 192 kbps/no-processing command;
3. reproduce or intentionally supersede the recorded per-track hashes with a signed-off final manifest;
4. keep the files private until legal/publisher clearance and explicit storage authorization.

No member delivery, storage upload, entitlement change or Production release is authorized by this record.
