# One-contract publication architecture — proposal for independent Macro Reviews (2026-10-30)

> **DRAFT DESIGN / NO MERGE, PREVIEW, DATA FETCH, PROVIDER LICENSE, PUBLICATION OR PRODUCTION.** This document defines a proposed future interface for review. It is not a product configuration, approved rights memorandum, verified legal opinion, deployment plan authorization, or executable route. Every release gate in [the machine-readable design](canonical-future-contract-proposal.draft.json) is **false**. Existing [Draft #1019](https://github.com/usdimpact/usd-impact-site/pull/1019) and [Draft #1020](https://github.com/usdimpact/usd-impact-site/pull/1020) remain separate and unmerged.

## Executive decisions already made — draft direction

- Weekly working title: **USD Impact Macro Weekly Review**; Monthly: **USD Impact Four-Week Macro Review**; language: **English**.
- Eventual audience direction: **free and public educational**, not an activated route, RSS feed, newsletter or purchase entitlement.
- Research must be sourced only from **existing, actually published, version-pinned USD Impact Daily text** and direct official citations, contingent on source-specific reuse review. No live price-feed retrieval, licensed Score components or realized market-reaction inference.
- The independent Monthly summarizes the **first four genuinely published, consecutive-Friday independent Weeklies**. It does not use any pre-existing Score-derived Weekly or calendar-month shortcut.
- The Oct 26–30 independent Weekly remains an **unpublished editorial sample**, not the first published Monthly source.

## Proposed *single* technical foundation — for later approval

Prefer the **source-pinned** `independent_macro_education` contract in #1019 because it independently hashes and verifies the actual five published Daily source editions and their primary-source claim IDs/URLs. PR #1020 provides an **all-deny, supplementary rights governance and synthetic QA research reference**, but has a different `series`, content structure and a conflicting test-script package edit. **Do not merge both branches together and do not treat their JSON as interoperable.**

The candidate future version label is `independent-macro-education-v1-proposal` **only for design discussion**; neither it nor a public path has been accepted or added to an application. All existing legacy `/reports/weekly` and `/reports/monthly` routes remain reserved for the original Score-based reporting family. There is **no new proposed live URL** in the JSON, and no route, sitemap, content collection, server entrypoint or app loader was created.

## Four independent provenance times — not interchangeable

| Time | Proposed meaning | Required treatment |
| --- | --- | --- |
| `scheduledAtUtc` | Calendar's announced scheduled time | Context only, not evidence that a result existed |
| `officialIssuerIssuedAtUtc` | Authoritative issuer-stated release/issue time, with date and exact source URL | May be used as *official issue-time evidence* under a separately accepted methodology; does **not** establish actual HTTP posting instant |
| `independentlyObservedIssuerFirstWebPostedAtUtc` | Truly independently verified live posting time | May remain `null`; **never** backfill from calendar, Git commit, or Daily generation |
| `editorialReviewedAtUtc` and exact receipt | When editor/owner checked the **actual released material**, with exact Daily/PR content revision | Must be later than issuance for a post-release claim and confirmed against a real immutable, retrievable record |

Separately, the original Daily's `generatedAt` must remain immutable even if it preceded a publication and a subsequent reviewed correction updated the article. An exact GitHub-looking URL is **not** authenticated evidence by itself. A future publisher must confirm the referenced comment/review content and pinned Git SHA in a trusted read-only provenance service. All approved statements must be tied to the correct observed period and units.

Existing evidence: the [FOMC update PR #926](https://github.com/usdimpact/usd-impact-site/pull/926) and [October 29 post-release correction PR #938](https://github.com/usdimpact/usd-impact-site/pull/938#issuecomment-6510694719) show meaningful editorial handling after the scheduled events. The [October 30 ECI PR #1009](https://github.com/usdimpact/usd-impact-site/pull/1009#issuecomment-6525502611) has the actual Daily owner's exact-content PASS and 12:30 UTC official issue-time. These receipts **do not** constitute separate independent-Weekly approval, an exact website posting timestamp, or commercial publisher/source rights. The original independent Weekly's Fed/GDP/PCE `sourceReleaseAt:null` fields have **not** been invented or changed.

## Zero-new-market-data-license rights scope — review proposal only

The minimal proposed first use is **one original English educational article with own-word explanation, exact official primary-source link, clear agency/title/date credit and a non-endorsement statement**. Avoid importing or republishing the original source page, agency seals, charts, graphic/table images, licensed indexes, raw time-series feeds, vendor data or old Score histories.

Agency policy context:
- [Federal Reserve Board website disclaimer](https://www.federalreserve.gov/disclaimer.htm): Board-originated content is generally public-domain unless noted, with Board attribution; non-Board works/graphics and official seals are restricted; plain hyperlinks are permitted but framing is not.
- [BEA copyright FAQ](https://www.bea.gov/help/faq/147) and [linking policy](https://www.bea.gov/about/policies-and-information/linking): BEA information is generally public-domain unless noted, BEA credit appreciated and direct linking accepted without implying commercial endorsement. The **BEA policy permits its logo specifically as a link-identity aid**, but our safer first-stage proposal **excludes logos entirely**.
- [BLS linking/copyright notice](https://www.bls.gov/bls/linksite.htm): agency publications are generally public-domain, with previously copyrighted imagery and protected emblems excluded; BLS credit requested.
- [USAGov federal works guidance](https://www.usa.gov/government-copyright): third-party works and government marks may be restricted; U.S. public-domain treatment **does not necessarily apply in other countries**.

These official notices **support a viable source-rights review path without buying market-data licenses** but are not themselves approval of the exact five item/component uses, a cross-border legal opinion, or proof that every media/storage channel is allowed. All **five × nine = 45 use-review flags in #1019** and **seven × seven = 49 flags plus ten release gates in #1020** remain false. A qualified reviewer must decide the exact allowed content/media/geographies, private-history retention and written evidence before any later owner authorization.

## Weekly completeness and holiday/missing Daily decision

The existing Oct 26–30 **pilot** requires five real Monday–Friday published Dailies. This is a conservative rule for one already complete week, **not** an owner-approved permanent holiday policy. Two safe future choices are available:

| Policy | Effect | Status |
| --- | --- | --- |
| A. Strict five published weekday Dailies | Any missing Daily blocks that week's independent Weekly; four-week Monthly later may be blocked by a missing Friday unless an explicitly approved series reset is recorded | Existing pilot behavior only; permanent selection **PENDING** |
| B. Partial source week with explicit exception | One to five **real** published Dailies within Monday–Friday; missing days explicitly recorded; editorial completeness review and exact-source rights PASS; no invented/backfilled editions; Friday publication only after separate approval | **Recommended for review, not approved**, not implemented |

If all Dailies are absent, hold the Weekly. Do not silently skip a Friday or restart the independent Monthly window. A gap should block the Monthly until a separate written owner methodological exception and authenticated historical treatment are approved.

## Future Monthly gate must read trustworthy publication history

A future publisher must fetch from its **trusted, append-only published independent report registry**, not caller-supplied content strings, **all** published independent Weeklies and prior independent Monthly consumption history. The Monthly source IDs must be exactly the first four eligible Fridays after the latest independent Monthly, with no duplicates, missing dates, reused Weeklies or original Score family. Each must contain verified exact-version publication receipts and source rights. A synthetic `publicationStatus:'published'` flag or plausible GitHub URL proves **nothing**.

No Draft validator can authenticate receipts alone. Existing validators explicitly set `publishReady:false` / `releaseAuthorized:false` even for a structurally complete hypothetical four-week example. Trusted publishing/rights integration and owner production approval would require a **new, separately scoped engineering and security review**.

## Stop/go evidence stages (all HOLD today)

| Gate | Evidence needed | Status |
| --- | --- | --- |
| 1. Item-specific source rights | Qualified scoped decision for the five exact items, link/text, third-party components, Romanian/EU/LATAM audience, media and retention | **HOLD** |
| 2. Chronology and editorial provenance | Accepted official issue-time methodology; exact source/date/version and later reviewed claims; three pending claim receipts resolved | **HOLD** |
| 3. Final content/schema and missing-Daily policy | One reviewed versioned independent contract, editorial completeness, copyright/compliance disclosure, immutable source ledger | **HOLD** |
| 4. Future protected Preview/noindex | Separately authorized isolated release-plan QA; authenticate access denial, test no market data and noindex | **NOT AUTHORIZED** |
| 5. Merge and Production | Exact-head CI; explicit owner approval of a particular commit/environment; final legal/publication scope and rollback plan | **NOT AUTHORIZED** |
| 6. Monthly publication | Four genuinely published, consecutive eligible independent Weeklies; no original Score source; trusted immutable receipts | **0/4 — NOT ELIGIBLE** |

**Do not use this document to authorize a release.** The only present authorization is Draft editorial preparation; all original Score, storage/retention, independent Macro Context Panel, and Production rights hold boundaries remain unchanged.
