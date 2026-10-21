# Spanish audiobook — private 20-track delivery completed (2026-10-21)

**Result:** An owner-directed, offline-derived **private** audiobook listening package was assembled and tested. This is **not** a public released product, an authenticated export of all 20 selected Descript compositions, or approval to merge [PR #797](https://github.com/usdimpact/usd-impact-site/pull/797).

## Source choice and owner disposition

User on 2026-10-21: **"all accepted, let's just finish this"**. This is recorded as the owner's instruction to finish delivery preparation and acceptance of the editorial/listening direction; it does **not** create missing file-level evidence or invent a complete 20-track independent listening result.

All source media used for this new private package are the exact WAV candidates enumerated by Drive ID and SHA-256 in [the technical QA audit](./SPANISH_AUDIOBOOK_PRIVATE_CANDIDATE_SIGNAL_QA_2026-10-21.json). **19 tracks (01–19)** use the 19 separately probed Drive candidate WAVs, including the repaired private Track 18. **Track 00** uses a new non-destructive offline reconstruction of the earlier `00 - Copyright Fixed - PRIVATE QA.wav` because selected Descript v2 `ebe7f026-e369-4dd4-a184-9476a6482f5b` has **no accessible native lossless export** through the connected API.

For Track 00, the older source SHA-256 is `d226c7d842ab8c6efb219c972ca4fce86c942f0a06fc140f9a0c0504b8553e49`. The reconstruction cuts two low-signal regions at original-source seconds **[2.65,3.16)** and **[4.50,4.75)**, totaling **33,516 samples / 0.760 seconds**, with 8 ms seam de-click fades; its duration is **109.835306 s**. It is a **new alternative**, not an attested or acoustically compared Descript v2 export. Text-timeline presence and equal duration do **not** prove equivalent audible output. No Descript composition was modified.

## Delivery artifacts — persisted private handoff and archive reconciliation

Verified personal Library folder: `/Localization Pilots/Spanish Audiobook Private Delivery 2026-10-21/`.

| Delivered file | Exact file | Bytes | SHA-256 | Persistence |
| --- | --- | ---: | --- | --- |
| Chaptered 20-track M4B, original private audition rendering | `SPANISH_AUDIOBOOK_PRIVATE_20_CHAPTERS_2026-10-21.m4b` | 258,870,062 | `945ca282e4e20c1e3f05e6995d740f0ef6e2863e92097bb2570cfd3cdaafa8ee` | Library file verified |
| Regenerated 20-track MP3 archive (separate build) | `SPANISH_AUDIOBOOK_PRIVATE_LISTENING_20_TRACKS_REBUILT_2026-10-21.zip` | 284,023,474 | `401a5de7b9846829377749cb7397c235ff15ad1ff0e974d5a0dd5fc0ae6785cd` | Library file verified |
| Regenerated WAV candidate set | `Lossless WAV private candidates/00.wav` through `19.wav` | 1,565,469,734 aggregate | Per-file SHA-256 in `PRIVATE_REBUILT_MANIFEST.json` | **20/20** Library WAV files verified |
| Metadata, retention caveats and QA | `manifest.json`, `VERIFICATION_SUMMARY.json`, `PRIVATE_REBUILT_MANIFEST.json`, `PRIVATE_README.txt` | — | Hashes embedded where applicable | Library files verified |

The regenerated MP3 and lossless WAV tracks are a **separate candidate rendering** from the chaptered M4B. Rebuilt Track 00's input offline reconstruction SHA-256 is `d68e58fddb8091fabfcbb56f982322ede461fa24393df743f8df31f4401ef545`; the M4B's earlier offline candidate source was not this identical rebuilt file. **Do not claim the M4B and rebuilt tracks are byte-equivalent or the same selected Descript export.** Both use only private candidate sources, and selected Track 00 v2 was **not** directly exported as lossless WAV.

Four optional downloadable ZIP packages of the regenerated WAVs were also **verified locally** but rejected by persistent Library upload; the verified individual Library WAVs are the durable masters of **these private candidates only**:

| Local-only ZIP | Byte count | SHA-256 |
| --- | ---: | --- |
| `SPANISH_AUDIOBOOK_PRIVATE_LOSSLESS_WAV_A_00-04_REBUILT_2026-10-21.zip` | 295,518,506 | `a76700c72cb36e5f5e4f299ef47be17f6e14fb74371ba917045cbdf25c40e175` |
| `SPANISH_AUDIOBOOK_PRIVATE_LOSSLESS_WAV_B_05-09_REBUILT_2026-10-21.zip` | 512,979,106 | `7a3691e18d123ad686a09caa4f6a76fcf945411ebf367118d0fdc926cb637d56` |
| `SPANISH_AUDIOBOOK_PRIVATE_LOSSLESS_WAV_C_10-14_REBUILT_2026-10-21.zip` | 451,315,342 | `c83679f767ce85af3b35f6f2f98112d75a324ff0b530abbc0b3a974b677be590` |
| `SPANISH_AUDIOBOOK_PRIVATE_LOSSLESS_WAV_D_15-19_REBUILT_2026-10-21.zip` | 305,716,484 | `d21654260618fc67ea74185590f159389e095a5033545c37401d521e888ac4ce` |

**Historical correction:** The first report recorded a former MP3 archive with checksum `ce4ab079...` and one full WAV ZIP with checksum `a1483412...`. Those exact historical archive files were **not accessible in the continuation session**; their old hashes MUST NOT be reused for the new archives. All rebuilt media have newly measured hashes and explicit `REBUILT` filenames.

Total ordered playback **17,749.053 seconds = 4 h 55 m 49 s**.

Format: WAV **44.1 kHz mono 16-bit PCM**; MP3 **44.1 kHz mono 128 kbps**; M4B **AAC 44.1 kHz mono 112 kbps**, carrying **20 chapter markers** and historical candidate-edition metadata.

## Completed output QA

- **20/20** source input hashes checked against the retained candidate evidence before conversion.
- **20/20** lossless outputs have valid WAV headers, unchanged per-track frame counts from their own transformed source, and recorded output SHA-256.
- **20/20** MP3 files successfully decoded in a full pass, and have SHA-256 in the embedded `manifest.json`.
- Output WAV integrated loudness between **−19.1 and −19.0 LUFS** and true peaks between **−3.5 and −2.5 dBTP**, using conservative linear gain rather than dynamic compression.
- Original packages previously recorded passing ZIP CRC; **separate rebuilt MP3 and four WAV ZIPs** have their own verified ZIP CRC and SHA-256 evidence in the current rebuild manifest. Big WAV ZIPs are local download artifacts; all 20 WAVs are persisted individually to Library.
- M4B full decode **PASS**, **20** chapters verified, integrated **−19.0 LUFS**, true peak **−1.5 dBTP**, and duration matches the assembled audio.
- This is a **technical signal/format PASS for the new offline candidate package only**, not a final human listening or verified Descript-master PASS.

## Unchanged governance and blockages

The source [20-track manifest](./SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json), its composition IDs and its publication flags were **not changed**. The missing native selected-v2 WAV and other composition-to-export attestations are **still missing**. Exact spoken Appendix B pipeline-identifier listening is not independently certified. Final public edition labeling, accessible companion/player delivery and any required legal compliance review are separate release checks. The owner-directed private package does not waive these factual gaps.

**No Production changes** (Vercel, Supabase, Render, Resend, Lovable, public audio storage or member entitlements), no public Descript share or publish, no synthesis, no application-code changes, and no PR merge. The PR currently covers a much broader historical diff than the private audio package; treat a merge as a separate scoped operation. The latest Web quality run had a separate high-severity Vite/launch-editor npm-audit failure; this was not altered by the audio work.

**Release controls remain:** `production_enabled=false`; `public_allowed=false`; `merge_allowed=false`; `publication_approval=NOT_GRANTED`. Owner acceptance was recorded only at its stated scope; neither the audio files nor their filenames should be represented as attested selected Descript masters.

**Storage confirmation (2026-10-21 continuation):** Verified Library readback confirms one M4B, one rebuilt MP3 ZIP, twenty individual lossless candidate WAVs, a private-readme and three JSON manifests/reports under the private folder above. The large WAV ZIP containers did not persist as grouped ZIPs; those files exist only in the active artifact sandbox. Original Google Drive source inventory unchanged. No website/media-server publication or member entitlement action occurred.
