# Spanish audiobook Track 00 — private export and hash checklist — 2026-10-28
Corrected target: **2026-11-01**, Issue #1044

Status: **SELECTED EDITED v2 PRIVATE EXPORT PENDING / NO PUBLISH / RELEASE HOLD**

Purpose: retrieve and verify the exact **selected edited Track 00 v2**, not the already archived original audio. The earlier version of this checklist mistakenly called the original 113.345306-second composition "selected."

## Pinned final private review selection

- Project: [USD Impact — Spanish Audiobook Full Production — Mateo — PRIVATE QA](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca)
- **Selected composition ID: `ebe7f026-e369-4dd4-a184-9476a6482f5b`**
- Descript review label: **`00 - Copyright Tail QA v2 - DO NOT PUBLISH`**
- **Expected selected programme duration: 109.835306 seconds** (about 1:50)
- Canonical selection authority: [historical private manifest](https://github.com/usdimpact/usd-impact-site/blob/feat/spanish-audiobook-pilot-foundation/docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json)
- Exact edit geometry: [EDL evidence](https://github.com/usdimpact/usd-impact-site/blob/feat/spanish-audiobook-pilot-foundation/docs/localization/SPANISH_AUDIOBOOK_TRACK00_EDL_RECONSTRUCTION_2026-10-27.md)

**Do not substitute:**
- original `00 - Lee primero el dólar.wav`, media `12e94d44-66e7-4baf-9731-9a8470697b63`, original composition `91240c6b-78df-4910-a994-43c616f9b53f`, **113.345306 s**. This original was recovered from [private Google Drive](https://drive.google.com/file/d/15TjFGX0fx5Cci0EjXNcenhJ-wFrIAQ0y/view) and verified against the owner upload on 2026-11-01, but is not v2.
- earlier v1 edit **110.595306 s**.
- older fallback **105.308073 s**.

## Why the exact v2 export is pending

The connected Descript application can query composition metadata and transcripts but cannot return the **exact rendered selected-v2 WAV bytes** via read-only media retrieval. The connected Google Drive folder contains original and historic repair WAVs, but the exact v2 render at 109.835306 seconds was not located there. Do **not** use Descript MCP `publish_project` as an export workaround: that would create a share publication.

## Minimal private manual export

1. Open the [private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca).
2. Find and select **`00 - Copyright Tail QA v2 - DO NOT PUBLISH`**; confirm the composition ID where the interface permits it.
3. Confirm duration is approximately **1:49.835**, not the original **1:53.345**.
4. Use the **private local download / export audio** function; choose lossless WAV at original source quality. Do **not** use Publish, Share, public/private share-page export, regeneration, transcription enhancement, sound processing or normalization.
5. Save as `00-lee-primero-el-dolar-selected-v2-exact.wav` and upload privately to the already existing Spanish QA Google Drive folder. Leave sharing restricted.
6. If only publish/share is available, stop and report that; do not silently export a different composition.

## Verification after the exact file is available

- Capture exact source project, composition ID, export date/time and filename.
- Decode and verify valid WAV, number of channels, sample rate, codec/subtype and duration near **109.835306 s** (tolerance appropriate to sample-frame arithmetic).
- Compute original WAV byte size and SHA-256; compare recorded source mapping to the v2 composition and EDL edit geometry.
- Check first seconds, the removed word and splice, the relevant ~42–51 second region, final rights/disclaimer tail, loudness, true peak, silence, clipping, and known QA seams.
- Encode from that approved source as 44.1 kHz / mono / 192 kbps MP3 without material gain/EQ/compression/denoise; compute SHA-256 and duration of **this** final output.
- Map final Track 00 and the 19 independently QA-tested selected tracks to an immutable 20-track manifest. Run final encoded playback/decoder/size/peak tests. Earlier encoding-profile candidate hashes are **test evidence**, not automatically the actual final masters.
- Store file bytes privately; record only checksum/metadata in Git. Never commit source or member MP3s to a public repository.

## Alternative only with an additional decision

An independently reconstructed/render-equivalent 109.835306-second candidate exists and previously passed private encoding-profile QA. It is **not byte-proven identical** to the selected Descript v2 render. Use it as a final replacement **only** when the owner/publisher explicitly authorizes that named substitution and independent acoustic/rights QA approves it. The generic request to complete Spanish release is not a substitution-specific acceptance.

## Fail conditions / release boundary

Remain **HOLD** if:
- selected v2 composition/source cannot be confirmed;
- exported time or content differs materially;
- the file came from the original 113.345 s, v1 110.595 s or fallback 105.308 s;
- the edited unwanted spoken fragment reappears;
- processing or regeneration changes approved audio;
- source bytes cannot be retained privately;
- exact WAV QA or MP3 freeze fails.

Passing this checklist would resolve only the selected Track 00 **Gate A source/master**. It does not grant voice/IP rights, approve AI disclosure, replace the Spanish/English manuscript, authorize storage upload, enable `audiobookMemberDelivery=true`, grant Library entitlements, or authorize Production/public release.
