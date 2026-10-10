# Spanish Edition 1.3 — Phase 2A Terminology Control

Status: **TERMINOLOGY CONTROL DELTA — NATIVE REVIEW REQUIRED — PUBLICATION HOLD**  
Tracking issue: #772  
Draft PR: #773  
Authority: Session 13E Localization & Terminology Master Kit + multilingual release rules  
Baseline date: 2026-10-06

## Purpose

This file defines the terminology boundary for the Spanish Edition 1.3 parity audit before any release-candidate translation is drafted.

It separates:

1. terminology already controlled by the approved Session 13E localization kit;
2. locked tokens that must not be translated;
3. Candidate 2 concepts that did not exist in the June 2026 terminology baseline and therefore require a controlled terminology decision before release.

This file does not approve public Spanish copy.

## Source authority

Active localization folder:

`08_LOCALIZATION`

Drive folder ID:

`1qKoPXLMY9p_vk1Qz9LInAMkTqk8LKxuR`

Controlled kit:

`USD_Impact_EN_Session13E_Localization_Terminology_Master_Kit_Deliverables.zip`

Drive file ID:

`1Irn5nQyeRpdMKZddLJaWAqaP688smfVF`

The kit records:

- 83 controlled glossary terms;
- 25 locked tokens;
- 12 translation-risk notes;
- 5 compliance phrase sets;
- 128 controlled visual-text rows;
- 9 native-reader QA dimensions.

Its QA decision is PASS for the localization-control baseline, but explicitly **not a translated publication release** and requires native-language review before public localization.

## Existing approved Spanish terminology

The following terms are already controlled by Session 13E and should be treated as the default authority unless a later approved terminology version supersedes them.

| English | Controlled Spanish | Rule / risk |
| --- | --- | --- |
| USD Impact | USD Impact | Locked brand; do not translate |
| Read the Dollar First | Leer primero el dólar | Localized book title only; avoid trading-instruction framing |
| dollar regime | régimen del dólar | High risk; never reduce to DXY |
| U.S. dollar | dólar estadounidense | Use USD in market/data labels |
| USD | USD | Locked token |
| DXY | DXY | Locked token; define on first use |
| U.S. Dollar Index | Índice del dólar estadounidense | Preserve DXY ticker |
| broad dollar | dólar amplio | High risk; broader than DXY |
| broad USD | USD amplio | Use after defining broad dollar |
| trade-weighted dollar | dólar ponderado por comercio | Define for beginner audience |
| dollar funding regime | régimen de financiación en dólares | Preserve global funding meaning |
| dollar liquidity | liquidez en dólares | Do not confuse with DXY direction |
| transmission channel | canal de transmisión | Controlled core educational term |
| market regime | régimen de mercado | Not synonymous with bull/bear direction |
| regime-dependent | dependiente del régimen | Important compliance-safe modifier |
| asset-specific evidence | evidencia específica del activo | Avoid signal language |
| real yields | rendimientos reales / tasas reales | Use bond-yield vs macro context carefully |
| nominal yields | rendimientos nominales | Keep separate from real yields |
| Treasury yields | rendimientos de los Treasuries / rendimientos del Tesoro de EE. UU. | Keep U.S. distinction clear |
| liquidity stress | estrés de liquidez | Not identical to volatility |
| funding stress | estrés de financiación | Add “en dólares” where relevant |
| credit spreads | spreads de crédito / diferenciales de crédito | Finance-native forms both allowed |
| risk appetite | apetito por riesgo | Controlled finance term |
| WTI | WTI | Locked benchmark |
| Bitcoin | Bitcoin | Locked; neutral treatment only |
| equities | acciones / renta variable | Never use false-friend “equidades” |

## Existing approved compliance terminology

| English | Controlled Spanish |
| --- | --- |
| educational only | solo con fines educativos |
| not investment advice | no constituye asesoramiento de inversión |
| not a trading signal | no es una señal de trading |
| not a forecast | no es una previsión / no es un pronóstico |
| not a recommendation | no es una recomendación |
| verify current data | verifica los datos actuales |

