# FOMC decision assertion contract - #558 / #615

## Status and scope

Implemented as a **dormant, source-only assertion/identity/clock contract**. It is
not an official-source verifier, calendar lease, publication admission, live
adapter or Production release guard. Keep #615 draft/unmerged and #558 open.

The approved design is recorded in
[#558, design checkpoint](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5704814957).
This four-file increment starts from candidate
`bcae2b8d1347950f72269b421b6bf438d89403e1` and main/base
`df175c72baa2c4b80eaec8bb372e92e43c18c76e`. Those are historical source bindings,
not perpetual current-state claims; consult the successor-head receipt and checks.

Only these paths belong to the increment:

- `src/lib/fomc-decision-contract.js`: pure contract;
- `scripts/test-fomc-decision-contract.mjs`: synthetic contract and isolation tests;
- `scripts/validate-publishing.mjs`: one added offline test import;
- this document.

No active registry, BLS normalization, model schema, source API, importer,
selector, collection, route, workflow definition, provider setting, credential,
hosted database, article or email behavior is changed. Existing FOMC same-phase
plus/minus-one-day suppression and legacy URLs are untouched. No unsupported
calendar row is removed or exempted. Normal PR CI/Preview is not live activation.

## Accepted assertion

The first event kind is **the policy decision/statement of a scheduled two-day
FOMC meeting**. The following is a synthetic assertion, not evidence of a real
meeting, its confirmed schedule, any decision or a right to publish:

```json
{
  "schema": "fomc-decision-assertion/v1",
  "publisher": "FEDERAL_RESERVE",
  "committee": "FOMC",
  "eventKind": "policy-decision",
  "meetingKind": "scheduled-two-day",
  "meetingStartDate": "2026-09-15",
  "meetingEndDate": "2026-09-16",
  "decisionDate": "2026-09-16",
  "releaseTime": "14:00",
  "timeZone": "America/New_York",
  "releaseAt": "2026-09-16T18:00:00.000Z"
}
```

All eleven fields are mandatory own, enumerable data properties with string
values, bounded to 80 characters. Extra fields, coercion, padding, accessors,
proxies (including revoked proxies), arrays and unsupported prototypes reject.
A plain object or null-prototype data record is accepted. Values are inspected
through property descriptors before they are read; getters and proxy traps are
not invoked. Returned assertions are new, frozen data records, not mutable aliases
of caller input. No arbitrary input or exception text appears in rejection codes.

Dates use strict `YYYY-MM-DD` within 2000-2099 and must be real calendar dates.
Meeting start/end must be consecutive; the decision must be on day two. Leap-day,
month and year crossings are supported arithmetically, without asserting that
such a meeting actually took place. This is not a meeting-calendar lookup.

Version 1 accepts only the reviewed `14:00` local statement-clock rule and
`America/New_York`. UTC is computed using the date-specific IANA zone, not a fixed
UTC-4/UTC-5 offset. `releaseAt` must exactly match either the whole-second `Z` form
or the equivalent `.000Z` form; output uses `.000Z`. Other offsets, fractions,
clocks, wrong days and inconsistent UTC values reject rather than being repaired.
A changed official clock requires a separately reviewed contract.

The module consumes JavaScript data objects, not JSON text. A future serialized
input boundary must separately reject duplicate keys before ordinary JSON parsing
loses that information. This contract makes no claim that it can recover erased
keys or detect an undeclared reschedule from a plausible pair of dates.

## Public functions and diagnostics

`normalizeFomcDecisionAssertion(assertion)` returns only validated, frozen assertion
data. It proves neither source truth nor current schedule validity.

`fomcDecisionIdentity(assertion)` binds the `fomc-decision/v1` namespace, publisher,
committee, event kind, meeting kind and full date range. It deliberately excludes
phase, mutable clock, title, article slug, generation timestamp and rate levels.
Unsupported extra identity/approval fields are rejected, not used as aliases.

`fomcDecisionPhaseKey(assertion, phase)` adds exactly `preview` or `outcome` to that
identity. Changing phase does not create another canonical event. A different
asserted meeting range creates a different identity; the function does not infer
rescheduling, supersession or legacy-publication equivalence.

`inspectFomcDecisionContract({ assertion, phase, statusLabel }, observedAtMilliseconds)`
requires precisely those three request fields and an explicit finite, nonnegative,
safe-integer timestamp representable by `Date`. No default wall clock is read.
The phase/status pairs are `preview`/`scheduled-confirmed` and `outcome`/`released`.
Both labels remain assertions. Cancelled/rescheduled statuses reject.

Every successful diagnostic result says:

```text
decision: ASSERTION_VALID_NOT_VERIFIED
clockBasis: caller-supplied-diagnostic-only
outcomeEvidence: NOT_CHECKED
freshSourceVerificationPerformed: false
calendarLeaseIssued: false
publicationAuthorized: false
enforcementActive: false
```

`clockRelation` is `BEFORE_ASSERTED_RELEASE`, `AT_ASSERTED_RELEASE` or
`AFTER_ASSERTED_RELEASE`. `previewDeadlineElapsed` becomes true **at** the asserted
statement instant, including the exact millisecond boundary, and stays true at the
conference/effective-date boundary. A preview before that clock is still unverified;
a result after it is not outcome evidence. There is no `validUntil`, signature,
admission, publishable bit, authority override or affirmative verification result.
A caller can choose a diagnostic clock; that cannot authorize an article.

Malformed requests throw `FomcContractHold` with a fixed code:
`HOLD_FOMC_ASSERTION_SHAPE`, `HOLD_FOMC_UNSUPPORTED_EVENT`, `HOLD_FOMC_DATES`,
`HOLD_FOMC_RELEASE_TIME`, `HOLD_FOMC_PHASE` or `HOLD_FOMC_CLOCK`.
These are dormant module errors. They have not been added to an HTTP response
allowlist or wired into the publication pipeline.

## Intentionally separate event and evidence roles

| Item | Treatment |
| --- | --- |
| Meeting start | Identity context, not the statement release |
| Policy decision/statement | Only accepted event kind in this version |
| Implementation note | Future corroborating source; issue/effective/version dates stay separate |
| Economic projections (SEP) | Separate judgments, not committee decision evidence |
| Press conference/transcript | Separate communication; cannot extend a decision preview |
| Minutes, speeches, notation votes | Unsupported by this contract |
| Emergency, one-day, unscheduled/rescheduled meetings | Unsupported; never coerced into a regular two-day assertion |

Calling an input `scheduled-two-day` does not establish that it is scheduled or
confirmed. Future raw-source verification must discover cancellation, rescheduling
and contradictions. Original editorial labels will need their own explicit binding;
this module does not rewrite combined meeting/conference labels in the archives.

## Official-source provenance and future verification

The September 16 design review used the following official material to define the
roles below. These are **prior document-semantic observations**, not fresh reads,
raw transport captures or live adapter certification performed by this increment.

- [2025/2026 schedule announcement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240809a.htm): distinguishes day-two 14:00 Eastern statements from 14:30 conferences.
- [Meeting calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) and [July 2026 minutes](https://www.federalreserve.gov/monetarypolicy/fomcminutes20260729.htm): separate tentative dates from preceding-meeting confirmation.
- [December 2025 meeting materials](https://www.federalreserve.gov/monetarypolicy/fomcpresconf20251210.htm): distinct statement, implementation, SEP, transcript and minutes; do not invent exact minutes timing by adding 21 days.
- [December 2025 implementation note](https://www.federalreserve.gov/newsevents/pressreleases/monetary20251210a1.htm): issue/effective dates and possible subsequent updates require separate handling.
- [December 2025 projections](https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20251210.htm): participant judgments are not an enacted committee decision.
- [March 2020 meeting materials](https://www.federalreserve.gov/monetarypolicy/fomcpresconf20200315.htm): historical non-regular timing is not covered by a regular 14:00 rule.

A later preview verifier needs fresh, consistent meeting, confirmation and clock
evidence, plus bounded official discovery. A missing future statement page alone
is not positive preview evidence, and a discovery outage is not a negative result.
Actual prior release or expiry must stop a new preview before the conference.

A later outcome verifier needs the real matching official statement and corresponding
implementation material, verified document type/date/time/meeting association and
agreement on the policy target range. Statement-only evidence is partial under
that intended complete contract. A URL, HTTP 200, old minutes quoting a decision,
model flag or elapsed clock is insufficient. Missing conference text does not
invalidate an otherwise verified written decision; conference claims remain unsourced.
SEP and market-reaction claims require their own evidence.

Those future parsers must preserve source spans/hashes, exact numerical units and
range values, operational effective dates, release/acquisition/version distinctions,
bounded raw-source provenance and drift/freshness failures. No parser, collector,
source request, numeric policy extraction or evidence-freshness claim is implemented
here. There is no current FOMC outcome certification in these tests.

## Tests and activation boundary

The normal publishing validator imports the new synthetic suite. It covers strict
shape/prototype/accessor/proxy behavior, summer/winter and transition-day conversion,
leap/month/year arithmetic, event-kind substitution, phase keys, exact expiry,
forged approval fields and permanently non-authorizing outcomes. Network and implicit
wall-clock access are forbidden in the exercised module. Tests separately use local
temporary files for scanner fixtures; the contract module itself performs no I/O.

The full-checkout test scans source files under `src`, `api`, `scripts` and Middleware,
allowing the new module name only in the module, its test and the validation driver.
This is a literal source-reference/isolation guard, not a proof against every possible
computed dynamic import. It is combined with exact four-file scope review. Its normal
CI path has no flag that skips the scan. Preserve the existing BLS, auth, response
and provider regression suites and attach results to the actual successor commit.

Local extracted unit/fixture execution is not a full-checkout scan or full build;
report those separately. Normal CI/Preview does not grant a release or prove live
provider, TLS, database, source or serving behavior.

Subsequent work needs its own scope: bounded dormant official-document parsers,
reviewed fixtures, read-only collector/freshness contract, then assertion propagation
with BLS parity and legacy mapping. Mandatory PCE and included EIA/Treasury/other
unsupported coverage remain unresolved. Never erase those rows to make a run green.

Effective host policy, isolated platform proof, actual authority/least-privilege
reader/witness integration, Production routes and end-to-end stale-publication,
cache, alternate-host, rollback, outage and recovery proof remain separate gates.
Preserve the existing auth and response fixes and `exposure: unverified` containment.
Leave the completed Log rule unchanged. No merge, live rehearsal, generation,
Production change, email or scheduled-task modification is authorized here.
