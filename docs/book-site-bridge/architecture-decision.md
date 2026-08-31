# ADR: canonical book companion architecture

Decision date: 2026-08-28

Status: Accepted for Preview implementation only.

## Context

The book already teaches a durable sequence and expects a live companion. The current site already implements book, framework, Daily, Score, report, audiobook, video and access layers. An earlier Drive package proposed a separate `/book-companion` application with 20 routes, but the live repository has evolved substantially since that package was prepared.

## Decision

Use one canonical product hierarchy:

`/book/read-the-dollar-first/companion/`

The companion is an orchestration layer over the existing site, not a parallel content product.

The learning loop is:

`Read -> Observe -> Practice -> Compare -> Return`

The book remains the durable explanation. The site supplies dated evidence, practice, comparison and precise return paths.

## Architecture

### Canonical registries

- `apps/web/src/data/book-site-bridge/chapters.json`
- `apps/web/src/data/book-site-bridge/tools.json`
- `apps/web/src/data/book-site-bridge/print-links.json`

`index.mjs` exposes lookup helpers. The QA script requires every chapter/tool relationship to be reciprocal.

### Page layer

- companion hub;
- generated chapter companion pages;
- Chapter 3 practice prototype;
- Chapter 11 Weekly Regime Lab prototype;
- static print aliases.

### Reusable UI layer

- `BookToolGuide.astro` standardizes question, why, inputs, three steps, agreement, divergence, limitations, book connection and current evidence;
- `BookChapterBridgeCard.astro` allows a relevant site tool to point back to the exact chapter without generic sales language.

### State and data boundary

Phase 1 uses only local form state. It performs no fetch, storage, authentication, database or analytics operation. The Weekly comparison is a labeled static fixture.

## Options rejected

### Copy the previous 72-file package directly

Rejected because the raw package was not available, the proposed route topology overlaps current site capabilities, and direct insertion would risk duplicate content and stale assumptions.

### Build a separate microsite

Rejected because it would split Learn, Score, reports, video and access governance.

### Build an AI tutor first

Rejected for Phase 1 because grounded content, versioning, privacy and evaluation must exist before an assistant is exposed.

### Patch the master book first

Rejected because printed destinations must be stable and verified before QR codes, page layout or publication metadata are touched.

## Consequences

Positive:

- one governed route hierarchy;
- minimal duplication;
- current tools stay authoritative;
- printed aliases can outlive internal route changes;
- exercises reduce anchoring without claiming predictive value.

Trade-offs:

- static aliases are HTML redirects in the current static Astro output, not host-level 301 redirects;
- prototypes do not yet use live data;
- pages remain `noindex` and outside public navigation pending approval.
