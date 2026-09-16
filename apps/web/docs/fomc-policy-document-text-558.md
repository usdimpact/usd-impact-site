# FOMC policy document-text parser - #558 / #615

## Status and exact scope

Dormant supplied-article-text semantics only. This component is **not** a Fed
page collector, raw HTML parser, source-authentication check, current calendar
verifier, enabled adapter, publication lease or Production guard. Keep #615 draft
and unmerged, #558 open, and all current live settings unchanged.

Approved design: [#558 checkpoint 5705465363](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5705465363).
The initial implementation started from candidate `4a3ebcd41c2af102546b2059273f12fa45b0af9c`
and main/base `df175c72baa2c4b80eaec8bb372e92e43c18c76e`. These are immutable source
bindings, not perpetual current-state assertions. Read the successor receipt.

The initial five-file increment comprised the new text module, its synthetic
test, its JSON fixtures, this document, and one appended offline import in
`validate-publishing.mjs`. That increment modified no existing module or test.
The subsequent four-file compatibility correction is documented below. In particular,
the previous assertion component and its isolation allowlist remain unchanged.
The new module does not import that component or the active BLS parser.

## Input contract

`parseFomcPolicyDocumentText(request)` requires exactly four own, enumerable data
properties on a plain or null-prototype object:

| Field | Accepted representation |
| --- | --- |
| `schema` | `fomc-policy-document-text/v1` |
| `documentRole` | `statement` or `implementation-note` |
| `sourceUrl` | Asserted exact HTTPS `www.federalreserve.gov/newsevents/pressreleases/monetaryYYYYMMDDa.htm` or `a1.htm`, respectively |
| `articleText` | Complete supplied text for the supported representation described below, not HTML |

URL syntax and its date are checked against the supplied document. **No URL is
requested or authenticated.** Unsupported host, credentials, query, fragment,
port, encoding, normalization or role/date variation rejects. The parser cannot
prove the asserted URL actually contains that text.

Extra fields, accessors, proxies (including revoked proxies), inherited fields,
nonstring text and unsupported prototypes reject without getters or proxy traps.
No caller-approved, permissive, previously-parsed or verified object shortcut
exists. Serialized input is not parsed here: future JSON ingress must reject
ambiguous duplicate keys before ordinary JSON parsing erases them.

Engineering bounds are 128 KiB UTF-8 text, 2 KiB URL, 1,024 nonempty lines,
256 paragraphs, 4,096 UTF-16 units per physical line, and 8,192 normalized units
per paragraph. These are deliberate limits, not measured Fed page maxima.
Malformed Unicode, control/bidirectional/zero-width characters, soft hyphens,
raw markup, entity-encoded markup, truncation markers and lone carriage returns
reject rather than being stripped. Blank-line paragraph boundaries are required.
Unknown layouts or document grammar HOLD; there is no lossy fallback.

Allowed normalization is limited to ordinary whitespace, NBSP/narrow NBSP,
U+2010/U+2011/U+2013 numeric hyphens and curly quotation marks. Normalized character
positions map to exact original supplied-text boundaries. This is not a browser
visibility or raw-response-byte map.

## Supported document semantics

### Statement

The unique exact statement heading and English issue-date line must occur in the
first header lines. The separate unique release line must be `For release at
2:00 p.m. EST` or `EDT`. Its seasonal zone must agree with the issue date under
`America/New_York`. Other clocks, including the nonregular historical 17:00
example, reject. The component still does not establish a scheduled meeting.

A unique adopted Committee target-range clause must precede the explicit voting
paragraph. The supported clause begins with `The Committee decided to`, or the
reviewed `In support of its goals` preamble, optionally extended by the balance-
of-risks phrase. It must say lower/raise the federal-funds target **to** a range
(with an optional explicit **by** amount), or maintain it **at** a range.
The ending `percent.` and supported sentence boundary are mandatory. Majority
ambiguity, duplicate clauses, quoted/historical preambles, conditional endings
and unknown grammar reject. Later dissenting preferences are not adopted action.
This is a restricted grammar, not a general natural-language fact checker.

`action` is `lower`, `maintain` or `raise`. `changeBasisPoints` is signed when
explicitly stated; maintain supports zero from the verb. A raise/lower with no
stated amount returns **null**, not a customary change or reconstructed prior
rate. `changeStatedNumerically` distinguishes an explicit amount from maintain.
No inflation objective, consensus surprise, prior rate or market move is inferred.

### Implementation note

The unique dated note heading, implementation heading and exact statement-
association introduction establish only supplied-text context. The associated
statement date must agree with the note issue date and asserted URL date.
The reviewed Open Market Desk direction paragraph must precede the dated
`Effective ... directs the Desk to:` paragraph and the unique federal-funds
open-market-operations target directive. That target list item must be its own
paragraph; optional hyphen/bullet prefixes are accepted.

Only the target directive supplies target bounds. Reserve-balance, repo,
reverse-repo and primary-credit rates do not replace it. A second target-range
mention is ambiguous and rejects. `directiveEffectiveDate` is separate from issue
and association dates and may be later, but never earlier. Other operational
rates/effective dates are not parsed as policy changes.

A note's missing printed release clock remains **null**, including in a pair.
No value is copied from the statement, meeting page, effective date or wall clock.
An explicit note clock is subject to the same reviewed 14:00 seasonal rule.

One printed `Last Update: Month D, YYYY` and one supported update advisory may
be preserved separately with source spans. A printed update date cannot predate
issue. Unknown or duplicate update notices reject. Preserving an update date does
not reconstruct version history or certify the initial version. The parser does
not detect edits that leave no explicit notice in the supplied text.

### Exact numbers and provenance

Supported percent notation is unsigned integer, at most two decimal places,
proper halves/quarters with optional integer part, and quarter/half/three-quarter
Unicode characters. The conversion uses exact integer basis points. Explicit
change amounts may use percentage-point notation or positive integer basis
points. No `parseFloat`, rounding, exponent, negative level, unsupported fraction
or unsupported precision is accepted. Levels are bounded to 0-100 percent; zero
is a valid lower bound. Bounds must be ordered, but no 25-bp width is assumed.
These are representation/safety bounds, not a statement of policy limits.

`documentTextSha256` hashes the exact supplied UTF-8 text. Evidence spans identify
exact original heading, dates, target clause, numeric notation and explicit
change units. Offsets use **UTF-16 code units**, not original HTTP-byte offsets.
Returned records and nested spans are frozen; caller input is not mutated.
No source text is printed by the module. Diagnostic consumers must not log
arbitrary supplied article text or confuse its digest with source authentication.

## Pair comparison and permanent non-authorization

`compareFomcPolicyDocumentTexts({ schema, statement, implementation })` uses
schema `fomc-policy-document-text-pair/v1` and reparses both original requests.
It compares issue/association dates, target bounds and any explicitly present
note release time. A different note effective date is not a mismatch. It never
accepts caller-provided parsed records instead of requests.

Every parsed document returns `DOCUMENT_TEXT_PARSED_NOT_VERIFIED`; every
consistent pair returns `DOCUMENT_TEXT_PAIR_CONSISTENT_NOT_VERIFIED`. Both keep:

```text
sourceAuthenticityVerified: false
meetingAssociationVerified: false
rawPageCompatibilityCertified: false
documentCompletenessVerified: false
freshSourceVerificationPerformed: false
calendarLeaseIssued: false
publicationAuthorized: false
enforcementActive: false
```

There is no PASS, publishable bit, validity lease, signature or admission. A pair
only agrees on inspected supplied-text fields. It does not certify matching
original versions, actual link discovery, meeting dates, cancellation/rescheduling,
source truth, current freshness, completeness, raw page compatibility or an outcome.
The module performs no network, environment, filesystem or implicit-clock reads.
Rejections use fixed `HOLD_FOMC_TEXT_*` codes, never arbitrary exception text.

## Fixtures, historical references and test boundaries

Original JSON cases are labeled **synthetic-article-text**. Added compatibility
cases distinguish **synthetic-context-with-source-derived-wording** and identify
the reviewed phrases separately. Both retain invented member labels, constructed
context and a digest of the exact supplied text. Historical URLs identify the
design basis, not a captured response. No case is a complete transcription, raw
response capture, real member list or September 2026 outcome certification.
The preceding design review used these official historical references:

- [December 2025 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20251210a.htm): majority versus dissent.
- [July 2025 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20250730a.htm): maintain versus dissent favoring a cut.
- [July 2023 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20230726a.htm): missing explicit change amount.
- [December 2025 implementation note](https://www.federalreserve.gov/newsevents/pressreleases/monetary20251210a1.htm): different instruments, issue/effective dates and absent standalone clock.
- [March 2020 statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm): nonregular-clock exclusion and zero-bound example.

The initial parser used prior design observations. The compatibility correction
reread the December pages through public parsed web views, not raw-response captures.
Genuine complete original-body fixtures and safe article isolation remain absent.
Never manufacture a raw fixture by wrapping synthetic text in invented HTML.

The new suite covers majority/dissent, exact numbers, absent values, source spans,
Unicode/line endings, date/role/clock mismatches, pair conflicts, malformed objects,
forged flags, bounds and no-I/O behavior. Its mandatory normal-CI scan checks
literal new-component references under source/API/scripts/Middleware, allowing
only its own module/test and the publishing driver. Temporary scanner fixtures
include an accidental active import that must fail. This is not universal proof
against computed imports; exact approved-file review is also required.

A local extracted test run omits the full-checkout scan and driver assertion and
must be reported separately from normal CI. Existing BLS, assertion, authentication,
response and provider suites remain in the driver. No remote workflow dispatch or
live-source test is required or authorized by these synthetic checks.

## Remaining gates

Next: obtain and review genuine complete original-page fixtures, safe article
extraction/visibility mapping and an independently scoped collector/freshness
contract. Then design actual FOMC evidence integration, BLS/legacy compatibility,
mandatory PCE and other included event coverage without deleting unsupported rows.

Actual applied host policy, isolated platform tests, authority/reader/witness,
Production routes, full-PR review and end-to-end clock/cache/alternate-host/
rollback/outage/recovery proof remain separate. Preserve authentication and
response fixes, unverified exposure, legacy archives, and the completed Log rule.
No merge, mark-ready, Production change, credential, hosted SQL, generation,
article edit, email or scheduled-task change follows from this component.


## Source-wording compatibility correction

Approved four-existing-file scope: [#558 checkpoint 5705988417](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5705988417),
starting at `f047809cc29945b87c8e32921a8a887fab28ae7e` and main/base
`df175c72baa2c4b80eaec8bb372e92e43c18c76e`. The parser, its tests, fixtures and
this document change; the publishing driver, other modules, workflows,
dependencies, live settings and authority flags do not.

The December 10, 2025 statement and implementation note linked above were
reread as web-extracted semantic references. They are not new original-response
captures. Five added positive cases retain synthetic document context while
identifying exactly which wording comes from those sources. A sixth added
synthetic related-note-label case must remain a role rejection. The original
14 case objects, their text and expectations remain unchanged.

### Target references versus adopted decisions

Require one operative `the Committee decided to` occurrence and one supported
adopted target clause. The reviewed complete forward-guidance sentence beginning
`In considering the extent and timing of additional adjustments` may occur once,
after the adopted clause and before voting, in the same or a separate paragraph.
Its exact supported normalized wording is in the module and source-derived
fixtures; there is no wildcard allowance for arbitrary second policy statements.
Every target-range reference outside the voting block must belong to the adopted
clause or that exact guidance. Unknown, duplicate, historical/quoted, out-of-order
or contradictory references hold, even when a second range agrees numerically.
Voting preferences remain context and cannot supply the adopted action or range.
An additional operative Committee decision in voting text also holds.

`evidence.forwardGuidance` records exact UTF-16 spans for the optional recognized
sentence and is empty when absent. Existing target, amount and source-text hash
fields retain their meaning. No source wording is deleted or rewritten to obtain
acceptance. This bounded rule is not a general natural-language fact checker.

### Directive and advisory variants

Both explicitly supported introductions, `voted to direct` and the pre-existing
`voted to authorize and direct`, are accepted only in the otherwise exact domestic
directive grammar. Negation, disjunction, truncation, changed actors or duplicate
directives do not acquire an alternative fallback.

The two existing short synthetic advisories remain supported. The complete
reviewed `This information will be updated as appropriate to reflect decisions`
advisory is additionally recognized only with its exact remainder. A wrapped
paragraph is inspected as a whole and its complete source span is retained;
unknown continuations and duplicate advisories hold. The full `may` variant is
not invented from the short synthetic example. Update notices remain distinct
from issue/effective dates and are not evidence of authenticity or freshness.

### Boundaries and regression controls

Successful documents and pairs remain NOT_VERIFIED with every authority flag
false. Missing change amounts and note clocks remain null. Related-document
labels flattened into article text still trigger role rejection: fixing safe
HTML extraction requires a separately scoped implementation, not relaxed titles.
Compatibility tests include same/separate-paragraph guidance, independent and
combined note variants, source-span mapping through supported whitespace/Unicode
changes, strict malformed variants, multiple operative decisions and conflicting
pairs. The normal test import and full-checkout isolation guard stay mandatory.
All current test counts must be read from the exact successor-head run, not
inferred from the older 183-group receipt.

Genuine original-page acquisition, safe article isolation, source freshness,
meeting linkage, adapter enablement and Production enforcement are still absent.
The completed compatibility increment supplies no release permission.
