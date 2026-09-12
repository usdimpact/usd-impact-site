# Recorded-publication serving policy - issue 558

## Status and exact scope

This is a dormant, read-only policy core, not an installed serving gate. It is
added to draft PR 559 from head e3c01c38d67aa62fd5021d0763f7bf16a95c19c5 and
main 058d4d893ab12ce7ddd51ad43154d02b8536ca59. No merge is requested.

This increment adds `src/lib/publication-serving-policy.js`, its regression
script, this document, and one offline-test import in
`scripts/validate-publishing.mjs`. It does not change middleware, route handlers,
templates, Vercel configuration, workflows, dependencies, storage, or credentials.

The initial-admission writer deliberately does not exist. A new item with no
recorded admission is always held, even before its release time. A generation,
import, PR check, preflight, staged deployment, or private Preview visit cannot
mint archive eligibility through this module. All outputs explicitly retain
`publicationAuthorized=false` and `enforcementActive=false`.

## Interface and trust boundary

`createPublicationServingPolicy({ loadAuthority, readHistory, now })` accepts
server-only adapters. None is implemented or selected by this increment. Missing
adapters fail closed. `inspect(sources)` accepts only a bounded array of exact
Markdown source strings. It never accepts request headers, public-origin claims,
authorization flags, history records or a user-selected clock in its input.

The adapters must authenticate and independently establish their data. Their
returned objects are NOT self-authenticating because they have a schema string,
hash, or `public-approved` label. Never wrap HTTP body data in these callbacks.
These are internal contracts, not assertions about Vercel's raw API shape.

The authority adapter must bind the governed repository/project/team, actual
approved public Production context, current deployment/commit/artifact, complete
manifest of exact source bytes, and immutable history revision. Private Preview
and non-Production contexts are rejected. Completeness and public-origin trust
must be proven by that adapter and its provider integration, not inferred from
Host/X-Forwarded-Host, editorial fields or a reduced connector response.

The history adapter must read exactly the requested keys from the pinned revision
and return an explicit record or null for each key. Missing/extra/ambiguous records
or revision mismatch hold the snapshot. Snapshot integrity/authenticity, durable
storage, authorized writers, and rollback-safe revisions remain unimplemented.

The policy re-reads authority after history, rejects drift, and captures immutable
copies. An opaque in-process ticket cannot be recreated by JSON serialization or
used by another policy instance. Tickets expire within fifteen seconds (a proposed
local bound, not a deployed provider setting). They never extend automatically.
Observed authority failures invalidate previous tickets. External revocation
between reads is not immediately observable: the future adapter must provide the
required freshness/invalidation guarantee. No distributed consistency is claimed.

## Recorded publication and legacy archives

A verified admission record must name the exact source bytes and canonical route,
original deployment/commit/artifact, original evidence digest, checked time,
admission time, evidence expiry and earliest preview deadline. Admission must have
occurred strictly before the original evidence expiry and preview deadline.
Pending, revoked, unknown, mismatched or impossible records do not serve. Outcome
records cannot predate their release. A no-calendar Daily uses the separate
`no-calendar-entries` basis and `calendarVerified=false`, never a universal PASS.

The module relies on the trusted writer having independently verified the original
event identity, month, time and phase before recording admission. It does not
retroactively perform BLS verification of an archive, nor does it substitute a
record's boolean for that independent writer. It rejects normal records outside
the current three-series BLS scope. Treasury/EIA/Fed/BEA coverage is unchanged.

A legacy baseline record is a distinct case. It must match an explicitly accepted
baseline commit, deployment and inventory digest supplied by the protected
authority adapter. It has `admittedAt=null` and `calendarVerified=false`; an
observation time is not invented historical publication timing. Legacy items are
archive-only, never certified current previews. No actual baseline is seeded.
A snapshot/ledger outage currently holds inspection. Keeping established archives
available during such an outage requires an authenticated local history snapshot
or another separately reviewed storage strategy; that adapter is not implemented.

## Logical surface projections

`project(ticket, { surface, method })` is a synchronous logical projection:

- `article`, `news-archive` and `sitemap` retain legitimate recorded archives.
- `homepage`, `news-current`, `feed` and `latest-json` exclude an expired preview.
- A single absent/pending item does not suppress other admitted items.
- Held items' titles, routes, dates, summaries and bodies never enter `view.items`
  or internal diagnostics. Diagnostics include only decisions and hashes.
- HEAD returns no body; unsupported methods/surfaces fail closed.
- Proposed response headers explicitly set browser, intermediary CDN and Vercel
  CDN cache layers to no-store. They are values for a future handler, not proof
  that current static pages obey them.

No HTML, XML, JSON endpoint, sitemap, redirect, clean-URL alias or CDN is rewired
by this module. Calling a projection before an asynchronous render is not an
atomic response-admission boundary. Rendering can finish after the projection's
time check; actual response dispatch, streaming/cache behavior and every public
route variant still require integration and end-to-end proof. Vercel automatically
caches static assets; attaching these headers to an unused object does not change
that. Do not claim a live warm-cache, hostname, promotion or cutover test.

## Verification in this increment

The regression script uses synthetic publications and controlled authority/history
callbacks and clocks. It tests absent and pending history, strict deadlines,
recorded archives, current-list filtering, mixed valid/held collections, drift,
revision/content mismatch, expiry, JSON/cross-instance replay, unsupported methods,
three proposed cache headers and explicit legacy-baseline treatment.

It performs no network requests, AI generation, credential reads, provider writes,
admission writes or publication. Existing live BLS observations and the previous
351 calendar groups remain separate evidence. Run:

```sh
node scripts/test-publication-serving-policy.mjs
```

## Next protected boundary

Obtain authenticated full provider configuration/roles/checks/gitSource evidence.
Then select and review the authority adapter and transactional durable admission
store, implement new-admission commit at a trusted time/response boundary, wire
all surfaces, and test staged expiry plus alternate exposure paths. Preserve the
existing canonical deployment and recovery route. This policy increment neither
requests nor authorizes changes to Production, storage grants, secrets, branch
protection, domain assignment or deployment protection. Keep issue 558 open.

Platform references checked September 9, 2026:

- https://vercel.com/docs/caching/cdn-cache
- https://vercel.com/docs/caching/cache-control-headers
