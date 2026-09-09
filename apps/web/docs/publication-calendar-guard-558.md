# Authoritative publication calendar guard - #558

## State and release boundary

**Draft foundation; not an active publication guard.** This change supplies a
shared BLS CPI verifier, a read-only diagnostic, a separately invoked live
adapter probe, and deterministic regression tests. Only the offline tests are
attached to the existing publishing-validation command. There is no new
workflow trigger/permission, required check, provider setting, secret,
publication, generation request, or Production deployment.

Do not close #558 or call the delayed-PR publication defect fixed by this draft.
The date-boundary test proves the verifier rejects an expired decision; it does
not prove GitHub or Vercel invokes that verifier at the release boundary.

Investigation baseline: `main@058d4d893ab12ce7ddd51ad43154d02b8536ca59`.
The existing Catalyst selector, generator, importer and structural validators
are unchanged. Daily calendar ingestion is unchanged. No historical article is
rewritten, relabeled, removed, or automatically converted into an outcome.

## Implemented contract

`src/lib/publication-calendar.js` validates a canonical event record, asks the
independent adapter for current official evidence, compares identity, explicit
reference period, local release date/time, IANA timezone and UTC instant, then
checks preview/outcome eligibility against trusted current time.

Supported identity is **BLS national CPI / initial monthly release** only.
Other issuers, series and release stages return HOLD_UNSUPPORTED_EVENT; missing
periods/times are held, not inferred. An optional editorial event label must
agree with the structured identity and period. This does not validate arbitrary
claims elsewhere in an article's prose.

Example candidate (assertions to check, not evidence):

```json
{
  "publisher": "BLS",
  "series": "CPI",
  "referencePeriod": "2026-08",
  "releaseStage": "initial",
  "event": "BLS Consumer Price Index (CPI) for August 2026",
  "eventDate": "2026-09-11",
  "releaseTime": "08:30",
  "timeZone": "America/New_York",
  "releaseAt": "2026-09-11T12:30:00Z",
  "phase": "preview",
  "statusLabel": "scheduled-confirmed"
}
```

Reference month is not the release month. Identity excludes date and title, so
rescheduling/renaming does not change `BLS:CPI:2026-08:initial`. Consumers still
need to enforce duplicate suppression using this identity.

A preview is eligible only strictly before the verified instant, with no
matching already-released or later-period results. An outcome requires a
matching official results heading, period, release timestamp and results
statement; a schedule or elapsed clock alone is insufficient. Cancellation and
rescheduling remain held for a separately reviewed notice. Historical outcome
backfills that are no longer on the current results endpoint are unsupported.

The adapter reads only these fixed official resources:

- https://www.bls.gov/schedule/news_release/cpi.htm
- https://www.bls.gov/schedule/YYYY/MM_sched_list.htm (month selected from the official schedule, not the candidate's claimed date)
- https://www.bls.gov/news.release/cpi.nr0.htm

It cross-checks the two schedule tables and parses actual results separately.
Fetches use direct HTTPS GETs, reject all redirects, require HTML, bound each
body to 512,000 bytes and each request to 12 seconds, constrain parser
complexity, and reject stale/invalid HTTP cache metadata when supplied.
No credentials, paid calendar feed, LLM request, or external write is involved.
A source-format change is an explicit HOLD, not permission to guess.

Each decision records source URL, SHA-256, adapter version, fetch/check times,
canonical identity and validity boundary. Successful evidence lasts less than
15 minutes and never beyond a preview's release instant. Input `verified`,
`publishable`, `asOf`, `generatedAt`, evidence and clock claims cannot change the
trusted clock or supply primary evidence. Fetch/clock injection is for trusted
unit harnesses; the CLI exposes neither.

A PASS is **eligibility evidence, not publication authorization**. The optional
exact repository/base/head/content digest binding is supplied by a trusted
caller, not derived from a candidate. In-process freshness checking rejects
unbound, expired, mismatched and serialized/forged decisions. Audit JSON must
never be treated as a reusable release token. A final release must fetch again.

## Commands

From `apps/web`:

```sh
node scripts/test-publication-calendar.mjs
node scripts/test-publication-calendar-diagnostics.mjs
node scripts/test-publication-calendar-captured.mjs
node scripts/check-publication-calendar.mjs candidate.json
node scripts/probe-publication-calendar.mjs 2026-08
```

The diagnostic accepts one bounded canonical candidate JSON file, uses the
actual runtime clock, prints an audit decision, and exits 0 for PASS or 2 for
HOLD/invalid input. It never imports, publishes, merges, closes an issue, or
changes configuration. It is not a drop-in replacement for the existing Daily
or Catalyst payload: the canonical fields must first be carried through those
contracts and independently compared with the article metadata.

The separate probe checks live parser/source compatibility for an explicitly
chosen reference period. Its PASS says the adapter parsed/cross-checked those
resources, not that a particular article is eligible or released. It is not a
normal build dependency and can hold when an old period leaves the live schedule.

