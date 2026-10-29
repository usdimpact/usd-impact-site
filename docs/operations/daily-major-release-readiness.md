# Daily major-release readiness — read-only editorial preflight

**Scope:** one-shot operator check only. No scheduler, paid generation, OpenAI call, API/website function, PR merge, auto-publish, webhook, credential, database, notification or deployment. `releaseAuthorized` is **always false**. `READY_FOR_HUMAN_EDITORIAL_REVIEW` is **not** permission to merge or publish.

## Why this is needed

On October 29, 2026, the existing native Daily generation occurred before BEA's 8:30 a.m. U.S. Eastern releases. The candidate could not be treated as a complete **post-release** Daily without newer official evidence and exact-copy human approval. A reviewed editorial correction was subsequently published in PR #938. Source-type consistency checks (draft PR #997) do **not** fix this timing issue.

The existing publishing policy uses editorial review at 14:00 Europe/Tirane, a 16:00 delivery target and an 18:00 escalation. These are human-operated checkpoints, not unattended scheduled tasks.

## Input and verification boundary

- An explicitly chosen edition file: `apps/web/src/content/news/YYYY-MM-DD.md`.
- An **operator-reviewed** date-specific JSON calendar. Entries must contain the unique event ID, name, exact UTC release instant, official primary-source schedule URL, and an **exact official outcome-document URL** once the document is actually released. The calendar is not a verified feed. Verify release time, reference period, and source identity directly on the issuer website at the time of use.
- Existing structured edition `sources`, `highlights[].sourceIds`, `date`, and `generatedAt`. A link is counted only if it is a recognized primary source, dated for the edition and actually cited by at least one highlight. Mere existence of a URL in the ledger is insufficient.
- Actual UTC check time, by default the real current instant. Override `--at` for reproducible examples only; never use an old time to authorize live editorial action.

As of October 30, pre-reviewed calendar examples exist for [October 29 BEA GDP/PCE](daily-major-release-calendars/2026-10-29.json) and [October 30 BLS ECI](daily-major-release-calendars/2026-10-30.json). These inventories intentionally contain **only selected major events**, not a claim of exhaustive calendar coverage.

The October 30 ECI record has a null `outcomeUrl` while outcome verification is outstanding. After its actual release, an editor must verify the issuer's dated outcome page and supply the exact primary URL in a reviewed manifest before any outcome can count. No future number, headline or source URL may be guessed.

## Operator command

From the `apps/web` directory, using the exact branch/candidate under review:

```sh
node scripts/check-daily-major-release-coverage.mjs --date 2026-10-29 --calendar ../../docs/operations/daily-major-release-calendars/2026-10-29.json
```

For an offline replay at a fixed historical UTC time:

```sh
node scripts/check-daily-major-release-coverage.mjs --date 2026-10-29 --calendar ../../docs/operations/daily-major-release-calendars/2026-10-29.json --at 2026-10-29T14:00:00Z
```

Run the October 30 example only when its Daily file exists and the approved calendar has been independently reviewed:

```sh
node scripts/check-daily-major-release-coverage.mjs --date 2026-10-30 --calendar ../../docs/operations/daily-major-release-calendars/2026-10-30.json
```

The tool makes **zero** network calls and performs **zero** writes; it only reads local source and calendar files and emits JSON. A HOLD exits nonzero. A successful diagnostic still requires human editorial/compliance review and exact-head protected CI.

## Decisions and mandatory manual controls

| Decision | Meaning and operator action |
| --- | --- |
| `HOLD_RELEASE_NOT_YET_DUE` | Before official event time. Treat outcome as unknown; do not label pre-release candidate as released outcome. |
| `HOLD_OUTCOME_DOCUMENT_NOT_VERIFIED` | Event time passed but no independently checked official outcome URL was supplied. Verify at the primary source; do not invent the URL. |
| `HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS` | Official outcome URL is missing from cited dated primary sources or not used in highlights. Correct/review the candidate; an uncited source list entry is not coverage. |
| `HOLD_POST_RELEASE_EDITORIAL_RECEIPT_REQUIRED` | Candidate's `generatedAt` precedes a now-passed release even if a later editor inserted official evidence. Require a **fresh post-release exact-copy human review receipt in the canonical PR**; do not rewrite `generatedAt` to claim a new generator run. |
| `HOLD_CUTOFF_UNTRUSTED` | Missing/malformed future generator time. Repair provenance in the canonical record; do not assume freshness. |
| `READY_FOR_HUMAN_EDITORIAL_REVIEW` | Required outcomes appear in dated cited primary documents; the editor must still verify claim-level accuracy, event reference periods, market interpretation and full calendar coverage before any merge. |
| `HOLD_CALENDAR_COVERAGE_UNVERIFIED` | Empty/missing event inventory is not evidence that no major releases occurred. Independently review official calendars. |

At the live handoff, a human must: (1) verify current issuer schedules and outcome publications; (2) reconcile the current edition, candidate PRs and active paid jobs; (3) obtain precise, current, exact-copy owner editorial/compliance approval; (4) ensure normal PR-event quality, audit, CodeQL and Vercel Preview READY on that exact head; (5) refresh current `main` and merge only under repository protections and an expected-head guard; (6) verify the canonical live dated article, `/news/`, `/news/latest.json` and **`/news/feed.xml`**. A merged PR alone is not delivery proof.

Do not treat a run of this script as fresh official online verification or a substitute for human signoff. Protect payment, entitlement, source-rights and Research/Library HOLD boundaries. No duplicate job, model retry, dispatch or alert loop is authorized by this preflight.

## Scope and follow-up

The first PR is a **Draft-only stand-alone operator route**: it cannot silently activate on PRs or Production, and it does not alter the established native 09:17 UTC generator, independent wake, backstops, existing retry budgets, publisher contracts, publication ownership or site routing. Any future CI/merge blocking integration, scheduler or alert requires a separate design review and explicit authorization. The existing [publishing policy](publishing-delivery-policy.md) and [Daily operations issue #840](https://github.com/usdimpact/usd-impact-site/issues/840) remain authoritative.
