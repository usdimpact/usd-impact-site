# Library Pass audiobook private-delivery runbook

Status: source implementation prepared; private asset migration and Preview verification are still required.

Scope: Issue #121, the complete English audiobook for *Read the Dollar First*. This runbook does not authorize a Production deployment, a database migration, a billing change, an asset upload, or deletion of the legacy public objects.

## Delivery contract

- Full playback requires an authenticated account whose permanent Library Pass entitlement is active.
- The entitlement is the existing Library Pass product (`read-the-dollar-first-guided-interactive-edition`). Research Membership is intentionally neither sufficient nor required.
- The public audiobook page contains titles, durations, product information, and a sign-in CTA only. It must not contain playable object URLs.
- The protected player uses same-origin routes under `/guided-edition/audiobook/track/{slug}/`.
- Each track request repeats the server-side Library Pass check. Only an allowed request receives a temporary, one-hour Supabase Storage signed URL.
- Missing, suspended, disputed, refunded, charged-back, revoked, expired, deletion-pending, and deleted access states fail closed before signing.
- Protected responses use `private, no-store`, `Vary: Cookie, Authorization`, `noindex`, and `Referrer-Policy: no-referrer`.

## Private storage layout

Create or reuse a **private** Supabase Storage bucket named `library-pass-assets`. The bucket must not be public. Upload the audio masters below beneath:

`audiobook/read-the-dollar-first/v1/`

Do not rename, recompress, retag, or otherwise transform these frozen masters during migration. The source manifest in `apps/web/src/lib/private-audiobook.js` is authoritative for runtime object paths and integrity metadata.

| # | Object filename | Bytes | SHA-256 |
|---:|---|---:|---|
| 00 | `00-read-the-dollar-first.mp3` | 2,128,764 | `946012ea5010c48be184b0d358741ec7926a844bb42960398443aac9dc4ddb91` |
| 01 | `01-acknowledgments-and-reader-guide.mp3` | 4,293,594 | `404c79abe686a0811ae480aaff7e406bfe6885ad62139d6a5a237271328d160d` |
| 02 | `02-introduction-why-this-book-exists.mp3` | 16,648,680 | `a79212c7e18919292b89737e851e02a63df18339e017ff2deee52d9a7f9315eb` |
| 03 | `03-chapter-1-why-the-dollar-comes-first.mp3` | 21,081,767 | `8b4ac6c668566c61dc4d2a8b1b60c85667fa6d901fd8494f8073ce41c8ec96bb` |
| 04 | `04-chapter-2-from-bretton-woods-to-fiat-discipline.mp3` | 21,711,851 | `d4b0cce22e9f86de380cf70dbc46f8abdf159eac0e9809a8366efb71d2596e56` |
| 05 | `05-chapter-3-usd-is-not-dxy.mp3` | 22,664,148 | `65a7678580e9fbf7e1e50c436d5d9e9fc88326bde1a8f5d3d89b92023460ec7f` |
| 06 | `06-chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx.mp3` | 27,391,305 | `89858e715b9385a2e2d5afbecbeec9c62a656420e2f3a459ed72684c0abda70c` |
| 07 | `07-chapter-5-oil-is-not-a-dollar-trade-only.mp3` | 24,178,221 | `b9e1eb43b60266a7bb1dbc59c35c9bcd195fbe221b193098b17cd3b13d1ba7ea` |
| 08 | `08-chapter-6-gold-and-the-dollar.mp3` | 19,479,304 | `00b5efa8428fe6f80b43a099ac9f9f544ec08ad95af93035b730416cd76566b1` |
| 09 | `09-chapter-7-bitcoin-and-the-dollar.mp3` | 21,664,190 | `b0432e533278983f478c6ee973ea04b8422d150f61f2469dbbd26408e4bd92bf` |
| 10 | `10-chapter-8-gas-lng-and-the-dollar.mp3` | 19,505,015 | `d0c5214d762c179953e74070074143db639771bf7c79f579a6105a29c7464f3e` |
| 11 | `11-chapter-9-fx-carry-and-translation-risk.mp3` | 18,167,135 | `3cb80f6f9d8a68c0ac5ba1af9a7ea91803a49b2f0178df2bba72b0b6ba2b982d` |
| 12 | `12-chapter-10-reading-regimes-the-eleven-year-record.mp3` | 37,150,223 | `eb6b24eba2cff93ad0d35680ced2a4c113f3cd0ae42e62e2adbe2aab5b5ae127` |
| 13 | `13-chapter-11-the-weekly-operating-framework.mp3` | 18,683,105 | `26554932d63675ce4452847341793834cfc5b909ab09e9289f2a4405e6688879` |
| 14 | `14-chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis.mp3` | 23,274,825 | `6bd33b69d966b04cb857985a0707056e0ed74cc70d20a88c23f072ae065a328f` |
| 15 | `15-chapter-13-what-to-watch-from-here.mp3` | 26,885,965 | `53c3fe19f740405c3c08b8d3d90f30f2248766fb300d97b0606b1c8f32bb370e` |
| 16 | `16-further-reading.mp3` | 3,219,632 | `9a9565410970b5f5c1f7bfec39313c1b82656f7546177cec518e3603d4483e6d` |
| 17 | `17-appendix-a-quick-glossary.mp3` | 24,751,856 | `450b6a97b096708435f0db891e4ee9dec17458a3338c4dbddfc587a4c9699c6c` |
| 18 | `18-appendix-b-usd-impact-score-methodology.mp3` | 18,886,231 | `349844333398a408d01c714f511a1b1e805874a7b2ed2a4e09c34db677593b3f` |
| 19 | `19-about-usd-impact.mp3` | 881,779 | `faf54b3a98488ee8b8386a7adaa208f47ed2bb9f8ef549bca5f1188a4b6d1d00` |

