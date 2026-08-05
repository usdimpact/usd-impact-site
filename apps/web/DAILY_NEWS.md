# Daily USD Impact publishing workflow

Daily USD Impact is a structured, source-backed news product. It is not a raw scraper and it does not publish AI output directly to production.

## Publication states

1. `review` — generated or imported content awaiting editorial verification.
2. `ready-for-build` — editorial review complete; production checks still pending.
3. `published` — eligible for the website, RSS, and JSON feeds.

The public routes load only `published` entries.

## Built-in source endpoint

The private Vercel Function at `/api/daily-news-source` generates one structured bundle by calling the OpenAI Responses API with web search and strict JSON output.

It applies deterministic controls after generation:

- bearer-token authentication using a timing-safe comparison
- an allowlist of authoritative primary sources and established reporting domains
- rejection of source URLs not returned by the OpenAI web-search call
- automatic source classification as `primary` or `reporting`
- `verified-primary` only when a highlight cites at least one approved primary source
- `verified-multiple` only when a highlight cites at least two independent approved reporting domains
- rejection of duplicate, malformed, unsupported, weakly sourced, or ungrounded content
- fixed compliance wording and server-generated edition metadata

The endpoint returns HTTP `502` instead of a bundle when validation fails. It never writes content to the repository and never publishes directly.

## Vercel environment variables

Configure these in the Vercel project for Production and Preview:

| Variable | Required | Purpose |
|---|---:|---|
| `OPENAI_API_KEY` | Yes | Private OpenAI project API key used server-side only |
| `NEWSFEED_BEARER_TOKEN` | Yes | Long random token required to call `/api/daily-news-source` |
| `OPENAI_NEWS_MODEL` | No | Model override; defaults to `gpt-5` |
| `OPENAI_NEWS_TIMEOUT_MS` | No | Provider timeout override; defaults to `180000` |

Do not expose these values in client-side code, Markdown content, workflow files, or public environment variables.

## GitHub Actions secrets

Configure these repository secrets:

| Secret | Value |
|---|---|
| `NEWSFEED_ENDPOINT` | `https://usd-impact.com/api/daily-news-source` |
| `NEWSFEED_BEARER_TOKEN` | Exactly the same private token stored in Vercel |

The workflow exits without changing the repository when either secret is missing.

## Automated input contract

The scheduled workflow downloads one JSON bundle from `NEWSFEED_ENDPOINT` using `NEWSFEED_BEARER_TOKEN`.

The bundle contains:

- edition metadata: `date`, `title`, `metaDescription`, `generatedAt`, `marketRegime`, and `summary`
- 3-7 structured highlights
- affected asset labels
- a server-derived verification state for every highlight
- source IDs for every claim
- at least two grounded HTTPS sources
- catalysts with source IDs, event type, importance, 1-5 impact score, and a concise transmission explanation
- a deterministic `extraBrief` eligibility flag for the small subset of high-impact catalysts
- optional long-form body

The importer always writes `status: review`. It cannot publish.

## Required repository configuration

- Secret: `NEWSFEED_ENDPOINT`
- Secret: `NEWSFEED_BEARER_TOKEN`
- Repository Actions setting: allow GitHub Actions to create pull requests
- Branch protection on `main`
- Required `validate-and-build` check before merge

## Endpoint verification

An unauthenticated request must return HTTP `401`:

```bash
curl -i https://usd-impact.com/api/daily-news-source
```

An authenticated request should return a structured JSON bundle or a controlled validation error:

```bash
curl --fail --show-error \
  -H "Authorization: Bearer $NEWSFEED_BEARER_TOKEN" \
  https://usd-impact.com/api/daily-news-source
```

For a controlled backfill or test date:

```bash
curl --fail --show-error \
  -H "Authorization: Bearer $NEWSFEED_BEARER_TOKEN" \
  "https://usd-impact.com/api/daily-news-source?date=2026-07-23"
```

## Manual import

From `apps/web`:

```bash
node scripts/import-daily-news.mjs /path/to/daily-news.json
npm run validate
npm run build
```

Use `--replace` only when deliberately updating an edition already present in a non-published review state. The importer refuses to overwrite a published edition.

## Verification policy

A published highlight must be either:

- `verified-primary`: directly supported by an authoritative first-party source
- `verified-multiple`: supported by at least two independent reliable reporting domains

Developing or single-source claims remain outside the published edition until verified. Every generated draft still requires human editorial review before its status is changed to `published`. Corrections must update `lastReviewed` and preserve the original source ledger.

## Important Catalyst Briefs

The Upcoming catalysts calendar is also the input to a separate, event-driven editorial workflow. It does not create an extra article for every calendar item.

A catalyst becomes eligible only when all of these deterministic conditions are satisfied:

- `importance` is `high`
- `impactScore` is 4 or 5
- at least two covered USD Impact assets may be affected
- the scheduled date is backed by an authoritative primary source
- the daily bundle marks `extraBrief: true`

Examples that may qualify include major central-bank decisions, CPI/PCE, payrolls, material Treasury-liquidity events, OPEC-level supply decisions, and exceptionally material index-heavy corporate events. Routine weekly releases should remain medium or low importance.

The `Important Catalyst Brief publication` workflow checks twice each day:

- `06:45 UTC` — look up to two calendar days ahead and prepare one pre-event brief
- `22:45 UTC` — re-check events from today or yesterday and prepare one verified-outcome brief

Each check performs this sequence:

1. Fetch `/news/latest.json` from Production.
2. Select the highest-scored eligible catalyst that does not already have the requested phase.
3. Call the private `/api/catalyst-brief-source` endpoint with the bounded event metadata.
4. Re-fetch authoritative sources with OpenAI web search.
5. Require at least one primary source, at least two grounded URLs, and claim-level primary or independent multi-source verification.
6. Hold the brief without writing content when the official schedule or outcome cannot be verified.
7. Import an eligible brief, run the complete validation and production build, and open a publication pull request.
8. Dispatch Web quality against the exact publication commit and stop for protected human review. The workflow never merges its own pull request.

Pre-event briefs explain the verified timing, evidence, transmission channels, and monitoring checklist. Outcome briefs are created only after the result can be verified; they separate confirmed facts from conditional cross-asset interpretation.

The workflow has one bounded research retry, duplicate-file protection, duplicate-pull-request reuse, and an automation-health issue that opens on failure and closes after recovery. Catalyst Briefs appear on the news hub, the combined RSS feed, and the latest JSON metadata after a reviewed pull request is merged.

Manual selection test from `apps/web`:

```bash
curl --fail --show-error https://www.usd-impact.com/news/latest.json -o /tmp/latest-news.json
node scripts/select-important-catalyst.mjs /tmp/latest-news.json --phase=preview --as-of=2026-08-05
```

The endpoint uses the existing `OPENAI_API_KEY`, `OPENAI_NEWS_MODEL`, `OPENAI_NEWS_TIMEOUT_MS`, and `NEWSFEED_BEARER_TOKEN` settings. No additional Production secret is required.
