# Spanish audiobook release blueprint — 2026-10-28

Status: **IMPLEMENTATION-READY PLAN / RELEASE HOLD**

This document defines the smallest safe path from the verified private Spanish audiobook QA state to a future Library Pass release. It does not authorize storage upload, member delivery, public publication, entitlement changes or Production release.

## 1. Current verified state

Protected main at planning start:
`f81b7299015025c3cece866f35474030a13fb585`

Private production/QA authority:
PR #797, branch `feat/spanish-audiobook-pilot-foundation`.

Current QA facts:
- 20/20 selected private Descript compositions exist and match the canonical manifest identities.
- Owner-reported full-track listening: **20/20 PASS**.
- 19 exact selected private Drive WAV exports passed decoder/duration/loudness/true-peak/silence/clipping QA.
- Those 19 tracks are 44.1 kHz, mono, PCM16 with integrated loudness tightly clustered at approximately -24.0 to -23.8 LUFS.
- The largest targeted signal outliers on Tracks 13 and 14 received owner **PASS BOTH**.
- Track 00 selected v2 has bounded edit provenance and private human listening acceptance; its exact Descript binary export remains a provenance-detail item, not an unresolved acoustic defect.
- Current-main localization manifest now records the Spanish audiobook as `verified_current` / review PASS while preserving `releaseStatus=private_hold` and `audiobookMemberDelivery=false`.

## 2. Existing English member-delivery architecture

The current English audiobook already provides the security model to reuse:

- protected member route: `/guided-edition/audiobook/`;
- server-side Library Pass access verification;
- private Supabase Storage bucket: `library-pass-assets`;
- no browser storage-object policy access;
- server mints a short-lived signed URL only after entitlement verification;
- signed URL TTL: 3600 seconds;
- response policy: private/no-store/noindex;
- browser progress stored locally, not inferred as account listening history.

Current storage bucket contract:
- private;
- MIME allowlist: `audio/mpeg`;
- per-object limit: 40 MiB.

English audiobook file evidence shows an effective delivery encoding of approximately **192 kbps MP3** across all 20 tracks.

## 3. Spanish final delivery format

### Conservative default

Use:
- MP3 / `audio/mpeg`;
- 44.1 kHz;
- mono;
- **192 kbps**;
- preserve accepted narration dynamics;
- do not introduce EQ, compression, denoise, speech regeneration or loudness gain merely to make the waveform “look mastered”.

Rationale:
- matches the current English member-product bitrate;
- fits the existing storage MIME contract;
- avoids a storage migration;
- minimizes acoustic drift from the already human-approved selected program.

At 192 kbps:
- longest selected Spanish track (~1374.2 s) is approximately **31.45 MiB**, below the 40 MiB object limit;
- total 20-track program is approximately **406.24 MiB**.

### Loudness decision

Do **not** automatically normalize the accepted -24 LUFS-class source set to the older provisional -16 LUFS planning value.

The existing Spanish selected exports already show only ~0.2 LU cross-track spread and no clipping. Any material gain/compression change would create a new acoustic master requiring another listening/mastering acceptance cycle.

Preferred release-candidate path:
1. encode the accepted PCM program to 192 kbps MP3 without material gain/EQ/dynamics processing;
2. measure the encoded outputs again;
3. confirm no encoder-induced clipping, excessive silence, duration drift or new boundary artifacts;
4. spot-check encoded beginning/end and known repair joins;
5. only introduce a loudness-processing stage if the resulting listening experience or explicit distribution requirement demonstrates a need.

## 4. Storage namespace

Do not mix Spanish files into the existing English v1 prefix.

Recommended private object prefix:

`audiobook/read-the-dollar-first/es/v1`

This keeps:
- entitlement model shared;
- locale assets isolated;
- rollback simple;
- English hashes/paths immutable.

Do not upload until the final 20 MP3 filenames, byte sizes and SHA-256 hashes are frozen.

