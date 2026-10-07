# Spanish Video Localization — Final HOLD QA

Status: **51 / 51 PROVIDER + POST-UPLOAD QA PASS / PUBLICATION HOLD**  
Current checkpoint: 2026-10-07  
Site-player default: **English (`en`)**

## Current verified state

The pre-upload HOLD work and the controlled provider rollout are both complete.

- Exact live Cloudflare Stream English source authority: **51 / 51**
- Spanish translation + text/timing QA: **51 / 51**
- Final terminology/compliance scan: **PASS**
- Spanish non-default Cloudflare Stream `es` tracks: **51 / 51 ready**
- Exact live provider readback against approved HOLD VTT bytes: **51 / 51 PASS**
- Representative post-upload frame/caption clearance: **72 / 72 timestamps PASS**
- Desktop + narrow rendered clearance checks: **144 / 144 PASS**
- Direct signed-player desktop/mobile-width pilot QA: **2 / 2 films PASS**
- English source track preserved: **YES**
- Application default text track remains `en`: **YES**
- Public Spanish publication: **HOLD**

The controlled caption rollout was completed under the approval recorded in PR #760. The earlier wording in this file that described provider upload as a future gate is therefore superseded by this current checkpoint.

## Structural result

All 51 approved Spanish VTTs pass:

- valid WebVTT;
- no overlaps;
- maximum two lines;
- maximum 42 characters per line;
- maximum 20 CPS;
- timing within the authoritative live source span.

Final observed maximum: **19.9 CPS** and **42 characters per line**.

## Provider rollout result

All 51 current Video Library Stream assets expose a non-default Spanish `es` caption track whose live VTT readback matches the approved HOLD bytes for that exact production Stream UID.

The rollout preserved:

- the existing English track;
- the English application default;
- existing Stream UIDs;
- signed-player behavior;
- commerce, entitlement, auth and passkey behavior.

Temporary rollout execution code and branch-only execution variables were removed or disabled after verification.

## Post-upload visual clearance

Post-upload visual clearance used the live production Cloudflare frame at each QA timestamp together with the live provider Spanish `es` VTT cue for the same Stream UID and time.

Coverage:

- Core Dollar Framework: **3 / 3**
- Asset Transmission: **6 / 6**
- Rates, Liquidity & Policy: **13 / 13**
- Global Dollar & FX Mechanics: **22 / 22**
- Dollar Funding Stack: **28 / 28 representative samples**

Total:

- representative timestamps: **72 / 72 PASS**
- desktop+narrow rendered checks: **144 / 144 PASS**
- Spanish-specific clipping/truncation blockers: **0**
- Spanish-specific material-obstruction blockers: **0**

The two-film controlled pilot additionally retains actual signed-player desktop/mobile-width visual evidence.

## Method boundary

The full-library automated browser stack could not reliably decode signed Cloudflare video playback. The 51-film post-upload clearance therefore used live provider frames plus live provider Spanish caption bytes at matched timestamps.

This supports caption/frame clearance. It is not a claim that an automated browser decoded end-to-end playback for all 51 films.

## Terminology/compliance normalization

The final scan found no investment recommendation or unqualified predictive claim requiring remediation.

Controlled consistency includes:

- `prima por plazo`;
- Spanish rate terminology instead of English `yields` shorthand;
- `mercado monetario`;
- `gas de entrada`;
- `papel comercial`.

The full validator passed again after normalization.

## Current release boundary

This completed provider/QA state does **not** authorize:

- changing the site-player default from English to Spanish;
- public `/es/` routes;
- Spanish sitemap or hreflang publication;
- Spanish marketing-email activation;
- Spanish book or audiobook member delivery;
- entitlement changes;
- commerce changes;
- auth or passkey changes;
- database changes;
- Production localization activation.

Spanish captions may remain present as the already-verified **non-default** provider track while publication remains on HOLD.

## Remaining release gate

The remaining gate for any public Spanish release surface is an **explicit owner release authorization naming that surface**.

Examples of distinct release surfaces that require their own authorization include:

1. Spanish book/member delivery;
2. public Spanish website routes;
3. sitemap/hreflang indexing;
4. Spanish caption-default behavior;
5. Spanish audiobook delivery;
6. Spanish marketing email.

This QA record alone authorizes none of them.
