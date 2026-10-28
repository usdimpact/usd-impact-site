# Spanish audiobook Track 00 — private export and hash checklist — 2026-10-28

Status: **MANUAL PRIVATE MATERIALIZATION REQUIRED / NO PUBLISH / RELEASE HOLD**

Purpose: obtain the exact bytes for the already-selected Track 00 source without substituting a reconstructed/render-equivalent file.

## Pinned source identity

Private Descript project:
https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca

Project:
`USD Impact — Spanish Audiobook Full Production — Mateo — PRIVATE QA`

Selected composition:
- ID: `91240c6b-78df-4910-a994-43c616f9b53f`;
- name: `00 - Lee primero el dólar`;
- duration: **113.345306 s**.

Media used by the composition:
- filename: `00 - Lee primero el dólar.wav`;
- Descript media reference: `12e94d44-66e7-4baf-9731-9a8470697b63`;
- duration: **113.345306 s**.

Do not use:
- `spanish-audiobook-track00-mateo-no-version-private-2026-10-09.wav`;
- duration **105.308073 s**;
- historical fallback only.

## Why a manual export is still required

The connected Descript inspection tools can prove composition/media identity and duration but do not expose the original raw media bytes or a cryptographic hash.

The Descript MCP `publish_project` action creates/reuses a share publication and therefore is intentionally **not** being used under the current release HOLD.

Google Drive search currently does not surface the exact selected 113.345306 s WAV.

## Required private export

Use the authenticated Descript UI only.

1. Open the private project URL above.
2. Select composition **00 - Lee primero el dólar**.
3. Confirm its displayed duration is approximately **1:53** and the selected composition is the pinned composition, not a CLICK/repair/fallback candidate.
4. Use Descript's local/download export path for the current composition.
5. Export **Audio / WAV (lossless)**.
6. Do not enable Studio Sound, normalization, EQ, compression, denoise, filler-word edits, regeneration, or any new processing.
7. Do not publish a share page.
8. Save with an unambiguous private filename, recommended:
   `00-lee-primero-el-dolar-selected-v2-exact.wav`.
9. Upload that exact exported file to the approved private Google Drive working location without converting it.

UI labels can vary by Descript client/version. The required outcome is a private WAV download of the selected composition, not a Descript publish/share link.

## Handoff back to engineering

After the exact WAV is in connected Google Drive, engineering can perform the rest without another audio-edit decision:

1. fetch the raw Drive file;
2. record exact byte size;
3. compute SHA-256;
4. decode and confirm duration;
5. confirm channel/sample-rate/PCM properties;
6. compare duration against **113.345306 s** within the accepted decoder tolerance;
7. encode to the already-validated release profile:
   - MP3;
   - 44.1 kHz;
   - mono;
   - 192 kbps;
   - no gain/EQ/dynamics processing;
8. record MP3 byte size + SHA-256;
9. rerun Track 00 decode/loudness/true-peak/silence/clipping/boundary checks;
10. add Track 00 to the final 20-track private-master manifest.

## Fail conditions

Stop and classify HOLD if:
- exported duration materially differs from 113.345306 s;
- selected composition ID/name cannot be confirmed;
- the export is sourced from the 105.308073 s fallback;
- any processing was applied;
- file is not a valid decodable WAV;
- source bytes cannot be retained privately;
- a share/public publish is the only available export method;
- source provenance cannot be tied back to the pinned project/composition/media identity.

Do not “fix” a mismatch by trimming, stretching, regenerating, normalizing, or substituting another file.

## Evidence record to add after materialization

Record privately/repository-safe metadata only:
- export timestamp;
- project ID;
- composition ID;
- media reference ID;
- filename;
- byte size;
- SHA-256;
- decoded duration;
- sample rate;
- channel count;
- codec/bit depth;
- MP3 output SHA-256 and size;
- QA result.

Never commit the audio bytes to Git.

## Release boundary

Completion of this checklist clears only the remaining Track 00 **binary materialization** part of Gate A.

It does not authorize:
- legal/publisher clearance;
- storage upload;
- member route;
- entitlement changes;
- `audiobookMemberDelivery=true`;
- Production release.
