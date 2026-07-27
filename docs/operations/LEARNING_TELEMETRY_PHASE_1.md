# Learning telemetry — Phase 1

## Scope

Phase 1 adds privacy-safe, non-blocking first-party events for:

- Weekly Dollar Regime Checklist downloads;
- quiz starts;
- quiz completions with pass/fail and aggregate score; and
- quiz retries.

Events are written as structured JSON to Vercel runtime logs by `POST /api/telemetry`.

## Deliberately excluded

The application event record does not include:

- raw IP addresses;
- user-agent strings;
- cookies;
- referrers;
- email addresses;
- account or device identifiers;
- quiz answer selections; or
- correct-answer values.

Only explicitly provided `utm_source`, `utm_medium`, and `utm_campaign` values are accepted as campaign metadata.

## Reliability behavior

- Client requests use `keepalive: true`.
- Client failures are ignored so telemetry never blocks downloads, quiz scoring, retries, or navigation.
- Event IDs are suppressed for 10 seconds within the same warm function instance.
- The endpoint returns HTTP 202 for accepted and duplicate events.
- Invalid events return HTTP 400.
- Methods other than POST return HTTP 405.

## Current reporting

Phase 1 is operational telemetry, not durable analytics. Use Vercel runtime-log search for:

```text
usd-impact-learning-telemetry
```

Filter or group by `eventName`, `quizId`, `outcome`, or route after exporting structured log records.

## Manual decision required for Phase 2

Before durable counters are enabled, approve:

1. storage provider;
2. retention period;
3. production and staff access roles;
4. deletion and incident-response procedures; and
5. whether anonymous session-level deduplication is allowed.

Candidate storage options include a managed Postgres database, a managed key-value store, or an approved analytics provider. Phase 1 does not provision or select one.

## Phase 2 acceptance criteria

- durable daily and cumulative counters;
- duplicate suppression across function instances;
- reporting by event, quiz, outcome, date, and explicit campaign values;
- documented retention and deletion policy;
- telemetry outage does not affect learning flows; and
- no unnecessary personal data is stored.

#usd-impact-backlog
