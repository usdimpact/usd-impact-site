# Spanish Edition 1.3 — Controlled terminology register

Status: **CONSTRUCTION CONTROL — HOLD**  
Checkpoint date: 2026-10-07  
Applies to: Spanish Edition 1.3 Candidate 1 and all derivative Spanish book/audio/lesson/caption material  
Production impact: **NONE**

## Authority

This register operationalizes the completed paragraph/unit parity audit on main commit:

`bfa23451d0f2273ed86831fb1ac161b814b834d6`

English semantic authority remains Candidate 2:

- build: `v5.95-candidate.2`
- Drive ID: `1MRLH7fhk5lfuFxu_EJBlvfvWQDhcUjME`
- SHA-256: `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666`

Historical Spanish Edition 1.2 remains translation memory only.

## Locked terminology

| English authority | Spanish Candidate 1 term | Rule |
| --- | --- | --- |
| bullish | alcista | preferred market-language equivalent |
| bearish | bajista | preferred market-language equivalent |
| appreciated / appreciation | apreciar / apreciación | use for currency strengthening where natural |
| declined | retroceder / retroceso | context-dependent noun/verb |
| rallied | repuntar / repunte | avoid hype wording |
| surged | dispararse | use only when source intensity supports it |
| plunged | desplomarse | use only when source intensity supports it |
| consolidated | consolidar / consolidación | preserve technical context |
| high volatility | alta volatilidad | fixed |
| breakout | ruptura | avoid literal `rompimiento` |
| poised for a breakout | listo para romper | existing project preference; use only where source carries that meaning |
| funding stress | estrés de financiación | fixed glossary term |
| broad dollar | dólar amplio / índice amplio del dólar | choose form by sentence role; do not substitute DXY |
| real yields | rendimientos reales | preferred release term; historical `tasas reales` may remain only where clearly referring to rates rather than bond yields |
| safe-haven demand | demanda de refugio | fixed |
| opportunity cost | coste de oportunidad | fixed |
| term premium | prima por plazo | fixed |
| translation risk | riesgo de conversión | fixed |
| spare capacity | capacidad ociosa | fixed |
| spot price | precio spot | fixed |
| front month | primer vencimiento | replace historical `mes próximo` when referring to futures contract month |
| benchmark | referencia / precio de referencia | choose by grammatical role; avoid malformed `precio de referenciaing` |
| hurdle rate | **rentabilidad mínima exigida** | locked; do not use historical `tasa de descuento` |
| hurdle-rate effect | efecto de la rentabilidad mínima exigida | fixed construction |
| trading signal | señal de trading | preserve explicit compliance boundary |
| trading advice | asesoramiento de trading | preserve explicit compliance boundary |
| as-published archive / vintage | archivo / versión publicada en su fecha | distinguish from recalculated history |
| recalculated history | historial recalculado | fixed evidence-vintage distinction |
| regime | régimen | fixed |
| regime band | banda de régimen | fixed |
| current data | datos actuales | fixed compliance phrase |
| current-data verification | verificación de datos actuales | fixed |
| Score | Score / USD Impact Score | retain product name; do not translate as `puntuación` when referring to the named product |
| Score v2 | Score v2 | immutable product/version name |
| DXY | DXY | immutable |
| WTI | WTI | immutable |
| BTC / BTCUSD | BTC / BTCUSD | immutable identifiers |
| SPX | SPX | immutable formula identifier |
| VIX | VIX | immutable |
| UST2Y / UST10Y | UST2Y / UST10Y | immutable formula identifiers |

## Hurdle-rate decision

The historical Spanish term `tasa de descuento` is retired for English `hurdle rate`.

Candidate 1 will use:

**rentabilidad mínima exigida**

Reason:

- it denotes the minimum return required to justify choosing one alternative over another;
- it avoids conflation with discount-rate terminology;
- it reads naturally for a Retail LATAM audience while preserving the source concept.

Apply this decision to:

- Chapter 7;
- Chapter 11;
- Chapter 13;
- Appendix A;
- any table, caption, audiobook script, companion lesson or later localization unit that inherits the concept.

## Score terminology and compliance

Do not translate the named product `USD Impact Score` into `Puntuación USD Impact` in Candidate 1.

Use `Score` or `USD Impact Score` as the proper name.

The surrounding explanatory Spanish must make clear that the Score is:

- an educational regime-orientation tool;
- not personalized investment, legal, tax or trading advice;
- not a trading signal;
- not a recommendation to buy or sell;
- not a position-sizing system;
- not evidence of guaranteed or proven future returns.

## Evidence-vintage terminology

Use distinct language for:

1. **archivo publicado en su fecha** / **versión publicada en su fecha** — a dated as-published record;
2. **historial recalculado** — a current recalculation using the present methodology/sample.

Never use `en tiempo real — no reconstruido con visión retrospectiva` for the long recalculated history.

## Formula/specification invariant

The following values are never localized semantically:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

No translation/editorial pass may change:

- variable identifiers;
- signs;
- operators;
- 0.125 weights;
- +/-3.5 clipping;
- regime thresholds;
- methodology authority hashes.

## Retired historical terminology / wording

Do not carry forward:

- `tasa de descuento` for `hurdle rate`;
- `puntuación` as the proper-name translation of USD Impact Score;
- moving-standard-deviation wording for Score v2;
- approximate three-standard-deviation clipping;
- 84.5 / 84,5% hit-rate language;
- 100 / 79.7 / 73.2 regime-performance claims;
- `en tiempo real — no reconstruido con visión retrospectiva` for recalculated history;
- fixed Friday 22:00 UTC language unless independently re-authorized by current operational authority;
- historical public-distribution/release wording not present in Candidate 2.

## Candidate 1 assembly rule

Every mapped unit must be handled exactly once:

- `REUSE_VERIFIED` → carry forward, with terminology normalization permitted;
- `REVISE` → replace using Candidate 2 authority and this terminology register;
- `NEW_TRANSLATION` → translate directly from Candidate 2;
- `RETIRE` → exclude.

No `RETIRE` unit may survive because it happens to exist in Edition 1.2.

## Release boundary

This register authorizes construction only.

It does **not** authorize:

- public Spanish publication;
- `/es/` routes;
- sitemap/hreflang;
- Spanish audiobook release;
- marketing email;
- default Spanish captions;
- entitlement/commerce/auth changes;
- Production localization activation.