## Authorized migration procedure

Perform these steps only after explicit approval for the target Supabase project and asset upload:

1. Confirm the target is the non-Production project used by the PR Preview.
2. Confirm the bucket is named exactly `library-pass-assets` and its public setting is disabled.
3. Upload all 20 frozen masters to the exact prefix above without overwriting unrelated objects.
4. Read every uploaded object back through an authenticated administrative path and verify its byte length and SHA-256 against the table. A filename-only comparison is insufficient.
5. Confirm the Preview function has its existing Supabase URL, publishable key, and secret key configuration. Do not expose the secret to client-side variables or logs.
6. Deploy only to Preview and run the verification matrix below.

If any object is missing or has the wrong digest, stop. Do not substitute a similarly named file and do not proceed to legacy cleanup.

## Preview verification matrix

| Case | Expected result |
|---|---|
| Anonymous public page | Product information and 20-track chapter list appear; no player or audio URL appears. |
| Anonymous member-player request | Redirect to sign-in, preserving `/guided-edition/audiobook/` as `next`. |
| Active Library Pass | Protected player renders all 20 tracks in manifest order. |
| Active Library Pass, no Research Membership | Playback still works. |
| Research Membership only | Access is denied. |
| Missing or inactive Library Pass | Access-required redirect; no storage-sign request. |
| Refunded, disputed, charged back, revoked | Access-required redirect; no storage-sign request. |
| Deletion pending or deleted | Access-required redirect; no storage-sign request. |
| Valid track | Same-origin track route returns a no-store redirect to a temporary Supabase signed URL. |
| Invalid track slug | Generic 404; no storage-sign request. |
| Missing/private-storage object | Generic 503; no provider details, secrets, or object URL in the response. |
| Playback controls | Play/pause, seek, previous, next, speed, track selection, and automatic next track work. |
| Saved position | Reload resumes the selected track and position in the same browser; no listening position is sent to analytics. |
| Accessibility | Keyboard focus, native audio controls, labels, current-track announcement, and mobile layout are usable. |
| Public-output inspection | No permanent audio URL, legacy Blob hostname, signed URL, token, or MP3 object path appears in generated public HTML. |

Use desktop and mobile viewports. Check the browser network panel as well as page source: the protected page may reveal same-origin track routes, but only a successfully authorized track request may receive a temporary signed URL.

## Legacy public-object cleanup gate

The current Vercel Blob objects must remain untouched until all private objects pass integrity checks and the complete Preview matrix passes. Removal is destructive and requires a separate, explicit approval that identifies the exact legacy prefix:

`read-the-dollar-first/`

Before deletion, record the object inventory and confirm rollback material exists. After deletion, verify that every former public audio URL returns an unavailable response and that authorized private playback remains healthy. Do not close Issue #121 and do not promote to Production until this cleanup and the Production verification gate are separately approved and completed.
