# Book-Site Bridge current inventory

Status: Phase 0 audit complete on the Preview branch only.

Date: 2026-08-28

## Authoritative book source

The read-only source used for this pass is the uploaded certified digital reader:

- `USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN_DigitalReader_WithBookmarks(1).pdf`
- Edition 1.2
- Production build v5.94
- No ISBN

The implementation preserves the book's operating sequence:

1. read the regime;
2. identify the transmission channel;
3. reach an asset-specific conclusion.

The book already defines the weekly operating framework as the bridge from theory to practice and describes the live companion as a continuation rather than a promotion. The PDF remains unchanged.

## Prior Drive companion package

The Drive register `USD Impact - Book Companion Fix Pass 7 REPO INSERTION READY Register` records a prior package with:

- 72 files;
- 20 routes;
- 16 markdown chapter-body files;
- chapter, quiz, source, route, site-config and metadata registries;
- an install helper, static QA, workflow, risk register, browser plan and release gates;
- a GO decision for repository insertion;
- a NO-GO decision for public release until repository, build, browser and compliance gates passed.

The separate implementation handoff proposed a parallel `/book-companion` route family and explicitly held sitemap, navigation, localization and public release.

The raw ZIP was not available in Drive during this pass. The Drive register states that the ZIP remained in the earlier sandbox. The register and handoff are therefore treated as governance and inventory evidence, not as a file payload to copy blindly.

## Current repository capabilities

The current Astro repository already contains overlapping production-quality capabilities that did not exist in the same form when the prior package was prepared:

- canonical book page at `/book/read-the-dollar-first/`;
- public sample and Start Here learning flow;
- English audiobook route;
- 51-film video-library integration and protected access map;
- Three-Dial Macro Dashboard;
- Dollar Transmission Chain;
- Daily USD Impact editions;
- Weekly USD Impact Score and public methodology;
- weekly and monthly reports;
- compliance, transparency and evidence pages;
- existing validation and release-control scripts.

## Reconciliation decision

Do not insert the old 72-file package as a second product tree.

Reuse its strongest ideas:

- governed chapter metadata;
- reciprocal route relationships;
- static QA;
- compliance gates;
- browser and mobile review;
- English-first release control;
- no sitemap or public navigation before approval.

Use the current repository as the implementation base and make the canonical companion a child of the existing book route:

`/book/read-the-dollar-first/companion/`

The old `/book-companion` path is not created in Phase 1. A future redirect can be approved only if an external or printed dependency is found.

## Phase 1 additions

- governed JSON registries for all 13 chapters, six tools and 19 print aliases;
- reciprocal chapter-to-tool and tool-to-chapter validation;
- companion hub and generated chapter pages;
- reusable explanatory tool layer;
- reusable contextual book-connection card;
- Chapter 3 DXY versus broad USD scenario prototype;
- Chapter 11 Weekly Regime Lab with delayed comparison;
- static `/go/` alias pages suitable for the current static Astro output;
- Preview-only `noindex` treatment;
- no network calls, storage, account changes or new data flows.

## Explicitly unchanged

- master PDF and Drive book files;
- production deployment;
- checkout and Merchant-of-Record integration;
- payments, refunds and pricing operations;
- environment variables and secrets;
- webhooks and databases;
- entitlements and protected content;
- videos and captions;
- ISBN, barcode, imprint and publication metadata.