## 5. Runtime implementation shape

Do not wholesale merge historical PR #797.

Reconstruct the smallest release candidate from then-current protected main.

Expected runtime scope:

1. Add a Spanish audiobook metadata manifest:
   - Spanish title/subtitle;
   - 20 selected track labels;
   - stable Spanish slugs;
   - final displayed durations.

2. Refactor private audiobook lookup to be locale-aware:
   - English remains existing default;
   - Spanish uses its own object prefix and immutable file/hash records;
   - a requested locale must resolve explicitly or fail closed.

3. Add Spanish protected route only when the release gate is deliberately opened:
   - proposed member page: `/es/guided-edition/audiobook/`;
   - proposed track path: `/es/guided-edition/audiobook/track/<slug>/`.

4. Reuse existing:
   - Library Pass entitlement;
   - server-side Supabase signing;
   - signed TTL;
   - no-store/noindex headers;
   - player logic;
   - locale-specific browser progress key already supported by `audiobookProgressStorageKey('es')`.

5. Keep English route, object hashes and progress key unchanged.

## 6. Fail-closed implementation sequence

### Gate A — final encoded private masters

Before any runtime release branch:
- encode 20 private MP3 candidates;
- record selected composition → source WAV → MP3 mapping;
- record size, SHA-256, duration, codec, sample rate, channel count;
- run final decode/loudness/peak/silence checks;
- preserve WAV/source rollback assets privately.

### Gate B — legal/publisher clearance

Resolve separately:
- spoken rights/copyright adaptation;
- final publication/edition labeling;
- AI-generated narration disclosure wording where required;
- accessible companion/player treatment for non-narrated printed navigation aids;
- distribution authorization.

### Gate C — private storage upload

Only after A + B:
- upload under Spanish locale prefix;
- verify bucket remains private;
- verify exact remote sizes/checksums where supported;
- no public object URLs.

### Gate D — current-main Preview implementation

Create a fresh current-main PR containing only:
- Spanish audiobook manifest;
- locale-aware private-audiobook plumbing;
- Spanish protected player route;
- tests;
- localization-manifest release-state update only when authorized.

Preview tests must prove:
- anonymous user denied before asset read;
- inactive entitlement denied;
- active Library Pass signs only the requested Spanish object;
- path traversal/unknown locale/unknown slug fail closed;
- English audiobook unchanged;
- Spanish and English browser progress keys remain separate;
- signed URL stays same-origin to configured Supabase storage endpoint;
- no Spanish audio object or signed URL is indexable/cacheable.

### Gate E — explicit release authorization

Only after exact-head CI/CodeQL/Preview and real private-storage smoke:
- merge through protected path;
- verify Production;
- separately confirm member delivery is intended to become true.

## 7. Current prohibitions

Until Gates A–E are cleared, do not:
- flip `audiobookMemberDelivery=true`;
- create a public Spanish audiobook route;
- upload final Spanish member assets to Production storage;
- alter Library Pass entitlement logic;
- republish or regenerate accepted narration;
- replace English audiobook files;
- use the old PR #797 branch as a direct merge source;
- interpret QA completion as legal or distribution authorization.

## 8. Current remaining decisions

Engineering/audio:
- **192 kbps MP3 encoding profile QA: PASS** — 20/20 technical candidate encodes validated; authoritative record: `SPANISH_AUDIOBOOK_PRIVATE_MP3_ENCODING_QA_2026-10-28.md`;
- final private-master materialization remains held until Track 00 release-source provenance is resolved;
- exact Track 00 final binary provenance record if available, or explicit publisher/owner approval of the deterministic render-equivalent source.

Publisher/legal:
- rights wording;
- edition/publication labeling;
- accessibility companion;
- narration disclosure/perimeter;
- final distribution authorization.

**Current disposition: technically ready to prepare private encoded masters; member release remains HOLD.**
