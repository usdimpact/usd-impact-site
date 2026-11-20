# D-CAT-PUBDATE-01 — Catalyst first-publication provenance, owner decision

**Status: DRAFT / NON-SERVED / OWNER DESIGN DECISION REQUIRED / DO NOT MERGE.** Source-only engineering adjudication prepared 13 November 2026. This is a plan, **not** an approved schema migration, a publication event, a legal determination, or a change to current Production. No code, workflow, secrets, Vercel settings or published content is changed by this note.

## Why a separate publication field is required

- On protected `usdimpact/usd-impact-site@181b9dfd9df39fbdf1eca9a9d750071cafe71919`, `apps/web/src/pages/news/catalysts/[slug].astro:32-39` passes `entry.data.generatedAt` as `datePublished` to `articleStructuredData`. This is **content preparation time**, not proven first public availability.
- `apps/web/src/content.config.ts:185-215` defines Catalyst content with `generatedAt`, `lastReviewed`, `eventDate`, `sourceEditionDate`, `status`, `sources[].publishedAt`; it has **no separate first-publication field**. The EIA Draft [#1256](https://github.com/usdimpact/usd-impact-site/pull/1256) at `c46ba0a2a1f6492da6689bd903c72cae546fc38a` is correctly `status:review` and `generatedAt:2026-11-13T17:08:00Z`. Its future public date remains unverified.
- `apps/web/src/lib/structured-data.js:53-79` supports optional `datePublished` for general `Article` (while `NewsArticle` explicitly requires it). Do not accidentally change Daily NewsArticle behavior or default organization schema.
- Independent read-only inventory of `apps/web/src/content/catalyst-briefs/` on this protected main found exactly **15 published Catalyst Markdown files** (excluding `.gitkeep`), and **none has `firstPublishedAt`**. Therefore a blanket new required field for every published Catalyst would fail the **existing** collection. Conversely, silently backfilling `firstPublishedAt=generatedAt` would invent provenance and must not be done.

## Legacy baseline — frozen inventory for review, not an invented metadata history

All 15 currently published Catalyst paths (each `status=published`, `firstPublishedAt` absent) as of this precise main commit:

1. `2026-08-12-bls-consumer-price-index-cpi-for-july-2026-preview.md`
2. `2026-08-26-bea-personal-income-and-outlays-includes-pce-core-pce-outcome.md`
3. `2026-08-26-bea-personal-income-and-outlays-july-and-gdp-second-estimate-q2-preview.md`
4. `2026-09-04-bls-employment-situation-august-2026-scheduled-release-preview.md`
5. `2026-09-04-bls-employment-situation-for-august-2026-released-outcome.md`
6. `2026-09-09-treasury-increases-long-end-liquidity-support-buybacks-effective-sept-9-preview.md`
7. `2026-09-11-bls-consumer-price-index-cpi-for-august-2026-preview.md`
8. `2026-09-11-bls-consumer-price-index-cpi-for-august-2026-released-outcome.md`
9. `2026-09-15-fomc-meeting-and-press-conference-september-15-16-2026-preview.md`
10. `2026-09-16-fomc-scheduled-communications-meeting-entry-18-00-utc-press-conference-1-outcome.md`
11. `2026-09-30-scheduled-bea-personal-income-and-outlays-august-2026-including-pce-infl-preview.md`
12. `2026-10-02-u-s-employment-situation-september-2026-08-30-et-15-30-bucharest-preview.md`
13. `2026-10-28-fomc-scheduled-communications-following-the-october-27-28-meeting-press-outcome.md`
14. `2026-10-28-fomc-scheduled-communications-following-the-october-27-28-meeting-press-preview.md`
15. `2026-10-29-bea-q3-gdp-advance-and-september-pce-preview.md`

The legacy list is **not proof of the 15 actual first-publication dates**. Any audit/correction of old metadata requires its own dated evidence and owner acceptance. Future releases cannot be grandfathered by changing their event date, filename or `generatedAt`.

## Owner-selectable forward design

### Option A — preferred for simple, reviewable future publication: first *public calendar date*, no false second-level precision

- Add optional `firstPublishedDate` to the Catalyst schema as an ISO UTC `YYYY-MM-DD` date. Keep `generatedAt` strictly as preparation provenance; `eventDate` is the catalyst event; `sources[].publishedAt` is source-issuer publication. Do not mix these fields.
- In the standalone *public-release* PR only, require `firstPublishedDate` for any **newly** `published` Catalyst not in the protected, explicit legacy inventory. Verify it represents the actual intended public calendar date, not a value copied from EIA's Nov 12 release date, EIA's Nov 6 data week or the candidate's Nov 13 draft time.
- Public `Article` `datePublished` should come exclusively from `firstPublishedDate` for new publications, not `generatedAt`. The `YYYY-MM-DD` format avoids claiming an unverified minute/second. Existing 15 already-public entries remain untouched under an explicit *legacy-only* compatibility clause until independently audited, without automatic backfill.
- Require approval/merge, matching-SHA Vercel READY and actual public HTTP 200 **within that UTC date**; if the release does not become public on the authorized UTC date, **do not claim successful publication**, preserve the mismatch and use a separately approved correction/recovery. In particular, approval near UTC midnight should be held if the date cannot be assured.
- This option provides a useful calendar-date claim but does **not** prove an exact first-publication timestamp. Do not call it `firstPublishedAt`.

### Option B — most precise provenance, two-stage publication metadata

- Keep new public `Article` datePublished **absent** until the real first HTTP 200 / same-SHA READY Production receipt is observed; the general `articleStructuredData` helper already accepts omission, but the actual Catalyst route would need a new **explicit** conditional mapper. This is not an excuse to omit legally required publisher disclosures.
- Record the observed first public availability as `firstPublishedAt` in a subsequent owner-approved metadata-only PR; then populate `Article.datePublished`. Include a durable evidence link to the Production deployment ID, exact commit SHA, public route, UTC receipt and body/public-source parity.
- Drawback: two protected merges and an interval with no datePublished structured-data property. Must be separately tested for crawl/index effects and never be reused for Daily `NewsArticle` (which requires datePublished).

**Unacceptable:** hard-code the EIA report's Nov 12 date; replace `generatedAt` with the time the draft was reviewed; infer a first-publication time from schedule, PR creation, source document, or Vercel Preview; silently set all 15 legacy records to their preparation time; allow novel published entries to bypass the gate.

## Mandatory implementation tests (whichever option owner selects)

1. Baseline: all 15 current published files still build, retain exact paths, content and current discoverability; no article content/URL/robots regression.
2. EIA Draft `#1256` stays `review` and **unrouted** on public URLs; Preview-only editor route does not index or present article JSON-LD.
3. Future new `status:published` Catalyst without owner-approved publication metadata is **fail-closed** in the chosen design; prove that adding a new slug or changing event/issuer dates cannot bypass it.
4. Mutation fixtures: invalid UTC date; draft creation time copied as publication time; issuer `publishedAt` copied; Nov 6 data-week used as publication; future-date mismatch; unsupported legacy-path bypass; first-publication field silently overwritten; duplicate/out-of-order source IDs.
5. Current `NewsArticle` Daily contract, non-Catalyst collection schema, GA4 consent, sitemap and canonical behavior, and existing original EIA/Catalyst source ledger unaffected.
6. Publication PR final copy uses correct public tense and owner-approved AI notice; preview text, internal publication instructions, non-served provenance and stale pre-event preview must not be published.
7. Exact-head native Web Quality/CodeQL/dependency/security checks; matching real Vercel Preview, public negative-route controls; accountable owner exact-copy/AI/rights/privacy decision. Separate owner approval for normal protected merge.
8. Post-merge exact commit READY Production, source links, public outcome route 200, News/Reports discoverability as appropriate, footer, no unapproved cache, valid Article JSON-LD and verified first public date; no release if live results cannot be verified.

## Other outstanding review findings: separate decisions, not grounds to publish

- [Weekly Draft #1257](https://github.com/usdimpact/usd-impact-site/pull/1257) at `a15d67a34cf0909ddbc9d259e9c63077d8eeb49b`: **9/9 CI PASS** after user-retried run #43482841349, attempt 2. Isolated matching [Vercel Preview dpl_42uSS7Ko1iSZtgpyXFQ2Hj2QsU7W](https://vercel.com/usd-impact/usd-impact-site/42uSS7Ko1iSZtgpyXFQ2Hj2QsU7W) READY, preview-only review page 200, public Nov 6 date route 404, review excluded from sitemap, Production untouched. This clears Claude's prior technical Preview and cancelled-job findings; **manual desktop/mobile/keyboard QA remains outstanding**.
- [Oct 30 focus Draft #1258](https://github.com/usdimpact/usd-impact-site/pull/1258) at `9b32853a5b13fa11a078654d62708c41f54ed669`: 8/8 exact-head CI PASS and Preview READY; dark/light focus fix not in Production. An optional **skip-link** dark ribbon edge case remains: `.skip:focus-visible { outline-color: #f4e2bc; }` is a proposed one-line targeted fix, but would **change exact PR heads** and invalidate current review receipts. Owner chooses whether to fix in same Draft and re-run full QA or defer as separate scoped change.
- For November Weekly, harmonizing its public AI notice with already published October Weekly's explicit USD Impact **publisher responsibility** language is a separate accountable owner editorial determination; do not silently add/delete legal or transparency claims.
- Owner must decide acceptance of the **owner-supplied EIA HTML/TXT/CSV copies** versus independently observed original bytes; Claude reported 17/17 numeric checks but could not prove archive HTML bytes match issuer originals. Source manifest and files must not be represented as cryptographically issuer-authenticated absent evidence.
- Daily automation [issue #840](https://github.com/usdimpact/usd-impact-site/issues/840) remains **OPEN** until complete naturally scheduled generation, protected publication, same-SHA Production and natural Health acceptance; no manual/paid dispatch.

## Pending owner decisions — record explicitly (PASS / HOLD, not presumed)

1. Choose Option A date-only or Option B two-stage exact first-publication provenance.
2. Accept/correct the EIA source-custody limitation; sign off exact EIA copy if source integrity sufficient for the intended purpose.
3. Choose site-consistent public AI-assisted statement and publisher-responsibility notice for Catalysts and Weekly; determine applicable rights, privacy, consent, jurisdiction requirements. Independent reviewer may advise but not substitute for owner/legal approval.
4. Decide skip-link focus treatment in Drafts #1257 and #1258; perform desktop 375px and keyboard manual Preview QA. If the PR head changes, repeat exact-head tests and actual rendered-preview check.
5. Authorize a **separate** final release PR and later protected merge by exact SHA. Approving this docs-only note cannot authorize a publication.

**Disposition: DESIGN OPTIONS PREPARED / CODE NOT IMPLEMENTED / NO PUBLICATION AUTHORIZED.**
