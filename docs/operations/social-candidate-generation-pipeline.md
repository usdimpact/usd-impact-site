# USD Impact Social Candidate Generation Pipeline v1

Status: implemented draft-generation layer. No social publishing capability.

## Purpose

Convert an already-governed USD Impact publication object into a structured social candidate packet without scraping prose, inventing facts, or creating a direct path to Instagram/Meta publishing.

The pipeline is downstream of the existing publishing system. It does not replace Daily USD Impact, Weekly Score, Catalyst Brief, or Report verification.

## Architecture

```text
Verified USD Impact publication
        ↓
Normalized source object
        ↓
social-candidate-generator.js
        ↓
Candidate packet
        ↓
Editorial + source + compliance + visual QA
        ↓
Approved creative production
        ↓
Captioned media asset
        ↓
Separate publishing boundary
```

The current implementation stops at the candidate packet.

## Implemented files

- `apps/web/src/lib/social-candidate-generator.js`
- `apps/web/scripts/generate-social-candidate.mjs`
- `apps/web/scripts/test-social-candidate-generator.mjs`

## Supported source types

### `daily`

Expected governed fields include:

- `title`
- `date`
- `status`
- `url`
- `summary`
- `marketRegime`
- `highlights[]`
- `sources[]`

Generated candidate outputs:

- USD Impact Today Reel brief;
- Daily carousel copy;
- Story candidates.

### `weekly`

Expected governed fields include:

- `title`
- `periodEnd`
- `status`
- `url`
- `score`
- `themes[]`
- `sourceEditions[]`

Generated outputs:

- Weekly Score Reel brief;
- score/theme carousel;
- Story candidates.

### `catalyst`

Expected governed fields include:

- `title`
- `event`
- `eventDate`
- `phase` (`preview` or `outcome`)
- `status`
- `url`
- `verifiedFacts[]`
- `transmissionChannels[]`
- `whatToWatch[]`
- `sources[]`

Generated outputs:

- Catalyst Ahead or Catalyst Result Reel brief;
- verified-fact / transmission carousel;
- Story candidates.

The generator does not infer event outcomes and does not turn conditional transmission language into a directional forecast.

### `report`

Expected normalized fields include:

- `title`
- source date;
- `status`
- `url`
- `summary`
- at least two `keyPoints[]` or `themes[]`;
- source/evidence URL.

Generated outputs:

- Deep Dive Reel brief;
- report carousel;
- Story candidates.

## State contract

### `blocked`

Returned when any required source condition fails, including:

- non-object input;
- unsupported source type;
- source not `published`;
- no governed source/evidence URL;
- missing date/title;
- missing required Daily highlights;
- missing Weekly score/themes;
- missing Catalyst facts/transmission/watch items;
- invalid Catalyst phase;
- missing Report summary/key points.

Blocked packets are not eligible for creative production.

### `draft`

A source passed structural/evidence gates and candidate copy was generated.

`draft` does **not** mean approved or publishable.

Every draft includes:

```json
{
  "qa": {
    "humanReviewRequired": true,
    "publishable": false,
    "nextState": "needs-editorial-review"
  }
}
```

No implementation in this increment can change `publishable` to `true`.

## Candidate packet contract

Each successful packet contains:

- `schemaVersion`;
- deterministic `candidateId`;
- source type/title/date/status/URL;
- collected evidence URLs;
- brand production requirements;
- compliance disclosure and prohibited output classes;
- Reel family/hook/narration/end frame;
- estimated duration;
- carousel slides;
- Story candidates;
- quiz slot;
- QA state.

## Brand contract

Generated packets require:

- `USD Impact — Production` visual system;
- 1080 × 1920 master video format;
- no presenter by default;
- captions required;
- **captioned media variant required for publication**.

The first five HeyGen pilots established an important operational distinction: Video Agent scene metadata can report captions disabled while the final HeyGen video object exposes a separate `captionedVideoUrl` and SRT. Therefore social delivery must select the captioned output variant rather than the raw render.

## Compliance contract

Every packet includes the standard disclosure:

> Educational only. Not investment advice, a recommendation, forecast, or trading signal.

The generator deliberately adds non-signal framing to Weekly Score and Catalyst content.

It does not generate:

- personalized recommendations;
- buy/sell/hold instructions;
- guaranteed outcomes;
- target prices;
- unsupported forecasts;
- automatic event-outcome claims.

## CLI

From `apps/web`:

```bash
node scripts/generate-social-candidate.mjs \
  --type daily \
  --input /path/to/normalized-source.json \
  --output /path/to/social-candidate.json
```

Supported types:

```text
daily
weekly
catalyst
report
```

If `--output` is omitted, the JSON packet is written to stdout.

A blocked candidate returns a non-zero process exit code.

## Validation

Run:

```bash
node --check src/lib/social-candidate-generator.js
node --check scripts/generate-social-candidate.mjs
node scripts/test-social-candidate-generator.mjs
```

The contract test covers:

- successful Daily generation;
- successful Weekly generation;
- successful Catalyst Result generation;
- successful Report generation;
- mandatory human review;
- captioned-variant requirement;
- fail-closed unpublished source;
- fail-closed missing evidence;
- invalid input.

## Security and action boundary

This implementation contains no:

- Instagram API client;
- Meta Graph API call;
- browser automation;
- access token;
- OAuth flow;
- posting endpoint;
- scheduling action;
- Vercel Production modification;
- database write;
- HeyGen generation call.

It is a pure content transformation layer plus local JSON CLI.

## Next integration increment

Once this generator passes repository validation:

1. add read-only adapters that convert the existing validated Daily, Weekly and Catalyst publication structures into normalized source objects;
2. create fixture/evidence packets from current publications;
3. run the candidate generator against those fixtures;
4. validate generated candidates against editorial/compliance contracts;
5. only after those outputs are stable, consider a separate creative-production handoff to HeyGen;
6. keep Instagram authentication and publication behind a later explicit authorization and provider-readiness boundary.
