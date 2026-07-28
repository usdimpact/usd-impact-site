# Learning telemetry — Phase 2

## Scope

Phase 2 keeps the existing privacy-safe event allowlist and adds durable aggregate counters in the Vercel-connected Upstash Redis resource.

Persisted counters include:

- total events and counts by event name;
- checklist downloads;
- quiz starts, completions, pass/fail outcomes, retries, score sums, and question-count sums;
- daily counters; and
- explicit `utm_source`, `utm_medium`, and `utm_campaign` values.

No raw event body, IP address, user-agent string, cookie, email address, quiz answer choice, referrer, account identifier, or persistent session identifier is stored in Redis.

## Storage and retention

- Provider: Upstash Redis through the Vercel Marketplace.
- Environments: Preview and Production.
- Daily aggregate retention: 730 days.
- Cumulative counters: retained until deletion or resource retirement.
- Duplicate event IDs: retained for 24 hours only.
- Raw event retention in Redis: none.

Vercel runtime logs continue to receive a normalized operational record. Log retention follows the active Vercel plan and project settings.

## Reliability behavior

`POST /api/telemetry` remains non-blocking:

- valid events return HTTP 202;
- Redis writes use a short timeout;
- duplicate suppression and counter increments execute atomically;
- storage failure falls back to an operational log record and still returns HTTP 202;
- downloads, quiz scoring, retries, and navigation continue during a telemetry outage; and
- malformed events still return HTTP 400.

A Redis-backed per-minute event cap provides basic global rate limiting. Rate-limited telemetry is discarded without disrupting the learning flow.

## Reporting

`GET /api/telemetry-report` returns cumulative and daily aggregate counters.

Authentication uses a bearer token. The endpoint reads `TELEMETRY_REPORT_TOKEN` when configured and otherwise uses the existing `NEWSFEED_BEARER_TOKEN`.

Example request:

```bash
curl --get "https://www.usd-impact.com/api/telemetry-report" \
  --header "Authorization: Bearer $TELEMETRY_REPORT_TOKEN" \
  --data-urlencode "days=7" \
  --data-urlencode "end=2026-07-28"
```

Constraints:

- `days`: integer from 1 to 31; default 7.
- `end`: valid UTC date in `YYYY-MM-DD`; default current UTC date.
- responses use `Cache-Control: no-store`.
- the read-only Upstash token is used for reports.

## Counter naming

Examples:

```text
events:total
events:checklist_download
checklist:downloads
quiz:quiz-start-here:starts
quiz:quiz-start-here:completions
quiz:quiz-start-here:pass
quiz:quiz-start-here:fail
quiz:quiz-start-here:retries
quiz:quiz-start-here:score_sum
utm_source:newsletter
utm_campaign:july_launch
```

Average quiz score is calculated as `score_sum / completions`.

## Access and deletion

- Access is limited to Vercel project administrators with the report bearer token.
- Do not expose the report endpoint token in browser code or public documentation.
- To delete telemetry, remove keys beginning with `usd-impact:telemetry:v1:` from the connected Upstash resource.
- During an incident, disable the Upstash resource connection or rotate its tokens; the public learning flow will continue using non-blocking degraded behavior.

## Validation

Run from `apps/web`:

```bash
npm run validate:functions
npm run validate
npm run build
```

Preview validation must confirm:

1. a valid event returns HTTP 202;
2. repeating the same event ID returns `duplicate: true`;
3. the protected report endpoint rejects missing or invalid authorization;
4. an authorized report request returns daily and cumulative counters; and
5. simulated storage failure does not block checklist or quiz flows.

#usd-impact-backlog
