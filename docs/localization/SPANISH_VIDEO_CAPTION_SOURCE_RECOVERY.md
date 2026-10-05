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

Use the official read endpoint:

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

## Batch 01 status

Validated Spanish HOLD captions exist privately for:

- DXY: The Signal vs the System
- Part 3: Repo, Collateral and Haircuts
- Part 4: Dealers and Balance-Sheet Intermediation
- Part 5: Funding Stress and Market Transmission
- Part 6: Global Dollar Funding and FX Swaps
- Part 7: Dollar Liquidity Backstops and Policy Facilities

These assets are not stored in the public repository.

## Still blocked

### Masterclass

- Part 1: Foundations — exact live caption/source recovery required.
- Part 2: The FX Swap Engine — exact live caption/source recovery required.

Historical HeyGen renders are close but not exact enough to treat as live authority.

### Short explainers

The remaining short explainers stay `SOURCE_HOLD` until their exact live English caption tracks are retrieved or an exact production-master match is proven.

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

## Release rule

A Spanish caption may advance from `HOLD` only after:

1. exact English source authority is identified;
2. cue-by-cue translation is complete;
3. terminology and conditional-language QA pass;
4. WebVTT validation passes;
5. visual clearance QA passes;
6. explicit owner release approval is recorded.

This runbook does not authorize publication.
