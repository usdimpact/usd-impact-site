# Daily USD Impact publishing workflow

Daily USD Impact is a structured, source-backed news product. It is not a raw scraper and it does not publish AI output directly to production.

## Publication states

1. `review` — generated or imported content awaiting editorial verification.
2. `ready-for-build` — editorial review complete; production checks still pending.
3. `published` — eligible for the website, RSS, and JSON feeds.

The public routes load only `published` entries.

## Automated input contract

The scheduled workflow downloads one JSON bundle from the endpoint stored in the `NEWSFEED_ENDPOINT` repository secret. An optional bearer token can be stored in `NEWSFEED_BEARER_TOKEN`.

The bundle must contain:

- edition metadata: `date`, `title`, `metaDescription`, `generatedAt`, `marketRegime`, and `summary`
- 3-7 structured highlights
- affected asset labels
- verification state for every highlight
- source IDs for every claim
- at least two HTTPS sources
- catalysts with source IDs
- optional long-form body

The importer always writes `status: review`. It cannot publish.

## Required repository configuration

- Secret: `NEWSFEED_ENDPOINT`
- Optional secret: `NEWSFEED_BEARER_TOKEN`
- Repository Actions setting: allow GitHub Actions to create pull requests
- Branch protection on `main`
- Required `Web quality` check before merge

Without `NEWSFEED_ENDPOINT`, the scheduled job exits without changing the repository.

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
- `verified-multiple`: supported by at least two independent reliable sources

Developing or single-source claims should remain outside the published edition until verified. Corrections must update `lastReviewed` and preserve the original source ledger.
