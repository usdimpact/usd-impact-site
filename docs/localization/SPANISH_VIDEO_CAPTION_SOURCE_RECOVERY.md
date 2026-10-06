# Spanish video caption source-recovery runbook

Status: **HOLD / unpublished**  
Production impact: **NONE**  
English runtime impact: **NONE**

## Purpose

Recover the authoritative English caption track for each live Cloudflare Stream video before creating or approving a Spanish caption file.

Do not translate from a title match, duration match, older source render, or reconstructed transcript when the live English Stream caption can be recovered.

## Authority order

1. Live Cloudflare Stream English WebVTT for the exact Stream UID.
2. Exact production master whose duration and content are verified against the live Stream item.
3. Approved internal source script only when it is proven to match the live media.
4. Anything else remains `SOURCE_HOLD`.

## Read-only Cloudflare path

The branch-scoped Preview recovery path has successfully verified all 51 live tracks using the existing server-side Cloudflare credentials without exposing them.

The underlying official read endpoint is:

`GET /accounts/{account_id}/stream/{identifier}/captions/{language}/vtt`

Required permission: Stream Read or Stream Write.

For source recovery, use **read-only** access. Do not use caption upload, generate, or delete endpoints.

The Stream UID map is already server-side in:
`apps/web/src/lib/video-stream-map.js`

## Prohibited during source recovery

- no `PUT` caption upload;
- no caption generation;
- no caption deletion;
- no default text-track change;
- no change to `requireSignedURLs`;
- no public `/es/` route;
- no merge to `main`;
- no Production deployment;
- no member-facing Spanish caption availability.

## Live source recovery status

Source recovery is complete for the current 51-film Video Library.

- 51/51 exact production Stream UIDs returned a live English WebVTT.
- Part 1 and Part 2 are no longer source-blocked.
- All short explainers have exact live English caption authority.
- No title/duration approximation is required for localization.

See `docs/localization/SPANISH_VIDEO_LIVE_SOURCE_INVENTORY.md` for the verified cue inventory.

## Superseded pilot status

The earlier private Spanish HOLD pilots for DXY and masterclass Parts 3–7 were generated before live Stream English-caption readback was available.

A control comparison proved that the live DXY English VTT differs materially from the earlier production-master transcript/timing. Therefore the earlier pilot batch is historical workflow evidence only and is not a release candidate.

All Spanish caption work from this point forward must be rebuilt or reconciled against the live Stream English VTT.

## Local validation

Use:

`node scripts/validate-localization-vtt.mjs <private-file.vtt> <durationSeconds>`

The validator fails closed on:

- invalid WebVTT timestamps;
- overlapping cues;
- empty cues;
- more than two visual subtitle lines;
- cue end after the declared media duration.

The validator intentionally does not ingest or commit private caption assets.

## Diagnostic cleanup

The temporary Preview-only Cloudflare caption-readback handler used during source recovery has been removed after all 51 live English tracks were verified. No readback route is intended to ship or remain available for Production.

## Release rule

A Spanish caption may advance from `HOLD` only after:

1. exact English source authority is identified;
2. cue-by-cue translation is complete;
3. terminology and conditional-language QA pass;
4. WebVTT validation passes;
5. visual clearance QA passes;
6. explicit owner release approval is recorded.

This runbook does not authorize publication.