The original 81 regression groups use synthetic HTML. Another 31 groups test
sanitized response diagnostics. The 29 captured-markup groups use exact dated
source fragments plus explicitly synthetic nested-layout wrappers. None of
these offline fixtures is fresh publication evidence. Local execution uses
Node 22; repository CI uses the existing Node 24 contract.

## Diagnosed source access and parser repair - September 9, 2026

The client now sends the truthful contactable identity
`USDImpact-CalendarValidator/1.0 (+https://www.usd-impact.com/contact/)`.
BLS's robot policy reserves the right to block clients without owner contact
information: https://www.bls.gov/bls/blsterms.htm. There is no browser
impersonation, alternate host/IP, proxy, redirect following or denial retry.
The earlier generic non-200 response did not establish its precise cause.
After the identity change, the remote request obtained direct HTTP 200 HTML;
the separately observed local EAI_AGAIN is a DNS failure, not an HTTP denial.

The successful fetch exposed an actual parser defect: BLS nests its
`release-list` table inside `main-content-table`. The prior non-nesting regex
consumed the outer layout and missed the correct header row. Adapter
`bls-national-cpi/html-v2` tracks table/row/cell ownership, retaining exact
headers, a unique matching table, bounded nesting/size, and strict row shape.
Malformed nesting, duplicate tables and merged/nested release cells stay held.

Read-only CI capture run `34389851062`, artifact `10119174507`, retrieved three
public source pages at 18:34:46-49 UTC on September 9. Each returned direct HTTP
200 HTML. The original complete-page SHA-256 values are:

- CPI schedule: `36b83ba3723ac4e1d96431214b22f22bb4240718dab1ec2b6289fef9e7829580`.
- September list: `3f9ee4b1f431e0e8cb8d8a2234aa2b149a1be9811ef5b820bbf286722c2e0e72`.
- CPI release: `8c8532945dda0f4fee74259b8eefce7d6958188093c29b22410a71f6c05f427e`.

The committed fragment fixture records each original URL, fetch time, complete
page digest, exact fragment offset/length and fragment digest. It contains no
response headers/cookies. The repaired parser reads all three complete captured
pages locally and confirms August CPI scheduled for September 11 at 08:30
America/New_York (12:30 UTC), independently of the July results released on
August 12. Those dated observations are not reusable publication approvals.
A fresh exact-head probe and CI evidence belong in PR #559's evidence record.

Diagnostics expose fixed status/transport categories only. They never emit raw
exception text, denied-response bodies, cookies or redirect URLs. A 200 response
alone is not a parser PASS; any parsing discrepancy remains an explicit HOLD.
Temporary read-only CI diagnostics are removed after verification, restoring the
original Web quality workflow; live BLS availability is not a normal build
dependency.

## Archive isolation

`classifyPublicationSnapshots` compares byte digests from two trusted source
snapshots. Unchanged archived previews do not become new publication candidates.
New/backdated, renamed or changed content does not inherit an exemption from a
self-declared old date/status. Deletions remain explicit for editorial review.

This helper does not discover the baseline. The release integration must use
**the last verified deployed revision**, not merely HEAD's parent or the current
main branch: a previous failed deployment can leave unpublished content in main.
Do not trust a baseline supplied inside publication content or a PR evidence file.

## Remaining integration and acceptance gates

1. Carry the canonical record through Daily and Catalyst schemas, compare
   original metadata and relevant headline/body claims, and hold unsupported
   events through the governed verification path. Do not label CPI-only coverage
   as verification of every macro release.
2. Invoke fresh checks before paid research, after generation/before import,
   and for new/changed publication content at final release. A long generation
   crossing the release instant must fail its later check.
3. Obtain an authoritative deployed baseline and bind exact repository,
   approved base/head, artifact/content digests, deployment, evidence and clock.
   A stale base/head approval must not be silently refreshed or rebased.
4. Implement an actual promotion-time control, not only a PR check or an
   importer check. GitHub checks are commit-specific, not expiring calendar
   leases. Staged Vercel Production builds can be promoted without rebuilding.
   A build-time pass can expire while other checks/promotion wait. Any new
   trigger, permissions, branch rule or Vercel configuration needs separately
   bounded approval. No such change is authorized by this document.
5. Prove a PR left open across release cannot reach Production with old greens;
   cover staged promotion/rollback paths and a held deployment followed by an
   unrelated commit. A missing gate must remain HOLD, not an accepted PASS.
6. Record holds distinctly from no-candidate, failure and actual publication.
   Do not reuse the current generic success-handler behavior as calendar
   recovery evidence; no-op/held runs must not close an unresolved incident.
7. Record exact-head CI, live source adapter evidence, applicable Preview QA,
   separate release approval and post-release verification. Keep #558 open.

Platform references checked September 9, 2026:

- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://vercel.com/docs/deployment-checks
- https://vercel.com/docs/deployments/promoting-a-deployment

Deployment Checks are a possible integration point, not a configured guarantee
or automatic expiry mechanism. Do not use Force Promote or a protection bypass.
