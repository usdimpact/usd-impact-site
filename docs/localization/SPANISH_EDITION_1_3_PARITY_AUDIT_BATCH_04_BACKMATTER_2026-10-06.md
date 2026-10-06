# Spanish Edition 1.3 parity audit — Batch 04: Further Reading, Appendices, Author, Index

Status: **FIRST-PASS STRUCTURAL / GOVERNED-PATCH AUDIT COMPLETE — HOLD**  
Checkpoint date: 2026-10-06  
Production impact: **NONE**  
Historical Spanish artifact mutation: **NONE**

## Scope

Fresh comparison of English Candidate 2 against historical Spanish Edition 1.2 for:

- Further Reading;
- Appendix A / Quick Glossary;
- Appendix B / USD Impact Score Methodology;
- About the Author;
- Index and final-layout dependencies.

This closes the first-pass structural and governed-patch audit from front matter through back matter. It does **not** claim complete paragraph-level parity.

## Batch result

| Area | State | Confirmed reason |
| --- | --- | --- |
| Further Reading | PARAGRAPH_AUDIT_REQUIRED | current list must be checked item-by-item before reuse |
| Appendix A / glossary overall | REVISE | historical glossary contains current and obsolete units mixed together |
| Appendix A — USD Impact Score entry | RETIRE + REPLACE | obsolete normalization, clipping and fixed performance claims remain |
| Appendix B | NEW_TRANSLATION | entire release section is absent from Spanish Edition 1.2 |
| MP-12 through MP-17 | NEW_TRANSLATION | governed Appendix B methodology/evidence units have no Spanish release authority |
| MP-18 methodology bridge | NEW INSERTION | absent from Spanish 1.2 |
| About the Author | PARAGRAPH_AUDIT_REQUIRED | source-currentness and release wording must be checked before reuse |
| Index | REBUILD_AFTER_LAYOUT | historical page ranges cannot survive new Appendix B/current pagination |
| TOC / page references / bookmarks / links | REBUILD_AND_QA_AFTER_LAYOUT | final Spanish candidate structure changes pagination/navigation |

## Further Reading

The current Candidate 2 Further Reading section remains a curated source list tied to the present English edition.

Historical Spanish has a Further Reading section, but this checkpoint does not certify its entries one-by-one against Candidate 2.

Disposition: **PARAGRAPH_AUDIT_REQUIRED**.

Before release, verify:

- title/author/source identity;
- whether any item was added, removed or re-described;
- whether the Spanish annotation preserves the English evidentiary meaning;
- whether any URL/reference is current where the final edition exposes one.

## Appendix A — Quick Glossary

Historical Spanish Appendix A contains many useful translation-memory units, but the appendix is not safe for wholesale reuse.

### Confirmed obsolete `USD Impact Score` entry

The historical Spanish glossary currently says the Score:

- normalizes each input using a `desviación estándar móvil`;
- clips at approximately three standard deviations;
- was tested over five regimes with an aggregate `84,5 %` hit rate;
- reports regime figures `100, 100, 100, 79,7, 73,2`.

All of that is incompatible with Candidate 2 / Score v2 authority.

Disposition for the historical `USD Impact Score` glossary unit:

**RETIRE + REPLACE**

The replacement must align with the current authority:

- eight Friday-ended production levels;
- full production-sample mean;
- sample standard deviation;
- post-z-score clipping at +/-3.5;
- fixed signed absolute weights of 0.125;
- five fixed regime bands;
- recalculated-history versus as-published-vintage distinction;
- educational regime-reading tool, not forecast or trading signal.

### Other glossary units

Other historical Spanish glossary entries remain translation memory only until item-level comparison. Some page references already point to the old Spanish pagination and therefore cannot be certified before final layout.

Disposition for remaining glossary entries:

**PARAGRAPH_AUDIT_REQUIRED** unless separately classified.

## Appendix B — USD Impact Score Methodology

