# Spanish audiobook — selected export objective QA — 2026-10-28

**Status:** PRIVATE QA EVIDENCE ONLY / NO PUBLICATION AUTHORIZATION

Scope: canonical selected audiobook tracks 01–19 from the private Google Drive WAV inventory, reconciled to the current selected Descript composition IDs in PR #797. Track 00 selected v2 is excluded because no exact-title Drive export exists for the selected Descript composition `ebe7f026-e369-4dd4-a184-9476a6482f5b`.

## Owner acoustic checkpoint

On 2026-10-28 the owner returned **PASS BOTH** for the private Descript listening reel ranges 0:00–1:20 (five Chapter 8→13 transitions) and 2:06–2:46 (Chapter 13 ending/disclaimer). This closes only those scoped excerpts.

## Objective result

- 19/19 exact-title selected Drive WAVs decoded successfully.
- All are PCM16, 44.1 kHz, mono.
- Maximum absolute duration delta versus the canonical manifest is <0.0005 s.
- Integrated loudness spans −24.0 to −23.8 LUFS (0.2 LU spread).
- Highest measured true peak is −7.5 dBTP.
- No track contains a >=5 s silence event below the −45 dB threshold used here.
- No clipped PCM samples were detected.
- Tracks 13 and 14 have the two largest adjacent-sample jumps (0.425446 and 0.423676 full-scale normalized respectively); these are below the earlier Track 00 click-defect magnitude and remain targeted-listening items rather than machine PASS for audible continuity.

## File evidence

| Track | SHA-256 | Duration s | Δ vs manifest s | LUFS | TP dBTP | LRA LU |
|---|---|---:|---:|---:|---:|---:|
| 01 | `e585aed6ab183f07099fd8c99e9a7a9ee7df3ae858b34b35b04fb7e013fdb78e` | 228.571429 | +0.000429 | -23.8 | -7.8 | 1.9 |
| 02 | `8088f7bc8ee558e2f9af46f5dc0a1a28e2615107c4d2aa4d6d819ca89732b203` | 837.440000 | +0.000000 | -24.0 | -8.0 | 2.3 |
| 03 | `2654a59424ce4fc9ec47c66cdb23824d3b55afddbc1a5431dd31e0efe8f63567` | 1065.765533 | -0.000467 | -24.0 | -7.9 | 2.2 |
| 04 | `4127b4d8435722c62d062dcbbf7dcb8a2e3a73a7e28df0d80efe1e2d937110ff` | 1108.760227 | +0.000003 | -24.0 | -7.9 | 2.1 |
| 05 | `e1dad098781cab165db476aecadf85e90a73b3b658a6904aef37c6cc23ed5370` | 1140.400023 | +0.000023 | -24.0 | -7.8 | 2.1 |
| 06 | `c5948818a301d2b59923505955f6a4e7d047aedf07068a4365082692c92bd37e` | 1374.200000 | +0.000000 | -23.9 | -7.6 | 1.7 |
| 07 | `7cde81b90e55c13c56d0d3e68ef53a97cfce0ad75adfb083afe95f6db9593c19` | 1228.210000 | +0.000000 | -23.9 | -7.8 | 2.1 |
| 08 | `077b28dc597b3e63efdbd2f749a2d264e448d284b5085888455ae552f40ff4af` | 1002.300000 | +0.000000 | -24.0 | -7.7 | 2.1 |
| 09 | `cc389e5fcaad5b00443726f56c26404a47dc6eefb25e371002729a483175a6d8` | 1070.800000 | +0.000000 | -23.9 | -7.7 | 1.6 |
| 10 | `0fed2e34a71abf4b7f0179bf119545c59bbb86376cfe8414873f0ec539fd287d` | 1012.682200 | +0.000001 | -24.0 | -7.9 | 1.8 |
| 11 | `84bc50e4a10c8c698e67f9adad2401d7ba42c1aacbdb778c0e694eda28f422e0` | 916.026939 | -0.000061 | -24.0 | -7.7 | 2.1 |
| 12 | `a331adad8192127af01f06c9eacd8c210d82768586b135dc7caf2e444c84e916` | 1089.772812 | -0.000188 | -24.0 | -7.8 | 2.1 |
| 13 | `1cef29ffd26501f5458bcff7151bc7c78d949f8052a3797dbe92c13f4e48ed1e` | 930.629229 | +0.000229 | -23.9 | -7.9 | 1.8 |
| 14 | `1db4233918debfffedd5ea50235e2124607f6ad07a905d4da8ec3beb203894ff` | 1167.664331 | +0.000331 | -24.0 | -7.8 | 2.2 |
| 15 | `4cfd3011f13055cbf7e0e9ff7e1dc553e1a032fe4441c10c1275f9a976ba9bc7` | 1347.663469 | +0.000469 | -24.0 | -7.7 | 2.3 |
| 16 | `c2e18aa19e64d35a8498b2154a6319bf12bf1fc4eb7f2266525b65ca8d4fc820` | 148.375510 | -0.000490 | -24.0 | -7.8 | 2.3 |
| 17 | `9d1d5f746a873f5ee2c6d1740ceae5b6c21babb6729c68410fd3f627a94cfab3` | 1043.330612 | -0.000388 | -24.0 | -7.8 | 2.4 |
| 18 | `5232cfdc0ea2256223942484c4b01b748d6ae96040b39dc62f17a7ab58155abb` | 883.027506 | -0.000494 | -24.0 | -7.5 | 2.1 |
| 19 | `b6a6f8b112ad48150ead68d6d12edaf9b12c03e756617684ea8159798ec41faf` | 43.598367 | +0.000367 | -24.0 | -8.5 | 1.5 |

## Remaining gates

1. Obtain or positively identify an exact private export of selected Track 00 v2; do not substitute the older 110.595306 s Drive candidate.
2. Target-listen Track 13 near 340.796 s and Track 14 near 128.889 s during final whole-program listening because those are the largest objective sample-step outliers.
3. Complete whole-track / whole-program human listening for the selected 20-track set.
4. Lock a final mastering profile only after exact Track 00 export and full listening evidence are available.
5. Legal/editorial release clearance, PR merge, Descript public publishing, member storage, entitlement changes and Production remain separately prohibited until explicit authorization.

**Invariant:** PR #797 remains DRAFT/unmerged; public/member/Production release flags remain OFF.
