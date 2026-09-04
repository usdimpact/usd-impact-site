# Video media reconciliation — 2026-09-04

Status: **Production application map verified; provider/editorial approval gaps explicitly held**

Owners: engineering for delivery; editorial/media for HeyGen source approval

Destructive action: prohibited by this record

## Current authority

| Layer | Authority | Verified state |
|---|---|---|
| Published catalog metadata | `apps/web/src/data/video-library.js` | 51 films in five ordered collections; 4,897.148 seconds total |
| Protected delivery map | `apps/web/src/lib/video-stream-map.js` | 51 unique catalog slugs mapped to 51 Cloudflare Stream UIDs |
| Playback boundary | `apps/web/src/lib/cloudflare-stream.js` and protected video handler | entitlement is checked before a short-lived Stream token is generated; the public catalog must not disclose UIDs, playback origins, or tokens |
| Source renders | HeyGen workspace | 43 completed renders observed; repeated titles and materially different durations exist |
| R2 audiobook/media copies | Cloudflare provider inventory | unverified because no Cloudflare inventory connector was available; current main contains no R2 audiobook reference |

Production Stream remains the authority for what is delivered. A title/duration similarity to a HeyGen render is only a candidate link, not editorial approval.

## Five production topics

1. Core Dollar Framework — 3 films.
2. Asset Transmission — 6 films.
3. Rates, Liquidity & Policy — 13 films.
4. Global Dollar & FX Mechanics — 22 films.
5. Dollar Funding Stack — 7 sequential masterclass films.

The exact 51 title, slug, duration, collection, and Stream UID mappings are versioned in the two authority files above and are checked by the video-library contract tests.

## HeyGen candidate reconciliation

The HeyGen read-only inventory returned 43 completed renders. All observed Part 1–7 masterclass runs had subtitle and captioned-video artifacts. The closest duration candidates are recorded below solely to accelerate editorial review.

| Production film | Production duration | Closest HeyGen candidate | Candidate duration | Difference | Disposition |
|---|---:|---|---:|---:|---|
| Part 1 — Foundations | 344.247s | `19296d74f39b482b8cc9391fb2d571aa` | 349.827s | 5.580s | candidate; approval required |
| Part 2 — The FX Swap Engine | 331.400s | `1ccd9e0f244a4d80b1c2308f67d7674a` | 333.009s | 1.609s | candidate; approval required |
| Part 3 — Repo, Collateral and Haircuts | 383.445s | `7ac12ec72a334771b437d5627ed2091f` | 383.425s | 0.020s | strong candidate; approval required |
| Part 4 — Dealers and Balance-Sheet Intermediation | 354.005s | `8bb317f6c2ed41d5ba9183f3cc22b50a` | 353.985s | 0.020s | strong candidate; approval required |
| Part 5 — Funding Stress and Market Transmission | 351.744s | `e728bd00c5224b0d9b801860a42bd742` | 351.740s | 0.004s | strong candidate; approval required |
| Part 6 — Global Dollar Funding and FX Swaps | 340.288s | `3eaf651b6e4f466db4c259c904b7d2af` | 340.271s | 0.017s | strong candidate; approval required |
| Part 7 — Dollar Liquidity Backstops and Policy Facilities | 337.045s | `82e52853b08d4e048f5122eca99edd43` and `b779af3b44ad421abafe622c2f304241` | 337.032s each | 0.013s | ambiguous duplicate; approval required |

The workspace also contains candidates for DXY, Dollar/Yields/Liquidity, and One Dollar Shock. Multiple titles/durations conflict, so no unique link is approved. No authoritative HeyGen match was observed for the other 41 short films.

## Read-only provider recheck — 2026-09-04

- HeyGen again returned 43 videos, all in `completed` state.
- 35 of the 43 completed renders expose both a captioned-video artifact and a subtitle artifact; eight short-form candidates expose neither artifact in HeyGen.
- The inventory resolves to 20 exact title groups. Repeated-title ambiguity remains material, including six Part 7 renders, four Part 3 renders, four One Dollar Shock renders, and multiple DXY and other masterclass renders.
- The candidate rows above remain consistent with the current inventory. No candidate has been promoted to an editorially approved source solely from title or duration similarity.
- The application contracts passed again: 51 catalog entries, 51 matching unique Stream mappings, entitlement-before-token behavior, anonymous denial, and public-catalog non-disclosure.
- The Cloudflare provider dashboard remained behind a human-verification challenge in the available verification browser. No Stream signing, caption, transcript, thumbnail, duration, or R2 classification claim was inferred from that inaccessible provider surface.

No HeyGen or Cloudflare asset was renamed, deleted, replaced, made public, or otherwise changed during this recheck.

## Required provider/editorial closure gate

Before MEDIA-01 or CF-01 can be marked fully closed, an authorized owner must verify in Cloudflare and the media workspace:

- each of the 51 Stream assets is signed-only and is the intended published file;
- English caption file, transcript location, thumbnail, and actual provider duration for every Stream UID;
- one editorially approved HeyGen source render where HeyGen is the source, or an explicit non-HeyGen source classification;
- every R2 object/bucket is classified as active delivery, backup, migration source, or obsolete.

Do not delete, rename, replace, make public, or alter signing/retention based on this candidate list. Provider cleanup requires a separately approved manifest after the ambiguities are resolved.