Candidate 2 contains a dedicated Appendix B. Historical Spanish Edition 1.2 has **no Appendix B release section**.

Therefore Appendix B cannot be reconstructed by editing an existing Spanish appendix. It requires a new controlled translation from the exact current English authority.

Disposition: **NEW_TRANSLATION**

### Required Appendix B governed units

The new Spanish Appendix B must include the Candidate 2 authority for:

- purpose and scope of the Score;
- eight production inputs and fixed signs;
- MP-12 production provider disclosure;
- MP-13 normalization and formula;
- MP-14 five fixed regime labels;
- MP-15 validation-evidence interpretation;
- MP-16 data hygiene / vintage / version-control distinction;
- MP-17 reader audit checklist;
- MP-18 live methodology print bridge.

### Formula authority

The translation must preserve the formula semantically and numerically:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Do not localize variable identifiers, signs, weights, thresholds or formula operators in a way that changes reproducibility.

### Regime-band authority

| Score | Spanish release label to translate from current English authority |
| --- | --- |
| `>= +1.0` | Strong dollar regime |
| `+0.3 to < +1.0` | Firm dollar regime |
| `-0.3 to < +0.3` | Neutral / transitional |
| `-1.0 to < -0.3` | Soft dollar regime |
| `< -1.0` | Weak dollar regime |

The final Spanish terminology must be terminology-reviewed before release. The numerical thresholds are immutable under localization.

### MP-18 governed bridge

Required visible destination:

`usd-impact.com/go/methodology`

Historical Spanish 1.2 contains no equivalent current methodology bridge.

Disposition: **NEW INSERTION**

## About the Author

Historical Spanish uses project-level author wording and release-channel language. It remains potentially useful translation memory, but this batch does not certify it against the current Candidate 2 author block sentence-by-sentence.

Disposition: **PARAGRAPH_AUDIT_REQUIRED**

Any final author/about wording must remain consistent with the site's current educational positioning and must not imply a public release state that has not been authorized.

## Index and navigation

The historical Spanish index explicitly identifies itself with the older Spanish final-freeze/session pagination and points to old page ranges.

A new Spanish candidate will add Appendix B and incorporate current governed insertions. Therefore the historical index cannot be patched safely in place.

Disposition: **REBUILD_AFTER_LAYOUT**

The same rule applies to:

- table of contents page numbers;
- chapter cross-references;
- printed page references;
- bookmark destinations;
- internal hyperlinks;
- index ranges;
- QR/link placement verification.

These must be generated or revalidated only after the Spanish manuscript reaches stable layout.

## First-pass audit closeout

The first-pass structural/governed-patch audit now covers:

1. front matter and Introduction;
2. Chapters 1-3;
3. Chapters 4-9;
4. Chapters 10-13;
5. Further Reading;
6. Appendix A;
7. Appendix B;
8. About the Author;
9. Index/layout dependencies.

### What this first pass establishes

It establishes where historical Spanish 1.2 is structurally unsafe, where governed Candidate 2 changes are missing, where obsolete methodology/performance language must be retired, and where new translation is required.

### What this first pass does not establish

It does **not** establish that every unaffected Spanish paragraph is semantically current.

The next phase remains the true paragraph/unit reconciliation:

- map every Candidate 2 unit to Spanish translation memory;
- assign `REUSE_VERIFIED`, `REVISE`, `NEW_TRANSLATION`, or `RETIRE`;
- record source/version/reviewer/terminology/compliance state;
- only then assemble a new Spanish release-candidate source.

## Release boundary

Publication remains **HOLD**.

No action in this audit authorizes:

- public `/es/` routes;
- sitemap/hreflang;
- Spanish book/audiobook member delivery;
- Spanish marketing email;
- Spanish default captions;
- Production database/config changes;
- entitlement/commerce/auth/passkey changes;
- public Drive sharing;
- replacement of historical Spanish 1.2.

This batch is evidence only.
