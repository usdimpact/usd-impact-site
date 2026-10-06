# Spanish Edition 1.3 — terminology decision register

Status: **CONSTRUCTION AUTHORITY — ACTIVE**  
Date: 2026-10-07  
Applies to: Spanish Edition 1.3 Candidate 1 construction  
Production/publication impact: **NONE — HOLD remains**

## Purpose

Lock only cross-manuscript terminology that must be stable before the 91 `REVISE` and 91 `NEW_TRANSLATION` units are assembled.

Historical Spanish Edition 1.2 remains translation memory only. This register supersedes historical wording only for the terms explicitly listed here.

## Global terminology decisions

| English authority | Spanish Edition 1.3 controlled term | Rule |
| --- | --- | --- |
| hurdle rate | **rentabilidad mínima exigida** | Do not use historical `tasa de descuento`; that is a different financial concept. In compact table labels, `rentabilidad mínima` is allowed only when the longer meaning is already explicit nearby. |
| broad dollar / broad dollar index | **dólar amplio / índice amplio del dólar** | Use `dólar amplio` in prose and `índice amplio del dólar` when referring to a specific index family. |
| funding stress | **estrés de financiación** | Preserve across chapters/glossary. |
| real yields | **rendimientos reales** | Preferred release term. Historical `tasas reales` may remain only where the sentence clearly refers to a rate rather than a bond yield; otherwise normalize to `rendimientos reales`. |
| safe-haven demand | **demanda de refugio** | Use consistently. |
| pass-through | **traspaso a precios** | Use in glossary and explanatory prose; do not leave English `pass-through` as the sole term. |
| trading signal | **señal operativa** | Preferred compliance term. `Señal de trading` may appear only when quoting/contrasting historical wording. |
| trading advice | **asesoramiento de trading** | In compliance text, pair with investment/legal/tax advice as applicable. |
| as-published archive / vintage | **archivo según publicación / versión publicada en su fecha** | Preserve distinction from recalculated history. |
| recalculated history | **historial recalculado** | Never describe as contemporaneous/as-published evidence. |
| current data | **datos actuales** | Compliance language: `verifique los datos actuales antes de utilizar la información`. |
| regime | **régimen** | Keep as the core macro/Score classification term. |

## Score v2 regime labels

Numerical thresholds are immutable. Spanish labels are controlled as follows:

| Threshold | English | Spanish Edition 1.3 |
| --- | --- | --- |
| `>= +1.0` | Strong dollar regime | **Régimen de dólar fuerte** |
| `+0.3 to < +1.0` | Firm dollar regime | **Régimen de dólar firme** |
| `-0.3 to < +0.3` | Neutral / transitional | **Neutral / transitorio** |
| `-1.0 to < -0.3` | Soft dollar regime | **Régimen de dólar moderadamente débil** |
| `< -1.0` | Weak dollar regime | **Régimen de dólar débil** |

Do not translate `soft dollar` literally as `dólar suave`.

## Score v2 methodology terms

| English | Spanish Edition 1.3 |
| --- | --- |
| production sample | muestra de producción |
| sample standard deviation | desviación estándar muestral |
| full production-sample mean | media de toda la muestra de producción |
| clipping | recorte |
| fixed signed weights | ponderaciones fijas con signo |
| Friday-ended weekly level | nivel semanal con cierre de referencia del viernes |
| last observation | última observación disponible |
| robustness diagnostics | diagnósticos de robustez |
| point-in-time record | registro en el momento de publicación |
| descriptive evidence | evidencia descriptiva |
| predictive power | capacidad predictiva |
| failure mode | modo de fallo |
| source freshness | vigencia de las fuentes |
| data hygiene | higiene de datos |
| version control | control de versiones |

Formula identifiers, operators, signs, thresholds, hashes and URLs are never translated.

## Compliance vocabulary

Use this semantic boundary whenever Candidate 2 requires the full compact compliance note:

- contenido educativo e informativo;
- no constituye asesoramiento personalizado de inversión, legal, fiscal ni de trading;
- no constituye una **señal operativa**;
- no constituye una recomendación para comprar o vender valores, materias primas, divisas ni activos digitales;
- las relaciones de mercado son condicionales;
- verifique los **datos actuales** antes de utilizar la información.

This is a semantic template, not an instruction to force identical sentence structure into every chapter when Candidate 2 varies the local wording.

## Existing user-facing market vocabulary

Continue the established USD Impact Spanish preferences where applicable:

- bullish → alcista
- bearish → bajista
- appreciated → apreciar
- declined → retroceder
- rallied → repuntar
- surged → dispararse
- plunged → desplomarse
- consolidated → consolidar
- high volatility → alta volatilidad
- poised for a breakout → listo para romper

These preferences do not override exact source meaning or compliance boundaries.

## Construction rule

When a `REUSE_VERIFIED` historical paragraph contains a globally controlled term that conflicts with this register, preserve the paragraph's meaning but normalize that term during Candidate 1 assembly.

The highest-priority normalization targets are:

- Chapter 7 hurdle-rate units;
- Chapter 11 hurdle-rate unit;
- Chapter 13 hurdle-rate unit;
- Appendix A hurdle-rate glossary unit;
- Chapter 10 / Appendix B Score v2 regime and methodology language.

## Release boundary

This terminology lock does not authorize publication, narration, website localization activation, sitemap/hreflang, member delivery, email, entitlement, commerce, auth, passkey, database or Production changes.

Spanish publication remains **HOLD**.
