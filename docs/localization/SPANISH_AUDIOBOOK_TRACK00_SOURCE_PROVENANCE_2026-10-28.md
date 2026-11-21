# Spanish audiobook Track 00 source provenance — 2026-10-28
Corrected reconciliation: **2026-11-01** (Issue #1044; draft-only)

Status: **ORIGINAL SOURCE VERIFIED / EDITED SELECTED v2 WAV PENDING / RELEASE HOLD**

This document previously called the **original** 113.345306-second Descript composition the "selected" release source. That was incorrect against the canonical historical private 20-track selection. This correction preserves original-source provenance while naming the actual edited v2 candidate. It neither publishes nor authorizes delivery.

## Private Descript source project

- Project: `USD Impact — Spanish Audiobook Full Production — Mateo — PRIVATE QA`
- Project ID: `2f542797-4a70-4d44-a164-76dee15859ca`
- Member release: **OFF**; no public publishing authorized.

## Historical original source — confirmed; NOT the selected v2

- Composition: `00 - Lee primero el dólar`
- Composition ID: `91240c6b-78df-4910-a994-43c616f9b53f`
- Descript media asset ID: `12e94d44-66e7-4baf-9731-9a8470697b63`
- Original source filename: `00 - Lee primero el dólar.wav`
- Duration: **113.345306 s**
- Connected private Google Drive file: [original WAV](https://drive.google.com/file/d/15TjFGX0fx5Cci0EjXNcenhJ-wFrIAQ0y/view).
- Independently compared with the owner's uploaded original WAV on 2026-11-01: **9,997,188 bytes**; SHA-256 `d4a0a8d55af56cf015bfac841402f9cd4c0b750404b52ad19be5cfc4e2fc6c2b`.
- The original retained a reported spoken `Copyright` interruption; it is **not** accepted as the final edited v2 master.

The prior read-only Descript composition/media inspection established that the original 113.345306-second composition uses the same-named original WAV, rather than an older 105.308073-second fallback. It **did not** establish that the original is the final release choice.

## Current private selection — edited Copyright Tail v2

The historical private [20-track selection manifest](https://github.com/usdimpact/usd-impact-site/blob/feat/spanish-audiobook-pilot-foundation/docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json) and [EDL reconstruction](https://github.com/usdimpact/usd-impact-site/blob/feat/spanish-audiobook-pilot-foundation/docs/localization/SPANISH_AUDIOBOOK_TRACK00_EDL_RECONSTRUCTION_2026-10-27.md) identify:

- **Selected composition ID:** `ebe7f026-e369-4dd4-a184-9476a6482f5b`
- Review label: `00 - Copyright Tail QA v2 - DO NOT PUBLISH`
- **Selected duration:** **109.835306 s**
- Edit geometry: 0.760-second ripple removal from a 110.595306-second preceding private edit version.
- Selected v2 received scoped owner listening acceptance, and the historical closeout records owner-reported 20/20 full-track listening PASS.
- A deterministic render-equivalent 109.835306-second candidate was validated for **private 192 kbps MP3 encoding-profile tests only**. It was not certified byte-identical to the Descript-rendered selected v2.

The exact **selected v2 rendered WAV bytes, SHA-256, and final source-to-composition mapping** are not yet established. Do not substitute the original (113.345306 s), the earlier 110.595306 s version, or the 105.308073 s fallback as a final master.

## Final private-master requirements

1. Export/download the **selected v2 composition** as a private WAV through Descript's non-publishing UI path, then record project, composition, time, filename, byte size, SHA-256, PCM format and decoded duration. Expected approximately **109.835306 s**.
2. If exact selected-v2 binary cannot be accessed, use the separately documented deterministic render-equivalent candidate **only after explicit owner/publisher approval naming that exact substitution** and completing acoustic/editorial QA.
3. Independently check transcript continuity, removal of the unwanted opening word, edit seam, loudness, true peak, clipping, channel/rate and excessive silence.
4. Freeze an exact Track 00 WAV-to-192 kbps MP3 result, with checksums, then reconcile all 20 final selected tracks. Encoding-profile test hashes are not final output hashes unless reproduced and verified on the actual approved sources.
5. Separately resolve MP-21 Introduction source wording and the Spanish Track 02 update/synchronization decision before final release of the full programme.

## Release boundary

**No release authorization** is inferred from this corrected provenance, owner listening QA or matching original WAV. Rights/voice commercial licence, publisher/distribution approval, customer-facing disclosure, final private Storage, entitlement-safe signed playback, exact-head tests and a distinct release authorization remain separate gates. Preserve English files and current Production untouched. Historical Draft PR #797 is evidence, **not** a direct merge source.
