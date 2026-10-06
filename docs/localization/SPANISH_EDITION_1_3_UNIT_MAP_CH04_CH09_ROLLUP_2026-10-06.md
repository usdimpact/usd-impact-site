# Spanish Edition 1.3 paragraph parity — Chapters 4-9 rollup

Status: **PARAGRAPH AUDIT IN PROGRESS — HOLD**  
Checkpoint date: 2026-10-06  
Scope: Chapters 4-9  
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

| Chapter | Total units | REUSE_VERIFIED | REVISE | NEW_TRANSLATION | RETIRE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chapter 4 | 46 | 40 | 5 | 0 | 1 |
| Chapter 5 | 44 | 40 | 4 | 0 | 0 |
| Chapter 6 | 40 | 36 | 4 | 0 | 0 |
| Chapter 7 | 41 | 33 | 8 | 0 | 0 |
| Chapter 8 | 42 | 37 | 5 | 0 | 0 |
| Chapter 9 | 34 | 30 | 4 | 0 | 0 |
| **Total** | **247** | **216** | **30** | **0** | **1** |

The totals above were mechanically checked against the status rows in all six unit-map files.

## Controlling unit maps

- `SPANISH_EDITION_1_3_UNIT_MAP_CH04_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH05_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH06_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH07_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH08_2026-10-06.md`
- `SPANISH_EDITION_1_3_UNIT_MAP_CH09_2026-10-06.md`

## Cross-chapter findings

### Generic historical headings

Spanish Edition 1.2 repeatedly uses `El error frecuente` where Candidate 2 has more specific chapter headings. These are `REVISE`, not reusable headings:

- Chapter 4: `The universal-minus-sign trap`
- Chapter 5: `The shortcut that fails`
- Chapter 6: `The anti-dollar shortcut`
- Chapter 7: `Where the monetary thesis gets misread`
- Chapter 8: `The regional-market trap`
- Chapter 9: `The FX shortcut`

### Compliance tails

All six chapters require replacement with the complete Candidate 2 compliance boundary. Historical Spanish endings do not consistently preserve all of:

- not personalized investment, legal, tax or trading advice;
- not a trading signal;
- not a recommendation;
- conditional market relationships;
- verify current data before use.

### Reference blocks

All six selected-reference blocks remain `REVISE` for release assembly. The final Spanish candidate must rebuild source presentation from Candidate 2 and re-check external destinations/currentness.

### Bounded substantive translation defects

Fresh unit-level review found several specific defects that structural comparison alone could not detect:

- Chapter 4: historical gold paragraph has a sentence-start casing defect; Chapter 3 printed page reference is stale.
- Chapter 5: duplicated benchmark wording in the WTI paragraph; EIA `Balance` reference is paired with the OPEC-supply URL and the separate Candidate 2 Supply-OPEC reference is omitted.
- Chapter 6: the historical Spanish translation of Candidate 2's persistent official-sector demand/support meaning uses `oferta estructural`, reversing the intended market-side direction.
- Chapter 7: `hurdle rate` is rendered as `tasa de descuento`, which is not a safe semantic equivalent; a controlled terminology choice is required across Chapter 7 and Appendix A. Historical text also contains malformed `reprecios`.
- Chapter 8: grammatical defect `una referencia legítimo`; worked gas-spread example requires source/currentness verification before release.
- Chapter 9: malformed `reprecioando` in the broad-dollar versus bilateral-pair paragraph.

### Historical-only retirement

Chapter 4 historical Spanish contains:

`Figura 4.1 — Transmisión del dólar a los cinco bloques de activos`

No equivalent release unit appears in Candidate 2. Current disposition: `RETIRE` unless a later authoritative Candidate 2 layout source proves otherwise.

## Interpretation of REUSE_VERIFIED

`REUSE_VERIFIED` means the historical Spanish unit has been freshly compared against Candidate 2 and can serve as current semantic translation authority for that unit.

It does not waive:

- global terminology review;
- final compliance review;
- typography/punctuation normalization;
- external source/link verification;
- final page-number regeneration;
- navigation/bookmark QA;
- layout QA;
- explicit owner release approval.

## Next controlled phase

Continue unit mapping through Chapters 10-13, then back matter and Appendix B.

Because Chapter 10 and Appendix B contain governed Score v2 methodology/evidence changes, those sections must remain stricter than ordinary translation-memory reuse.

Publication remains **HOLD**.
