# Separate media preference and Spanish media readiness — October 31, 2026

**Status: Development-only preference installed and enabled on exact isolated Preview branch; owner-confirmed browser QA PASS; Production and Spanish media regeneration/release remain HOLD.**

## Feature separation
The account transactional-language preference in Draft PR #1022 changes future eligible access-notice email rendering only. The new media-language preference in Draft PR #1028 is a separate RLS-protected account row, set only by the authenticated user. Changing one does not change the other. No marketing consent or entitlement is inferred.

## Asset inventory
| Surface | Recorded availability | Permitted Preview behavior | Release limitations |
| --- | --- | --- | --- |
| 51 Stream films | Original English video/narration, 51/51 English captions, 51/51 exact-provider-readback Spanish non-default captions (Oct 7 QA) | If signed entitled Dev user explicitly chooses media ES, initialize existing signed player with Spanish subtitles | Never change global English default, video UID, paid access or signed-token rules |
| Spanish film voice/audio | No approved released alternate is established by current documentation. Connected live Stream read currently returns 403 | Explain narration remains English; keep EN fallback | Do not fabricate ES soundtrack or generate/replace tracks |
| Released audiobook | Protected English audiobook | Remains English | Do not replace original |
| Spanish audiobook | Separate private engineering; Track 00 byte materialization and publisher/legal approvals pending | None | No Spanish member delivery or publication |
| Spanish book | Private QA-approved Candidate 1 | None | Member delivery still HOLD |

Authoritative sources: docs/localization/SPANISH_VIDEO_FINAL_HOLD_QA.md; apps/web/src/data/localization-manifest.js; docs/localization/SPANISH_AUDIOBOOK_RELEASE_BLUEPRINT_2026-10-28.md. Cloudflare player documentation: https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/ . Its defaultTextTrack option selects captions only at player initialization; viewers retain control.

## Development implementation
- Stacked Draft PR: https://github.com/usdimpact/usd-impact-site/pull/1028 on top of upstream Draft PR #1022.
- Dev-only migration: 20261030234009_ui03_account_media_locale_preview_dev; version-controlled source under supabase/migrations, SHA-256 0457c3fd8e19d998cc1d5ee8cbfcd4a88b1cfcbd0a9fc337df757a792b6dea1f.
- Account media preference stores EN/ES with per-user RLS, no anonymous or cross-account grants, revision increment, privacy export and final-deletion purge. This is a different table from transactional-language preference.
- Separate default-OFF flags ACCOUNT_MEDIA_LOCALE_UI_ENABLED and ACCOUNT_MEDIA_LOCALE_WRITE_ENABLED must be scoped to Vercel Preview AND exact Git branch draft/media-language-es-captions-preview-20261031, with matching runtime branch guard and Development Supabase hostname.
- Protected Video Library checks paid entitlement BEFORE the preference lookup or signed media token. ES selection only when the localization manifest verifies a non-default es track for the selected film. On error/missing/unknown: EN. The global EN source default remains unchanged.
- Player preload=metadata stays. Do not download full audio/video, auto-play, or make an EN video appear dubbed simply because ES subtitles are active.

## Current QA checkpoint (2026-10-31)

- The original UI-03 exact-head runtime commit `54b4b2faddc47fc347a25506a7c18e562ae76d0f` passed all eight GitHub Actions workflows and Vercel Preview READY; the user accepted EN/ES account preference and DXY initial subtitle behavior, then independently confirmed signed-out and mobile/tablet browser PASS. See [owner browser acceptance](https://github.com/usdimpact/usd-impact-site/pull/1028#issuecomment-6536242046). Acceptance is **owner-reported** for interactive browser checks, not an automated end-to-end proof of all 51 streams.
- A read-only Development SQL check after sign-in confirmed one saved Spanish media-language preference and the separate transactional-language preference, with media RLS enabled and media preference included in the account export function. The Production media and transactional-language tables are still absent.
- This checkpoint records **Preview functional acceptance only**, not merge, future-buyer email launch, Production SQL cutover, global Spanish caption defaults, or Spanish narration availability. Draft PR #1028 depends on still-Draft upstream PR #1022, and both remain unmerged.
- Source-only [51-film inventory](https://github.com/usdimpact/usd-impact-site/issues/1029#issuecomment-6536259783) maps exact Stream UIDs and catalog runtimes to the verified Spanish subtitle manifest. A fresh read-only Cloudflare Stream metadata call was denied `403 / 10002`: Spanish alternate-audio presence and dubbing rights remain **UNKNOWN**, not absent. Do not infer media availability or spend from the account setting.

## Acceptance tests before further release
1. In Production or feature-off Preview: media selector hidden and player caption default EN. No extra database/media lookup.
2. In isolated Dev Preview: genuine signed account chooses media ES. Save survives reload and appears in account data export. New video playback preselects Spanish captions while spoken narration stays English. Media EN selection restores English caption initialization.
3. Cross-account, anonymous, expired sessions, unsupported language, browser-provided account_id and origin attacks rejected. Database RLS and pre-send access notice gate unchanged.
4. On preference-read failure, paid original English video still loads; signed-out/unpaid users never bypass protected video gating.
5. Validate mobile/tablet/desktop caption controls, privacy copy, no autoplay, no new Spanish member route, no email provider action. Run exact-head Web Quality, CodeQL, Dependency Review and Preview QA.
6. No Production migration or merge without separate approval for both upstream and stacked PRs.

## Deferred dubbed video / Spanish audio regeneration work

**Draft plan only — no audio generation, upload, budget spend, or publication authorized.**

1. Read-only enumerate existing audio tracks for all 51 exact Stream UIDs with the proper Stream Read authorization. Current connected Cloudflare tool returns HTTP 403/10002, so unknown tracks must remain UNKNOWN, not assumed absent.
2. Build a per-video map: original Stream UID, confirmed ES alternate audio or licensed localized video availability, duration, text/caption alignment, owner/rights, approved source and missing assets.
3. For missing assets: first confirm authoritative English script/version; translate and compliance-review Spanish script; secure narration/translation/voice rights and publisher approval.
4. Obtain bounded per-minute cost, exact voice profile, regeneration scope and spending cap before any model audio/video use. One short pilot first; do not bulk-regenerate 51 films.
5. Privately QA timing/sync, intelligibility, loudness, clipping, caption fit, metadata, and player accessibility on both desktop and mobile.
6. Store only approved masters privately. Route an ES audio or dubbed video only when an independently reviewed released manifest entry exists; otherwise use original EN audio. Maintain existing entitlement and short-lived signed delivery.
7. Treat the Spanish audiobook as a separate release with its own Track 00 hash/master, publisher, disclosure and private storage gates.

**Never treat an account language selection as authorization to generate, publish or sell a translation.**
