# Calendar 558: multi-series coverage and final-release requirements

Status: **draft, unmerged, not activated in Production**. This document supersedes
CPI-only scope statements in the earlier foundation/integration checkpoints, but
does not claim that every event or the final Production transition is protected.

## Supported draft adapters

The fixed BLS registry now contains three national **initial monthly** releases:

| Canonical series | Exact editorial identity | Official schedule | Official results |
| --- | --- | --- | --- |
| CPI | BLS Consumer Price Index (CPI) for Month YYYY | https://www.bls.gov/schedule/news_release/cpi.htm | https://www.bls.gov/news.release/cpi.nr0.htm |
| PPI | BLS Producer Price Index (PPI) for Month YYYY | https://www.bls.gov/schedule/news_release/ppi.htm | https://www.bls.gov/news.release/ppi.nr0.htm |
| EMPSIT | BLS Employment Situation for Month YYYY | https://www.bls.gov/schedule/news_release/empsit.htm | https://www.bls.gov/news.release/empsit.nr0.htm |

The abbreviations in parentheses are optional for CPI and PPI. The explicit
reference month/year, issuer, exact series, initial stage, date, local clock,
IANA timezone and matching UTC instant remain required. Each series is compared
with the official monthly release-list calendar. Outcomes additionally require
a distinct, matching official results heading, embargo timestamp and results
statement; passing scheduled time is not results evidence.

The shared parser retains the existing strict nested-table ownership, headers,
unique-row and shape checks. Release identifiers such as USDL-26-1234 or
USDL 26-1234 are permitted only in the observed fixed embargo-prefix position.
Arbitrary intervening text, mixed series and ambiguous multiple artifacts hold.
The historical module filename `bls-cpi-calendar.js` and CPI-named helper exports
remain compatibility entrypoints; the registry and generic loader define actual
supported coverage. The CPI-only loader still rejects another series.

All direct reads retain fixed HTTPS endpoints, an identifying owner-contact
User-Agent, redirect rejection, timeout/size/UTF-8 bounds, cache-age checks and
sanitized diagnostics. Four explicit PPI/Employment endpoints were added to the
allowlist. No arbitrary source URL, proxy, retry-after-denial or credential was
introduced. Adapter version is `bls-national-monthly/html-v3`.

Daily calendars are for upcoming events. Released outcomes belong in sourced
highlights. They cannot be relabelled as preview-calendar entries to pass import.
Catalyst Briefs support separately verified preview and outcome phases. A Daily
with a CPI row cannot use it to certify forward-looking PPI/Employment copy that
has no matching row. Unsupported rows remain visible HOLDs, not removed rows.
Prose validation remains a conservative grammar check, not universal fact checking.

## Diagnostic coverage inventory

From `apps/web`:

```sh
node scripts/audit-publication-calendar-coverage.mjs 2026-09-09 12
```

This reads the twelve most recent published date-named Daily source files at or
before the diagnostic date. It reports file hashes, occurrences, bounded family
hints, exact-label recognition and canonical-record shape errors. Ambiguous,
unreadable or symlink source files are explicit incomplete-audit results. A
family hint is never a verified event identity. The audit does not fetch official
sources and never authorizes publication; a historical date is diagnostic only.

The inspected September 9 snapshot contained 33 occurrences across 12 editions:
CPI 2, PPI 2, Employment 6, Treasury 8, EIA 5, Federal Reserve 5, BEA 3, other BLS 2.
All inspected archive rows predate the new canonical-field rollout. Their missing
records are not retroactively modified, and this inventory is not a present-day
release decision. An unchanged previously published archive remains an archive.

Remaining issuer families require their own reviewed adapters: Treasury auctions
versus settlement versus buyback operation/effective dates; EIA petroleum and gas
with holiday exceptions; BEA PCE/GDP with reference-period and estimate-stage
identity; Federal Reserve decisions, minutes and speeches as distinct events;
other BLS monthly/quarterly releases. The future model prompt must not erase
unsupported required events merely to obtain a passing edition.

## Release-preflight hardening

