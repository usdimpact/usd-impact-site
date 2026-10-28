# Spanish audiobook Track 00 source provenance — 2026-10-28

Status: **SOURCE IDENTITY RESOLVED / BINARY MATERIALIZATION PENDING / RELEASE HOLD**

This record resolves the previously ambiguous question of which private Descript object is the authoritative source identity for Track 00 of the Spanish audiobook. It does not authorize publication, member delivery, Production storage upload, or legal distribution.

## Canonical private Descript project

Project:
- name: `USD Impact — Spanish Audiobook Full Production — Mateo — PRIVATE QA`;
- project ID: `2f542797-4a70-4d44-a164-76dee15859ca`;
- current project state remains private QA.

## Authoritative Track 00 composition identity

Selected composition:
- composition name: `00 - Lee primero el dólar`;
- composition ID: `91240c6b-78df-4910-a994-43c616f9b53f`;
- media type: audio;
- duration reported by Descript: **113.345306 s**.

## Matching source media identity

The same canonical private project contains:
- media filename: `00 - Lee primero el dólar.wav`;
- Descript asset ID: `12e94d44-66e7-4baf-9731-9a8470697b63`;
- media duration reported by Descript: **113.345306 s**.

The exact duration match between the selected composition and same-named WAV is strong source-identity evidence.

This project also contains a separate historical fallback asset:
- `spanish-audiobook-track00-mateo-no-version-private-2026-10-09.wav`;
- duration: **105.308073 s**.

That shorter fallback must not be silently substituted for the selected 113.345306 s Track 00 composition.

## What is now resolved

Resolved:
- the authoritative private Descript project;
- the selected Track 00 composition identity;
- the matching same-named WAV asset identity;
- separation from the shorter fallback source;
- the authoritative selected duration.

Therefore the Track 00 release-source **identity** is no longer ambiguous.

## What remains unresolved

The connected Descript API currently exposes project/composition/media identity and duration, but does not provide the raw media bytes or a byte hash through the available read-only inspection path.

Therefore this record does **not** claim:
- a SHA-256 for the selected Descript WAV;
- byte-for-byte equality between the selected Descript WAV and any separately reconstructed/render-equivalent file;
- that a deterministic render-equivalent candidate is the exact Descript export.

Before final private-master materialization:
1. obtain the exact private bytes corresponding to asset `12e94d44-66e7-4baf-9731-9a8470697b63` through an approved private export/download path;
2. record byte size + SHA-256;
3. encode those exact bytes to the already validated 192 kbps MP3 profile;
4. rerun final Track 00 technical QA.

If the exact bytes cannot be materialized, explicit owner/publisher approval is still required before substituting any deterministic render-equivalent source.

## Release boundary

This provenance resolution closes the **source identity** ambiguity only.

It does not clear:
- Gate A final Track 00 binary materialization;
- Gate B legal/publisher clearance;
- private storage upload;
- Spanish member route;
- `audiobookMemberDelivery=true`;
- Production release.

Historical PR #797 remains private evidence and is not a direct merge source.