### Short chapter-note authority

Session 13E provides this meaning boundary:

- solo con fines educativos;
- no investment/legal/tax/trading advice;
- no recommendation;
- no trading signal;
- market relationships are conditional;
- verify current data before use.

Candidate 2 may require additional wording such as “historical and recalculated evidence does not establish future results.” That additional concept must be translated against current English authority rather than inferred from the older disclaimer.

## Mandatory Session 13E rules

The localization kit requires:

1. do not reduce the dollar regime to DXY;
2. preserve depreciation / devaluation / purchasing-power distinctions;
3. do not translate locked tickers, benchmarks, brand names or index labels unless specifically designated;
4. do not turn dashboards, matrices, scores or checklists into trading signals;
5. preserve compliance notes in every localized product;
6. perform native-reader QA before public release.

Brand tone must remain:

- precise;
- calm;
- editorial;
- serious;
- institutional;
- compliance-safe.

## Candidate 2 terminology gaps

The following concepts are release-critical in Candidate 2 but are not controlled as dedicated entries in the Session 13E glossary.

They must therefore remain `TERMINOLOGY_REVIEW_REQUIRED` until native Spanish review approves the final term.

| Candidate 2 concept | Phase 2A state | Proposed working Spanish — NOT YET APPROVED | Risk / note |
| --- | --- | --- | --- |
| as-published archive | `TERMINOLOGY_REVIEW_REQUIRED` | archivo de versiones publicadas | Must mean what was actually released on the date, not reconstructed history |
| as-published vintage | `TERMINOLOGY_REVIEW_REQUIRED` | versión publicada en su fecha / versión publicada original | Must preserve vintage/evidence meaning, not generic “edición” |
| recalculated history | `TERMINOLOGY_REVIEW_REQUIRED` | historial recalculado | Must distinguish from publication archive |
| current recalculation | `TERMINOLOGY_REVIEW_REQUIRED` | recálculo actual | Do not imply real-time publication |
| current research view of the past | `TERMINOLOGY_REVIEW_REQUIRED` | visión de investigación actual del pasado | Prefer natural native wording after review |
| full-sample normalization | `TERMINOLOGY_REVIEW_REQUIRED` | normalización con la muestra completa | Critical methodology term |
| expanding full sample | `TERMINOLOGY_REVIEW_REQUIRED` | muestra completa en expansión | Must convey sample grows through time |
| point-in-time normalization | `TERMINOLOGY_REVIEW_REQUIRED` | normalización punto en el tiempo | Native finance/statistics review required |
| out-of-sample record | `TERMINOLOGY_REVIEW_REQUIRED` | registro fuera de muestra | Do not overstate as predictive validation |
| robustness evidence | `TERMINOLOGY_REVIEW_REQUIRED` | evidencia de robustez | Keep descriptive/testing boundary |
| specification risk | `TERMINOLOGY_REVIEW_REQUIRED` | riesgo de especificación | Statistical-model meaning |
| contribution concentration | `TERMINOLOGY_REVIEW_REQUIRED` | concentración de contribuciones | Score-component context |
| leave-one-driver-out | `TERMINOLOGY_REVIEW_REQUIRED` | exclusión de un factor cada vez | Prefer explanation over awkward literal translation |
| threshold sensitivity | `TERMINOLOGY_REVIEW_REQUIRED` | sensibilidad a los umbrales | Fixed regime bands context |
| source provenance | `TERMINOLOGY_REVIEW_REQUIRED` | procedencia de las fuentes / trazabilidad de las fuentes | Choose one controlled form after review |
| freshness gate | `TERMINOLOGY_REVIEW_REQUIRED` | control de vigencia / umbral de vigencia | Avoid unnatural literal “puerta de frescura” |
| publication freshness limit | `TERMINOLOGY_REVIEW_REQUIRED` | límite de vigencia para publicación | Dated-source meaning |
| evidence artifact | `TERMINOLOGY_REVIEW_REQUIRED` | artefacto de evidencia / registro de evidencia | Prefer natural audit-language form |
| revision sensitivity | `TERMINOLOGY_REVIEW_REQUIRED` | sensibilidad a revisiones | Provider-history / normalization revisions |
| descriptive weekly regime indicator | `TERMINOLOGY_REVIEW_REQUIRED` | indicador semanal descriptivo del régimen | Must not become “predictive indicator” |

