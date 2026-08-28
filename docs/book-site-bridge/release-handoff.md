# Phase 0-1 release handoff

Date: 2026-08-28

Branch: `agent/book-site-bridge-phase-0-1`

Release state: Preview candidate only.

## Completed

- audited the certified book source without modifying it;
- reconciled the Drive Fix Pass 7 package against the current Astro repository;
- selected one canonical companion hierarchy under the existing book route;
- created governed chapter, tool and print-link registries;
- created reciprocal static QA;
- created the companion hub and 13 generated chapter pages;
- created the explanatory tool component and contextual chapter card;
- created the Chapter 3 DXY versus broad USD prototype;
- created the Chapter 11 Weekly Regime Lab prototype;
- created stable static `/go/` aliases;
- documented inventory, gaps, architecture, routes, promotion, QA and handoff.

## Not performed

- no master PDF or Drive book edit;
- no Production deployment;
- no merge to `main`;
- no checkout or payment change;
- no environment, secret, webhook or database change;
- no entitlement or protected-content change;
- no video render or caption change;
- no AI guide;
- no ISBN, barcode, imprint or publication-metadata work;
- no public navigation, sitemap or localization approval.

## Known Preview limitations

- the Chapter 3 prototype is scenario-based and does not fetch live DXY or broad-dollar data;
- the Chapter 11 comparison uses a static fixture and does not read the live Score;
- no progress is stored;
- no analytics are added;
- static aliases use HTML redirect output appropriate to the current static Astro configuration;
- browser, mobile and assistive-technology QA require the deployed Preview.

## Required evidence before any merge request

1. static bridge QA output;
2. existing repository validation output;
3. Preview build status;
4. direct Preview URLs;
5. browser route checks;
6. mobile and keyboard checks;
7. confirmation that existing checkout, account, Score, Daily and report routes are unchanged;
8. explicit user approval for any next phase.

## Next phase candidates, not approved

- wire current dated data into the practice tools;
- add contextual bridge cards to selected existing Score, Daily and report pages;
- add progress storage after privacy review;
- prepare the surgical manuscript patch and QR placements;
- map existing videos to chapters and identify genuine gaps;
- design a grounded AI framework guide behind a disabled flag;
- begin publication identifiers only after route and manuscript freeze.
