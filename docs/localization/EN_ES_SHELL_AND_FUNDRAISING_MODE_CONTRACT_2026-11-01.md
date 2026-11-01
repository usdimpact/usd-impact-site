# UI-39 — one EN/ES experience for Membership and Fundraising (Draft)

**Status:** UI shell + anonymous preference foundation prepared in an isolated Draft PR. No Production release, no new audio files, no Supabase change, no free-content authorization.

**Owner intent (2026-11-01):** The Spanish experience should be visually and structurally equivalent to English; the chosen language works before sign-in and after account sign-in. Where an approved Spanish caption/audio track exists, the active player should initially select it without unnecessary data usage. The planned Fundraising website skin must reuse the same presentation system and have a free-learning experience. The existing Library Pass and Research Membership contracts must survive any mode change.

## Separation of concerns — never merge these into one switch

| Dimension | Choices | What it controls | Explicitly does not control |
|---|---|---|---|
| Site language | EN / ES | Header, nav, visible approved translated content, page routes, selected language | Permission to read private books/audio/video, newsletter opt-in, new source rights |
| Media language | EN / ES | Preferred captions and **already approved released** audio, per exact asset | Automatic translation/dubbing, switching Stream UIDs without approval, purchase entitlement |
| Transactional email language | Existing dedicated account setting (Draft upstream #1022) | Eligible notices only, after its own security release | Marketing consent, audio language |
| Site mode | Membership (LIVE) / Fundraising (planned, OFF) | Offer copy, public/free allowlisted assets, designated frontend | Translation status, existing purchases, Research entitlements, protected API/auth/webhooks/cron |

## 1. Parity contract — what is already implemented in the new Draft

- Shared `BaseLayout.astro` is the same responsive Astro layout, logo, header and footer in both locales; Spanish navigation now renders the **same three grouped navigation levels** as English: `Aprender`, `Actualizaciones`, `Biblioteca`, followed by `Cuenta`.
- Exactly matched group link counts and existing English routes are used for any unavailable translated route. The English fallbacks explicitly display **`· EN`**, `hreflang=en` and an accessible title. **No nonexistent ES route is generated.**
- The Spanish public content footprint still comprises five previously approved pages only, with their existing reciprocal `hreflang`/canonical contract. Remaining page translations, protected book, member account and Spanish player UI remain separate release work.
- A first-party functional preference `usd-impact-site-language` in browser `localStorage` is written **only when the visitor explicitly clicks the language switch**; no tracking, marketing or entitlement state. Storage can be unavailable without disabling direct navigation.
- On subsequently opening one of the existing approved EN/ES page pairs, a previously explicitly chosen language sends the visitor to its verified counterpart. Other English-only pages stay English; the switch can take the user to the Spanish homepage. The anonymous choice never requests a private /es route or auto-enrolls an account.
- No database preference is read or written by this standalone public-shell Draft. The account media preference remains exclusively in Draft #1028.

**Limit:** This PR does *not* claim that every English page has Spanish translated content. Complete page parity requires each individual content/rights/editorial approval and URL. Likewise, actual paid media pages have separately rendered headers and are not changed here.

## 2. Unified preference behavior after existing account Draft is cleared

1. On first anonymous visit with no prior choice: show requested URL and an EN/ES selector; browser language is advisory only. English remains the safe default for missing translated routes.
2. On explicit anonymous selection: remember locale on that device, render a real translated counterpart when published, else display the truthful English fallback with the user's choice retained.
3. On authenticated visit after #1028 is cleared for Production: obtain the **user's own validated media-language preference server-side** via the existing RLS-safe API, after Auth/entitlement checks. A newly explicit in-session selection can update that account preference only through the separately authorized endpoint; do not silently change account state from anonymous local storage.
4. Keep transactional email language separate; it is not a reason to alter media, account export or old consent records.
5. If local/account values differ, show a visible non-blocking account-choice confirmation before changing the account. Do not conflate locale with a claim of country, address or identity.
6. Test signed-in/signed-out transitions, session expiry, invalid locale, private browsing, local storage blocked, stale Account preference, and browser/mobile parity.

**Blocked upstream:** [Media-language Draft #1028](https://github.com/usdimpact/usd-impact-site/pull/1028) is stacked on [#1022](https://github.com/usdimpact/usd-impact-site/pull/1022); Production-safe Dev-migration intake [#1042](https://github.com/usdimpact/usd-impact-site/pull/1042) and negative RLS/privacy tests are not cleared. This document introduces **no new schema, migration or Production feature flag**.

## 3. Subtitles and audio: what “preload Spanish” must mean

**Separate selection from network prefetch.** The goal is zero additional click for the chosen language, not bulk media downloads or autoplay:

| Content state | ES selection | First media network action | Visible status |
|---|---|---|---|
| One of 51 released Stream films with verified ES VTT | initialize player with `defaultTextTrack=es` **only after permitted signed token** | Provider-managed VTT and video metadata on the one selected film | `Subtítulos: Español; audio: Inglés` |
| Approved ES-dubbed version of a film (future, per-video signed released manifest) | ES caption AND ES spoken audio may be selected | One authorized film only; no 51-film preload | `Audio y subtítulos: Español` |
| Film without approved ES spoken audio (currently 51/51) | ES captions, **original EN narration** | Metadata only; no dubbing job, no fabricated track | Clearly label EN audio |
| English audiobook released, Spanish audiobook still private/HOLD | preserve EN master in Membership; do not expose Spanish assets | Entitled current chapter only, metadata preload | Spanish master `No disponible aún` / truthful EN-only access |
| Spanish 20-track audiobook after Gate A+B/C/D/E release | permitted Spanish locale route, 20-track manifest and separate progress key | Current entitled selected ES chapter only; no bulk signed URL/cache | Spanish player controls and clear AI-assisted narration disclosure |
| Anonymous free Fundraising film (future, only rights/cost released) | ES captions if verified, approved ES soundtrack if released | One authorized public-learning asset using separately approved signed media policy | Free route without account wall; no private member token |

Only the **selected active chapter/film** should request media metadata. Any future full-audio `preload=auto` must follow Master [UI-33 Draft #1027](https://github.com/usdimpact/usd-impact-site/pull/1027): explicit unmetered connection and `saveData=false`, never speculative next-track or library-wide prefetch. This is a browser hint; no auto-play. Never cache or log short-lived signed media URLs.

**Verified physical availability:** All 51 released films have ES subtitles. The original-account Stream inventory recorded **0 additional Spanish audio tracks** on all 51, and the Spanish audiobook is still private. Selecting ES may not automatically create audio, invoke HeyGen or consume ElevenLabs credits. Full Spanish voice parity requires a separate production and rights process under [Issue #1029](https://github.com/usdimpact/usd-impact-site/issues/1029).

## 4. Fundraising skin and the 2026-11-01 “all free” direction

The separate [Fundraising Tracker](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit) currently records strategic Decision DEC-013: **English book and approved educational films free, standalone 20-track English audiobook paid ($4.99 proposed), Research paid**. The owner's latest request says **“Fundraising website skin, all free.”** Do not silently preserve the old audiovisual paid CTA as if no change was requested; however, this phrase does not by itself establish rights, approve public MP3 redistribution or settle whether existing Research Membership also becomes free.

**Safe treatment:** Design a future `fundraising_free_core` skin with no account wall for **individually rights-cleared** public educational text, guides and films; the identical EN/ES shell and browser locale selector can be reused. Put **audiobook public pricing/access** in a new owner decision: whether “all free” includes the **complete 20-track English and Spanish audiobooks** or excludes them. The current $4.99 symbolic-price path stays unactivated; the paid Research and old Library Pass entitlements stay operational until an independent specifically approved change, and old purchases must never be revoked. No supporter/donation/tax claims or checkout behavior follow from this UI contract.

- Fundraising **owns** its independent repo/frontend, mode skin, first 12-video costs/rights pilot, eventual approved free asset allowlist and owner-only switch ([F01–F10 and S01–S11](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit)). 
- Master **owns** current Membership source/auth/commerce, UI-25 Spanish book/audio release, UI-33 preload, UI-34 media account, UI-39 anonymous shell, UI-27 shared DNS/routing and UI-37 existing checkout/API. Never merge different mode permissions into a client-side `free` boolean.
- No new frontend, DNS rewrite, Provider billing, Supabase DB, public storage bucket, payment change, free MP3, signed URL leak, public dubbing or mode activation occurs in this Draft PR.

## 5. Release and QA checklist

- [ ] EN and ES public menu visual parity at 375px, 768px and desktop; same logo, group pattern, focus behavior, keyboard Escape and accessible `lang` hints.
- [ ] Same numbered three nav groups and same count of destinations; visible `· EN` on untranslated links; five approved `/es` routes unchanged, unknown `/es` paths 404.
- [ ] Public anonymous EN→ES→EN selection and reload; return to an authorized paired route; localStorage denied; navigation on English-only routes remains truthful.
- [ ] Canonical/hreflang and sitemap unaffected; no auto-indexing or duplicate public origins.
- [ ] Existing valid Library Pass buyer still needs signed entitlement and can play EN; anonymous user cannot request original private MP3/Video tokens; free skin does not hijack `/api`, `/account`, `/auth`, `/research`, webhooks or cron.
- [ ] After #1028 Production release gate: authenticated ES preference persists, own-account RLS, privacy export/deletion, two-user negative tests, no transactional email or marketing scope change; 51 provider subtitles and fallback correct.
- [ ] Spanish media asset availability is read from a **release-authorized server manifest**; never treat a user-supplied locale, browser state or unverified catalog as a grant.
- [ ] English narrator remains for 51 films until separately released ES audio; no silent audio playback/redirect.
- [ ] Active media prefetch only; no signed-token logging; measured bandwidth/egress and Save-Data behavior on real browsers.
- [ ] Fundraising split-repo, public route allowlist, pricing semantics, contracts, actual Cloudflare delivered-minutes budget, privacy and owner-only rollback tested before any free public launch.
- [ ] Exact-head Web Quality, Dependency Review, CodeQL, protected Preview and **explicit separate release acceptance** before merging or making a public change.

## Evidence / owners

- [UI-39 issue](https://github.com/usdimpact/usd-impact-site/issues/1046) — public shell, anonymous preference.
- [UI-34 Draft #1028](https://github.com/usdimpact/usd-impact-site/pull/1028) — account language + existing ES caption selection, protected Preview.
- [UI-33 Draft #1027](https://github.com/usdimpact/usd-impact-site/pull/1027) — selected member media preload/bandwidth.
- [UI-25 Draft #1045](https://github.com/usdimpact/usd-impact-site/pull/1045) — Spanish audiobook Track 00 source, pending publisher gates.
- [UI-35 Issue #1029](https://github.com/usdimpact/usd-impact-site/issues/1029) — Spanish spoken video audio, 0 approved.
- [Master Tracker](https://docs.google.com/spreadsheets/d/1uDvVlmbqPONI6a7YWrbhQlwGt9QSn4qBtnYSx87NlcA/edit) and [Fundraising Tracker](https://docs.google.com/spreadsheets/d/1CQBMA-7hqN9qsy2Xt9yBGjlo08EuLluG2DEDnKVItKk/edit) own different delivery and commercial decisions.