These proposed working forms are audit aids only. They are not a final translation glossary.

## Score regime-label terminology gap

Candidate 2 now uses five fixed English labels:

- Strong dollar regime
- Firm dollar regime
- Neutral / transitional
- Soft dollar regime
- Weak dollar regime

Session 13E controls `dollar regime → régimen del dólar` but does not provide authoritative Spanish names for these five published Score bands.

Therefore all five labels are:

`TERMINOLOGY_REVIEW_REQUIRED`

Possible working forms for native review, not final authority:

| English band | Working Spanish — NOT APPROVED |
| --- | --- |
| Strong dollar regime | régimen de dólar fuerte |
| Firm dollar regime | régimen de dólar firme |
| Neutral / transitional | neutral / de transición |
| Soft dollar regime | régimen de dólar débil moderado / régimen de dólar suave |
| Weak dollar regime | régimen de dólar débil |

The `Soft` vs `Weak` distinction is especially high risk in Spanish because a literal pair can sound unnatural or fail to convey ordered regime strength. Native review must approve a pair that preserves the five-band ordering without introducing a trading implication.

No final Spanish candidate should use these labels until this specific decision is closed.

## High-risk translation rules for Phase 2

### Score is not a signal

Never translate Score/dashboard language into:

- señal operativa;
- señal de compra/venta;
- recomendación;
- pronóstico de dirección;
- sistema de trading.

Use the Session 13E compliance boundary.

### Recalculated is not as-published

Never use one Spanish term for both records.

A reader must be able to distinguish:

- evidence of what was actually released on a date; and
- a present-day recalculation of historical data.

### Historical evidence is not predictive validation

Do not translate:

- descriptive validation;
- robustness evidence;
- retrospective illustration;

as proof that the system “acertó”, “predijo”, or “demostró precisión” unless the current English authority itself makes that claim.

Candidate 2 deliberately does not.

### Methodology language must remain statistical, not promotional

Terms such as:

- normalization;
- clipping;
- sample standard deviation;
- fixed weights;
- regime thresholds;
- source freshness;
- specification risk;

must be translated as methodology concepts, not simplified into performance language.

## Multilingual release rules

The active multilingual rules require:

- English remains canonical unless a newer approved canonical source exists;
- unreleased languages remain hidden from navigation and sitemap;
- structure, compliance notes and source references must be preserved;
- factual claims must not be localized without verification;
- localized output must be compared against English rather than rated in isolation;
- native readability is mandatory;
- no language may publish below **90/100**.

The suggested 100-point release score is:

| Dimension | Weight |
| --- | ---: |
| Structure parity | 20 |
| Native readability | 20 |
| Compliance | 20 |
| Source discipline | 15 |
| Layout / UX | 15 |
| Metadata / hreflang / internal links | 10 |

The 90/100 floor is necessary but not sufficient: a critical compliance, methodology, source, or completeness failure remains a release blocker even if aggregate scoring is high.

## Translation-candidate gate

Before the first controlled Spanish Candidate 1.3 draft begins:

1. approve Spanish terminology for all Candidate 2 terminology gaps above;
2. specifically approve the five Score regime labels as an ordered set;
3. preserve all Session 13E locked tokens;
4. pin one Spanish form for as-published vs recalculated records;
5. pin one Spanish form for source provenance and freshness;
6. apply the approved compliance phrase bank;
7. mark terminology version/date in the candidate metadata;
8. keep the candidate private and unpublished;
9. require native-reader review before any release decision.

## Publication boundary

Nothing in this terminology-control document changes:

`LOCALE_POLICY.es.publicationEnabled === false`

No public `/es/` route, Spanish sitemap/hreflang activation, Spanish book/audiobook delivery, marketing email, entitlement, commerce, auth/passkey, Supabase, or caption-default change is authorized.
