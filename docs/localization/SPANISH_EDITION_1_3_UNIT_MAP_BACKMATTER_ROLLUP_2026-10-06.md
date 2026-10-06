# Spanish Edition 1.3 paragraph parity — Back matter rollup

Status: **PARAGRAPH / TERMINOLOGY AUDIT COMPLETE FOR BACK MATTER — HOLD**  
Checkpoint date: 2026-10-06  
Scope: Further Reading, Appendix A, Appendix B, About the Author, Index  
Production impact: **NONE**

## Source authority

English:
- Candidate 2 / `v5.95-candidate.2`
- Drive ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`

Historical Spanish translation memory:
- Edition 1.2
- Drive ID: `1CMZbSegsxIncuyldqiLyXJFW05gT4WOc`

## Unit-map coverage

| Area | Total units | REUSE_VERIFIED | REVISE | NEW_TRANSLATION | RETIRE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Further Reading | 17 | 16 | 1 | 0 | 0 |
| Appendix A | 67 | 54 | 5 | 1 | 7 |
| Appendix B | 56 | 0 | 0 | 56 | 0 |
| About the Author + Index | 8 | 4 | 2 | 1 | 1 |
| **Back-matter total** | **148** | **74** | **8** | **58** | **8** |

The counts above were mechanically checked against the registered status rows.

## Controlling unit maps

- `SPANISH_EDITION_1_3_UNIT_MAP_FURTHER_READING_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_APPENDIX_A_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_APPENDIX_B_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_AUTHOR_INDEX_2026-10-06.md`

## Further Reading

Historical Spanish translation memory is broadly current.

Required work is bounded to:

- one grammar correction in the introduction;
- later reference-currentness verification for external resources;
- final typography/layout normalization.

## Appendix A — glossary

Appendix A becomes the controlling Spanish terminology layer for recurring technical language.

Key decisions:

- historical `USD Impact Score` glossary block: **RETIRE**;
- historical Spanish-only Brent/Cushing/Multiactivo/DTWEXBGS/DFII10/DHHNGSP glossary expansions: **RETIRE** unless a later explicit release decision restores them;
- Candidate 2 `Why this appendix helps` block: **NEW_TRANSLATION**;
- EIA, Treasury bill and glossary-introduction units: **REVISE**;
- `hurdle rate` historical translation `tasa de descuento`: **REVISE** and resolve globally.

### Hurdle-rate terminology rule

The final Spanish term must mean a minimum required/threshold return versus the next-best alternative, not a discount rate.

Once selected, apply consistently across:

- Appendix A;
- Chapter 7;
- Chapter 11;
- Chapter 13;
- captions/tables/audio/lesson copy using the concept.

## Appendix B — complete controlled translation

Historical Spanish Edition 1.2 has no Appendix B release authority.

All **56** Appendix B units are therefore `NEW_TRANSLATION`.

### Immutable methodology block

The Spanish candidate must preserve exactly:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Regime thresholds:

- `>= +1.0`
- `+0.3 to < +1.0`
- `-0.3 to < +0.3`
- `-1.0 to < -0.3`
- `< -1.0`

No localization step may alter signs, operators, weights, variable identifiers, start date, clipping threshold, threshold boundaries or authority hashes.

### Governed bridges and authority hashes

Current repository control documents confirm:

- `usd-impact.com/go/score`
- `usd-impact.com/go/methodology`
- publication-candidate website authority hash: `a86e57dafe91da67553e73e01bb0c703a868c949`
- Score-pipeline authority hash: `f51f7abf2d4ec99890eb5537424f6faab885ef32`

Those values remain release-control inputs and must not be localized or reformatted in a way that changes them.

## About the Author

The project-level institutional author profile is reusable translation memory.

Final release still requires:

- current wording/source-state review;
- typography/layout QA;
- no implication of a public Spanish release before explicit authorization.

## Index / navigation

Historical Spanish index page ranges are not reusable.

Required treatment:

- index introduction: **REVISE**;
- index body: **REVISE**;
- historical page ranges: **RETIRE**;
- final generated page/bookmark/navigation layer: **NEW_TRANSLATION / BUILD AFTER LAYOUT**.

Do not patch old page ranges during translation.

After the Spanish manuscript reaches stable layout:

1. render final pagination;
2. generate current index terms/ranges;
3. validate controlled terminology;
4. validate Appendix A/B references;
5. validate bookmarks/internal links;
6. run page-by-page QA.

## Whole-manuscript parity state after this rollup

The paragraph/unit audit now has controlled maps for:

- Chapters 1-3;
- Chapters 4-9;
- Chapters 10-13;
- Further Reading;
- Appendix A;
- Appendix B;
- About the Author;
- Index.

The remaining work is no longer discovery. It is controlled execution:

1. resolve global terminology decisions;
2. produce all `NEW_TRANSLATION` units;
3. revise all `REVISE` units;
4. exclude all `RETIRE` units;
5. assemble one Spanish Candidate 1 source;
6. run compliance/reference/link QA;
7. render stable layout;
8. regenerate page references/index/navigation;
9. run final visual/content QA;
10. request explicit owner release approval.

## Release boundary

Publication remains **HOLD**.

No public Spanish route, sitemap/hreflang, member delivery, audiobook release, default-caption switch, marketing email, entitlement change, commerce change, auth change or Production localization activation is authorized by this rollup.
