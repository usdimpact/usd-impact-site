# Spanish audiobook — private 20-track delivery completed (2026-10-21)

**Result:** An owner-directed, offline-derived **private** audiobook listening package was assembled and tested. This is **not** a public released product, an authenticated export of all 20 selected Descript compositions, or approval to merge [PR #797](https://github.com/usdimpact/usd-impact-site/pull/797).

## Source choice and owner disposition

User on 2026-10-21: **"all accepted, let's just finish this"**. This is recorded as the owner's instruction to finish delivery preparation and acceptance of the editorial/listening direction; it does **not** create missing file-level evidence or invent a complete 20-track independent listening result.

All source media used for this new private package are the exact WAV candidates enumerated by Drive ID and SHA-256 in [the technical QA audit](./SPANISH_AUDIOBOOK_PRIVATE_CANDIDATE_SIGNAL_QA_2026-10-21.json). **19 tracks (01–19)** use the 19 separately probed Drive candidate WAVs, including the repaired private Track 18. **Track 00** uses a new non-destructive offline reconstruction of the earlier `00 - Copyright Fixed - PRIVATE QA.wav` because selected Descript v2 `ebe7f026-e369-4dd4-a184-9476a6482f5b` has **no accessible native lossless export** through the connected API.

For Track 00, the older source SHA-256 is `d226c7d842ab8c6efb219c972ca4fce86c942f0a06fc140f9a0c0504b8553e49`. The reconstruction cuts two low-signal regions at original-source seconds **[2.65,3.16)** and **[4.50,4.75)**, totaling **33,516 samples / 0.760 seconds**, with 8 ms seam de-click fades; its duration is **109.835306 s**. It is a **new alternative**, not an attested or acoustically compared Descript v2 export. Text-timeline presence and equal duration do **not** prove equivalent audible output. No Descript composition was modified.

## Delivery artifacts (local private handoff only)

| Artifact | Exact filename | Size | SHA-256 |
| --- | --- | ---: | --- |
| Single-file 20-chapter audiobook | `SPANISH_AUDIOBOOK_PRIVATE_20_CHAPTERS_2026-10-21.m4b` | 258,870,062 bytes | `945ca282e4e20c1e3f05e6995d740f0ef6e2863e92097bb2570cfd3cdaafa8ee` |
| 20 numbered MP3s and manifest ZIP | `SPANISH_AUDIOBOOK_PRIVATE_LISTENING_20_TRACKS_2026-10-21.zip` | 284,047,223 bytes | `ce4ab0793eb138719d3f5bd1742c0017bbbb2f96986594fa161abea1e9e29a8e` |
| 20 numbered lossless candidate WAVs ZIP | `SPANISH_AUDIOBOOK_PRIVATE_LOSSLESS_WAV_CANDIDATES_2026-10-21.zip` | 1,565,503,818 bytes | `a14834125a038034278c69ec4fa673d3b7c1f53ac05feb3433803b7002ccd820` |

Total ordered playback **17,749.053 seconds = 4 h 55 m 49 s**.

Format: WAV **44.1 kHz mono 16-bit PCM**; MP3 **44.1 kHz mono 128 kbps**; M4B **AAC 44.1 kHz mono 112 kbps**, carrying **20 chapter markers** and historical candidate-edition metadata.

## Completed output QA

- **20/20** source input hashes checked against the retained candidate evidence before conversion.
- **20/20** lossless outputs have valid WAV headers, unchanged per-track frame counts from their own transformed source, and recorded output SHA-256.
- **20/20** MP3 files successfully decoded in a full pass, and have SHA-256 in the embedded `manifest.json`.
- Output WAV integrated loudness between **−19.1 and −19.0 LUFS** and true peaks between **−3.5 and −2.5 dBTP**, using conservative linear gain rather than dynamic compression.
- MP3 and WAV ZIP archives passed full ZIP CRC/integrity checks.
- M4B full decode **PASS**, **20** chapters verified, integrated **−19.0 LUFS**, true peak **−1.5 dBTP**, and duration matches the assembled audio.
- This is a **technical signal/format PASS for the new offline candidate package only**, not a final human listening or verified Descript-master PASS.

## Unchanged governance and blockages

The source [20-track manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json), its composition IDs and its publication flags were **not changed**. The missing native selected-v2 WAV and other composition-to-export attestations are **still missing**. Exact spoken Appendix B pipeline-identifier listening is not independently certified. Final public edition labeling, accessible companion/player delivery and any required legal compliance review are separate release checks. The owner-directed private package does not waive these factual gaps.

**No Production changes** (Vercel, Supabase, Render, Resend, Lovable, public audio storage or member entitlements), no public Descript share or publish, no synthesis, no application-code changes, and no PR merge. The PR currently covers a much broader historical diff than the private audio package; treat a merge as a separate scoped operation. The latest Web quality run had a separate high-severity Vite/launch-editor npm-audit failure; this was not altered by the audio work.

**Release controls remain:** `production_enabled=false`; `public_allowed=false`; `merge_allowed=false`; `publication_approval=NOT_GRANTED`. Owner acceptance was recorded only at its stated scope; neither the audio files nor their filenames should be represented as attested selected Descript masters.

**Storage limitation:** The packages were built in the working artifact container. Persistent Library upload was attempted but returned `container_session_expired`; no Drive/Library save of these new audio packages is claimed. Deliver them via the verified sandbox artifact links in the originating chat. The private source Drive inventory is unchanged.
