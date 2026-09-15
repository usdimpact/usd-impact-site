# Calendar validation integration - issue 558

Status: draft implementation; not deployed; not an active Production release guard.
This document supersedes the integration-pending portions of the earlier foundation
checkpoint, without replacing its historical BLS parser evidence.

## Implemented boundaries

The Daily source and background-repair schemas carry a nullable canonical calendar
assertion. A supported record has exactly eight string fields: publisher, series,
referencePeriod, releaseStage, eventDate, releaseTime, timeZone and releaseAt.
The original event label and original publication date are compared, not silently
repaired from the record. Source normalization preserves the record, and both
importers serialize it into frontmatter. Astro preserves it in the collection.
Existing records may omit it so unchanged archives still build.

Catalyst research independently verifies the candidate before any paid research
request. A publishable generated bundle is checked again after research and normal
source/content repairs. Calendar failures return HTTP 409 and never enter the paid
repair loop. The importer performs a third independent check immediately before a
new --publish import. The Daily importer also requires fresh validation before
--publish; its non-public research response is not a publication decision. No
existing model selection, provider credentials or paid generation was changed.

The same BLS adapter supplies independent schedule, monthly-calendar and actual
results evidence at each check. Request-supplied timestamps, verification flags,
source labels and previous JSON receipts cannot replace those reads. A short-lived
in-process lease is bound to the full bundle, expires at the release instant for
previews, and cannot be reconstructed from serialized JSON. Outcomes require the
matching official result, not merely a clock after the scheduled release.

## Coverage and rollout consequence

Only national BLS CPI initial monthly releases are supported. All new automatic
calendar-bearing publications with unsupported or missing records HOLD, including
Daily editions containing Employment Situation, PCE or FOMC entries. They are not
silently removed, guessed or stamped PASS. Review imports remain possible; an
unpublished review is not certified. A Daily with no calendar entries is explicitly
NO_CALENDAR_ENTRIES, not proof that every economic event was checked.

This is a deliberate fail-closed draft and **must not be merged as an unrestricted
all-event rollout**. Before activation, approve an operational coverage plan:
implement issuer-specific adapters for required event families, or define a
separately governed verified editorial route. Do not infer a waiver from this file.

Current-event prose screening checks original labels, metadata descriptions,
verified facts, watch items and transmission copy in a brief; Daily checks its
calendar rows and relevant CPI schedule sentences. Conflicting explicit reference
months, dates, labelled clocks, seasonal offsets and phase claims are held. Relative
release words such as today/tomorrow/yesterday are rejected in brief copy. This is a
conservative grammar, not a universal semantic fact checker. Historical date
comparisons in a new brief can require editorial resolution. Source-grounding,
compliance and human release review remain necessary.

## Duplicate and archive behavior

Selection and direct brief import suppress the explicit canonical event month and
phase independently of date/title-derived URL variants. Existing URLs and event keys
are preserved; there is no archive migration. Unsupported or ambiguous archived CPI
identity encoding holds for editorial resolution rather than being rewritten.
Unchanged published-file --skip-published handling occurs before any live check.
New brief writes use exclusive creation. Daily writes recheck destination bytes and
use exclusive creation for new files; this is not a general concurrent-write lock.

Catalyst automation no longer closes its incident merely because a workflow exits
successfully. Research success, a source HOLD and no candidate are not verified
Production recovery. Existing incidents remain open until release reconciliation.
Its workflow triggers, token permissions and failure-issue deduplication are unchanged.

## Read-only staged release preflight

`node scripts/check-publication-calendar-release.mjs` takes only exact
`--expected-main=...`, `--expected-head=...`, and `--deployment=...` arguments.
For a staged Production deployment the two expected SHAs must be equal. It does not
accept a clock override, fallback baseline file, promote flag or JSON PASS receipt.
An already available VERCEL_TOKEN is required for provider reads; the command neither
creates nor changes credentials. Absence of access is an explicit HOLD.

All network operations are bounded GETs. The preflight resolves the canonical
www.usd-impact.com alias in the fixed project/team, verifies the current and proposed
READY main-branch Git Production deployment mappings, and obtains immutable Git
commit/tree/blob evidence. Provider credentials are sent only to api.vercel.com,
never GitHub or BLS. Redirects, non-success responses, stale cache metadata, incomplete
trees, symlinks, unsupported publication paths, unverified blob bytes and unexpected
source metadata fail closed. The strict metadata parser accepts the JSON-scalar and
block-container dialect emitted by the importers and rejects ambiguous YAML/JSON.

The changed/new publication set is computed against the actual canonical deployed
revision, **not** HEAD's parent or an assumed healthy main. A failed prior deployment
cannot conceal content that remains unpublished. Unchanged archives are not re-parsed
or revalidated merely because time has passed. Changed published files must pass
fresh calendar checks. Archive deletion requires separate editorial resolution.
The preflight rereads the canonical alias, main and candidate mapping, then checks
all leases again before returning a bounded result and content-set digest.

Successful output is explicitly PASS_READ_ONLY_PREFLIGHT with
publicationAuthorized=false, promotionPerformed=false and enforcementActive=false.
This detects an expired staged candidate when invoked. **It does not prevent a user,
an automatic alias assignment, a prebuilt deployment, an alternate alias or a provider
API call from publishing outside this command.** No enforcement controller is wired.

## Remaining protected release integration

Vercel distinguishes Preview-to-Production rebuilding from staged Production
promotion without rebuilding. Ordinary green PR/build checks do not automatically
expire at the calendar deadline. A safe next design must separately govern staging,
canonical/all-domain assignment, promotion permissions and a fresh final decision.
Do not change those controls or add credentials under draft implementation authority.

Before claiming end-to-end prevention: verify the real provider mapping contract;
verify candidate build/artifact provenance and baseline health beyond metadata;
cover every permitted publication/rollback/alias path; bind a fresh authorized
release to exact content and revisions; handle time crossing during the actual
promotion operation; and demonstrate an expired open PR/staged build cannot become
public while a valid candidate and legitimate archives still work. Preview browser
QA and the approved protected-control rollout remain separate gates.

## Tests and evidence

The local suite currently contains 225 calendar groups: 141 preserved foundation,
45 pipeline/import/API, and 39 read-only release-preflight cases. New network, model,
provider and time behavior is tested with mocks. Importer subprocesses write only
isolated temporary fixtures; no real article, customer, database or paid request is
created. Existing source-repair, source-grounding, structural importer, selector and
workflow regression assertions remain, with unsupported publication expectations
updated explicitly. Actual Node 24 CI and immutable Preview evidence must be attached
to the exact final PR head; local Node 22 execution is not a substitute.

The earlier v2 BLS live parser PASS remains dated September 9, 2026 at 18:44:10 UTC.
No old capture or successful CI run is a fresh release authorization. Keep #558 open
and #559 draft until remaining deployment enforcement, coverage and release gates
are satisfied.

Official deployment semantics:
- https://vercel.com/docs/deployments/promoting-a-deployment
- https://vercel.com/docs/deployments/promote-preview-to-production
- https://vercel.com/docs/deployment-checks
