# Spanish Edition 1.3 — Phase 2A Governed Print Bridge Audit

Status: **BATCH D AUDIT — LINK TARGETS VERIFIED — PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773  
Verification date: 2026-10-06

## Scope

This file verifies the current governed short-link destinations required by MP-09, MP-18, MP-19 and MP-20.

Verification was read-only against live Production.

It does not authorize changing any redirect destination, publishing Spanish routes, or generating final print QR assets.

## MP-09 — Chapter 10 Weekly Score bridge

Visible book target:

`usd-impact.com/go/score`

Verified live destination:

`https://www.usd-impact.com/score?source=book&edition=1.3&chapter=10`

Observed page identity:

- canonical Score page;
- descriptive cross-asset dollar-pressure dashboard;
- explicit “context, not a signal” boundary;
- links to public methodology and as-published vintage evidence.

**Status:** `TARGET_VERIFIED`

Spanish action remains `NEW_TRANSLATION_REQUIRED` for the visible bridge copy.

---

## MP-09 / MP-18 — Score v2 methodology bridge

Visible book target:

`usd-impact.com/go/methodology`

Verified live destination:

`https://www.usd-impact.com/score/methodology?source=book&edition=1.3&appendix=B`

Observed page identity:

- Score v2 methodology;
- formula, inputs, weights and normalization;
- fixed regime labels;
- missing/freshness/outlier treatment;
- descriptive validation and robustness boundaries;
- as-published-vs-recalculated distinction;
- compliance boundary.

**Status:** `TARGET_VERIFIED`

Spanish visible bridge copy remains `NEW_TRANSLATION_REQUIRED`.

The destination itself is not changed by localization work.

---

## MP-19 — Chapter 3 DXY vs Broad USD practice bridge

Visible book target:

`usd-impact.com/go/c03`

Verified live destination:

`https://www.usd-impact.com/practice/dxy-vs-broad-usd?source=book&edition=1.3&chapter=03`

Observed page identity:

- DXY vs Broad USD Comparator;
- dated completed-week evidence;
- descriptive comparison;
- no current browser market-data retrieval;
- no forecast/recommendation/trading signal;
- current page metadata includes `noindex, nofollow`.

**Status:** `TARGET_VERIFIED`

The noindex state is a search-indexing boundary for the practice preview. It does not invalidate the governed book short link.

Spanish visible bridge copy remains `NEW_TRANSLATION_REQUIRED`.

---

## MP-20 — Chapter 11 Weekly Regime Lab bridge

Visible book target:

`usd-impact.com/go/c11`

Verified live destination:

`https://www.usd-impact.com/practice/weekly-regime?source=book&edition=1.3&chapter=11`

Observed page identity:

- Weekly Regime Lab;
- dated completed-week three-dial evidence;
- browser-local classification workflow;
- exact-week Score revealed separately, not as an answer key;
- no forecast/recommendation/suitability/trading signal;
- current page metadata includes `noindex, nofollow`.

**Status:** `TARGET_VERIFIED`

Spanish visible bridge copy remains `NEW_TRANSLATION_REQUIRED`.

## Redirect acceptance state

| MP | Short link | Live target verified | Destination change authorized |
| --- | --- | --- | --- |
| MP-09 | `/go/score` | PASS | No |
| MP-09 / MP-18 | `/go/methodology` | PASS | No |
| MP-19 | `/go/c03` | PASS | No |
| MP-20 | `/go/c11` | PASS | No |

## Final candidate rule

When a Spanish release candidate is eventually generated:

1. preserve these governed short links in visible text;
2. encode only the governed short links in print QR assets;
3. do not encode long destination URLs;
4. re-run live redirect verification immediately before final candidate acceptance;
5. treat any changed destination, redirect failure, or unexpected target as a release blocker;
6. do not infer Spanish-site publication from the existence of these English/practice destinations.

Publication remains HOLD.