The GET-only staged-Production preflight now requests authoritative Git repository
information and requires GitHub source type, exact repository ID and matching
commit SHA, rather than treating editable deployment metadata alone as sufficient.
Provider payload compatibility must be verified live; missing fields hold. This
is not a claim that the reduced connected deployment response proves that contract.

The publication inventory rejects unsupported file types (including MDX/JSON),
symlink roots, malformed paths and nonempty placeholders instead of silently
omitting them. Known empty `.gitkeep` blobs are ignored. Any changed source file
that was already published in the actual deployed baseline requires a separate
reviewed archive-correction path. Changing its status to review/draft does not
exempt the mutation. A genuine review-to-published transition still needs fresh
calendar validation. Unchanged archives incur no new live-source dependency.

The result remains `PASS_READ_ONLY_PREFLIGHT`, never release authorization. No
mandatory provider promotion gate has been activated by this source patch.

## Final publication architecture: required before activation

The following are release requirements, **not verified configuration**:

1. Stage Production builds without automatically assigning public domains. Keep
   the current Production deployment serving while the new one is evaluated.
2. Route normal publication through one protected controller with exact owner
   approval, repository/main/head/deployment/artifact binding, fresh official
   evidence and actual canonical deployed-baseline verification. Limit ordinary
   actors' direct alias, Force Promote, prebuilt and rollback paths. Every allowed
   alternative must perform equivalent verification; older unguarded deployments
   must not be treated as an exempt rollback route.
3. Enforce the expiry at the point content becomes publicly retrievable, not only
   when the promotion request starts. Use either a provider-supported atomic
   deadline condition proven by its live contract or a fail-closed serving gate
   tied to an immutable, trusted publication record. A client timeout or arbitrary
   safety margin does not prove a queued remote alias operation was cancelled.
4. Cover all content-bearing surfaces and public hostnames, including article,
   listing, feed, latest JSON and relevant generated metadata. A guard only on an
   article URL cannot protect stale content embedded in a feed or listing.
5. Persist evidence of actual successful publication before expiry so legitimate
   archives remain available later without turning an unpublished/backdated
   preview into an archive. Preserve separately governed corrections and recovery.

The documented Vercel behavior makes steps 2-3 material:

- Deployment Checks can be bypassed with Force Promote:
  https://vercel.com/docs/deployment-checks
- A staged Production promotion and an instant rollback need not rebuild, while
  promotion of a Preview deployment triggers a new Production build:
  https://vercel.com/docs/deployments/promoting-a-deployment
  https://vercel.com/docs/deployments/promote-preview-to-production
- The documented promotion endpoint does not establish an atomic calendar
  deadline/CAS contract in the inspected reference:
  https://vercel.com/docs/rest-api/projects/point-production-traffic-to-a-given-deployment

Consequently, simply wiring the current read-only preflight into a successful
GitHub check, or adding a build-time check, does **not** complete this gate. A new
unused controller or unverified `enabled: true` flag would not complete it either.

Activation needs a separately scoped approval for the actual provider settings,
controller/serving boundary, any necessary least-privilege credentials and test
environment. No such settings or credentials are changed here. Before requesting
that approval, inspect available live control capabilities and produce an exact
change list; do not infer current settings from platform defaults or green CI.

## Acceptance evidence still required

- Genuine raw-HTML multi-series probes at the new adapter revision, distinct from
  synthetic tests and dated captured fixtures.
- Live complete deployment/Git-source/alias/artifact contract, with exact-head
  Preview and separate baseline-health evidence.
- Supported operational-calendar coverage or a separately governed verified
  editorial path, with no silent event omission.
- Demonstration that an open PR, staged deployment, queued promotion, alternate
  alias and allowed rollback cannot first expose an expired preview; test clock
  crossing during the external operation, not only before it.
- The same tests must preserve an unchanged legitimate archive. Source/permission
  tampering, missing evidence, retries and conflicting concurrent releases fail
  closed.

Keep issue #558 open and PR #559 draft. No release approval follows from this
checkpoint, test count, source probe or successful Preview build.
