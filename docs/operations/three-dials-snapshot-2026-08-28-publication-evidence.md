# Three Dials snapshot — 2026-08-28 publication evidence

Date: 2026-09-01  
Status: Protected publication evidence; merge not authorized by this record  
Pull request: #428  
Purpose: Preserve the review evidence for the corrected completed-week snapshot and allow the repository's ordinary required pull-request checks to execute on the exact publication candidate.

## 1. Publication candidate identity

- Production base before publication: `6cf4e7434e5d67f0c617e71050f63a66db8aa205`
- Original generated snapshot head, rejected by protected review: `e482933d700a86bc81f0828ad36501dd1efd3e56`
- Corrected generated-data head: `ac906616ac1238c604b62d76c68d2ed0bd7cabc6`
- Completed week: `2026-08-28`
- Source retrieval timestamp preserved from the successful generator run: `2026-09-01T16:43:32.369Z`
- Source workflow run: `33533486529`
- Threshold correction authority: merged PR #427, merge commit `6cf4e7434e5d67f0c617e71050f63a66db8aa205`

This evidence document does not alter the generated snapshot payload. It is added as a fourth, non-user-facing governance file on top of the corrected three-file snapshot candidate.

## 2. Governed generated files

The publication candidate contains exactly these generated data files:

1. `apps/web/public/data/three-dials/archive/2026-08-28.json`
2. `apps/web/public/data/three-dials/latest.json`
3. `apps/web/src/data/three-dials-latest.json`

At corrected generated-data head `ac906616ac1238c604b62d76c68d2ed0bd7cabc6`, all three files resolve to the identical Git blob SHA:

`44dbd01657790f5c2eb39203fabc16a4f46285ad`

The source observations, observation dates, source labels, retrieval timestamp, disclosures, USD Impact Score v2 value, Score week, and source URLs are preserved from the source-retrieved payload produced by run `33533486529`.

## 3. Defect and deterministic correction

The original generated payload recorded the mathematically exact high-yield OAS move from `2.70%` to `2.60%` as JavaScript binary value `-10.000000000000009` basis points. The published flat/contained boundary is exactly `10` basis points.

PR #427 added a narrowly bounded `1e-9` threshold-boundary normalization. Exact equality remains inside the published flat/contained band, while genuinely beyond-boundary changes remain directional. No published threshold was changed.

The corrected deterministic outputs are:

- High-yield OAS component: `contained`
- VIX component: `contained`
- SOFR–IORB component: `contained`
- Liquidity-stress direction: `contained`
- Liquidity confirmation: `broad`
- Liquidity evidence confidence: `high`
- Interpretation sentence: `The completed week showed a firmer DXY reading with confirmed broad-dollar confirmation, 10-year real yields flat, and liquidity stress stayed contained.`

The underlying stored observation remains `-10.000000000000009` basis points and displays as `-10 bp`; only the deterministic classification at the exact published boundary changed.

## 4. Provenance limitation

No fresh external-source fetch is claimed for the corrected replacement candidate.

The connected action surface did not expose a new workflow-dispatch mutation, and the isolated execution environment could not reach the approved external source hosts. The corrected candidate was therefore deterministically re-materialized on corrected current `main` from the exact source-retrieved payload already produced and validated by successful workflow run `33533486529`.

Protected review of the original generated PR #426 found no defect in source values, source dates, source labels, source URLs, Score provenance, disclosures, retrieval timestamp, or generated-path scope. It found only the threshold-boundary classification defect corrected by PR #427. PR #426 was closed unmerged and is retained as historical evidence.

## 5. Validation evidence before this record

The corrected data-only head `ac906616ac1238c604b62d76c68d2ed0bd7cabc6` completed:

- Vercel Preview `dpl_4Qqk9rXtnAan5KeYNGTe7qqqWvvU`: `READY`, Preview only, no alias error
- Full repository validation: PASS
- Three Dials exact-boundary regression: PASS
- Transparency-page and source/public byte-parity contract: PASS
- Production-style build: PASS, 212 pages
- Candidate 2 private-book and protected-access regressions: PASS
- Manually dispatched Web quality run `33539465310`, job `validate-and-build`: SUCCESS
- Manually dispatched generated-data dependency review run `33539625777`, job `Dependency review`: SUCCESS

The manual exact-head checks did not clear the separate required pull-request checks because the ordinary workflows intentionally ignored generated Three Dials JSON-only changes.

## 6. Required-check purpose of this document

This document is intentionally located outside the generated-data `paths-ignore` filters. Its addition allows the ordinary pull-request event copies of:

- `.github/workflows/quality.yml`, job context `validate-and-build`
- `.github/workflows/dependency-review.yml`, job context `Dependency review`

to run normally on the new exact PR head.

This is not a ruleset bypass. The active required checks remain authoritative and must complete successfully on the exact successor head before a merge can be considered.

The three generated JSON files must remain byte-for-byte unchanged from blob SHA `44dbd01657790f5c2eb39203fabc16a4f46285ad` throughout this evidence-only update.

## 7. Protected publication boundary

This evidence record does not authorize merging PR #428.

Before merge, the successor exact head must have:

1. The same three generated JSON blobs verified unchanged.
2. The ordinary `validate-and-build` required check completed successfully.
3. The ordinary `Dependency review` required check completed successfully.
4. Any other exact-head security or quality checks completed without a material finding.
5. A READY Vercel Preview sourced from the exact successor head.
6. A separate explicit owner approval naming the exact successor head.

Until those conditions are met, Production must continue serving the prior published completed-week snapshot.

## 8. Scope exclusions

This record does not change or authorize changes to:

- USD Impact Score v2 methodology, thresholds, source providers, or source rights
- Commerce, checkout, pricing, payments, purchases, customers, or entitlements
- Supabase data, migrations, buckets, objects, or policies
- Email, secrets, environment variables, or provider configuration
- Drive files, PDFs, ISBN, barcode, print publication, or public file sharing

Candidate 2 remains privately available only to authenticated, eligible Library Pass accounts through entitlement-gated, fail-closed delivery. Its accepted untagged/non-PDF-UA limitation remains restricted to that private delivery, and public distribution, ISBN/barcode, and print publication remain separately gated.

## 9. Final control statement

PR #428 is a protected publication candidate. The corrected Three Dials data may reach Production only after the ordinary required checks and exact-head Preview pass and the owner separately approves the resulting exact head. This document is evidence for that controlled decision; it is not the decision itself.
