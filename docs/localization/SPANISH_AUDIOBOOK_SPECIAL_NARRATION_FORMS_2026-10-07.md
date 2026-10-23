# Spanish Audiobook — Special Narration Forms for Score & Formula Sections — 2026-10-07

Status: **LOCKED FOR PRIVATE MATEO SYNTHESIS / NO RELEASE**

Purpose: define deterministic spoken forms for Chapter 10 and Appendix B so mathematical notation, score bands and slash notation are narrated consistently without changing the written Spanish source.

## General rule

The written Candidate 1 remains authoritative. Spoken adaptations below are pronunciation/aural-clarity transforms only. They do not alter the mathematics, thresholds, signs, weights, or compliance meaning.

## Chapter 10 — Score formula

Written source:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

Approved spoken form:

> Z de i, t, T es igual a clip de x de i, t, menos la media de i, T, dividido por la desviación estándar de i, T; recortado entre menos tres coma cinco y más tres coma cinco.

Written source:

`Score = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Approved spoken form:

> La Score es igual a cero coma ciento veinticinco multiplicado por: DXY, menos WTI, menos S P X, más VIX, menos B T C, menos oro, más el rendimiento del Treasury a dos años, más el rendimiento del Treasury a diez años.

Narration notes:

- `GOLD` is spoken as `oro`, because the surrounding Spanish prose names the asset rather than requiring the ticker-like English word.
- `UST2Y` is spoken as `rendimiento del Treasury a dos años`.
- `UST10Y` is spoken as `rendimiento del Treasury a diez años`.
- The factor `0.125` must also be described later exactly as `doce coma cinco por ciento` where the prose states the absolute weight of each component.
- Do not paraphrase the sign pattern.
- Do not call the formula predictive.

## Chapter 10 — regime bands

Written thresholds and approved spoken forms:

- `>= +1.0` → `igual o superior a más uno coma cero: régimen de dólar fuerte`
- `+0.3 a < +1.0` → `desde más cero coma tres hasta menos de más uno coma cero: régimen de dólar firme`
- `-0.3 a < +0.3` → `desde menos cero coma tres hasta menos de más cero coma tres: neutral o transición`
- `-1.0 a < -0.3` → `desde menos uno coma cero hasta menos de menos cero coma tres: régimen de dólar blando`
- `< -1.0` → `por debajo de menos uno coma cero: régimen de dólar débil`

Follow immediately with the source disclaimer that these are descriptive specification bands, not probabilities, confidence intervals or trading triggers.

## Appendix B — normalization formula

Written source:

`z(i,t,T) = clip((x(i,t) - mean(i,T)) / sd(i,T), -3.5, +3.5)`

Use the same approved spoken form as Chapter 10.

For the explanatory sentence:

- `mean(i,T)` → `la media de i, T`
- `sd(i,T)` → `la desviación estándar muestral de i, T`
- `2015-01-01` → `uno de enero de dos mil quince`

## Appendix B — production Score formula

Written source:

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

Approved spoken form:

> La Score de t, T es igual a cero coma ciento veinticinco multiplicado por: DXY, menos WTI, menos S P X, más VIX, menos B T C, menos oro, más el rendimiento del Treasury a dos años, más el rendimiento del Treasury a diez años.

The following sentence:

`Los ocho pesos absolutos son 0.125. Los valores estandarizados de los componentes se recortan después del z-score en -3.5 y +3.5.`

Approved spoken form:

> Los ocho pesos absolutos son cero coma ciento veinticinco, equivalentes a doce coma cinco por ciento cada uno. Los valores estandarizados de los componentes se recortan después del z-score entre menos tres coma cinco y más tres coma cinco.

The added equivalence `doce coma cinco por ciento cada uno` is permitted only because Chapter 10 states that exact equivalence explicitly; it must not replace the numeric `0.125` statement.

## Appendix B — regime table

Narrate the table row-by-row:

1. `Puntuación igual o superior a más uno coma cero. Etiqueta publicada: régimen de dólar fuerte.`
2. `Puntuación desde más cero coma tres hasta menos de más uno coma cero. Etiqueta publicada: régimen de dólar firme.`
3. `Puntuación desde menos cero coma tres hasta menos de más cero coma tres. Etiqueta publicada: neutral o transición.`
4. `Puntuación desde menos uno coma cero hasta menos de menos cero coma tres. Etiqueta publicada: régimen de dólar blando.`
5. `Puntuación por debajo de menos uno coma cero. Etiqueta publicada: régimen de dólar débil.`

Do not read comparison symbols as isolated punctuation.

## Slash notation in remaining tracks

Approved spoken forms:

- `EUR/USD` → `euro frente al dólar`
- `USD/JPY` → `dólar frente al yen japonés`
- `USD/MXN` → `dólar frente al peso mexicano`
- `BTC/USD` → `Bitcoin frente al dólar`
- `CME/NYMEX` → `CME y NYMEX`
- `Fed H.10 / ICE DXY` → `Fed H punto diez e ICE DXY`
- `Fed / FRED` → `Fed y FRED`
- `CME / Cboe` → `CME y Cboe`
- `EIA / operador del mercado` → `EIA y operador del mercado`

## Site shortcut lines

Do not narrate bare navigational shortcuts such as:

- `usd-impact.com/go/score`
- `usd-impact.com/go/methodology`
- `usd-impact.com/go/c11`

Their surrounding spoken instruction may remain, for example `Abre la Weekly Score actual`, but the literal URL is written-only.

## Release boundary

These narration forms are approved for private synthesis preparation only. They do not authorize:

- billing changes;
- provider substitution;
- member upload;
- Production routing;
- public publishing;
- changes to the written Spanish manuscript.
