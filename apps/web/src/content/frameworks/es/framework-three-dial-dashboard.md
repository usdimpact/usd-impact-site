---
title: "Panel Macro de Tres Diales"
metaTitle: "Panel Macro de Tres Diales | USD Impact"
metaDescription: "Un panel semanal para leer la dirección del dólar amplio, la presión de tasas reales y la presión de financiación antes de interpretar los movimientos de los activos."
slug: "/es/framework/three-dial-dashboard"
category: "Framework"
status: "published"
readingLevel: "Principiante a intermedio"
lastReviewed: "2026-10-27"
complianceNote: "Solo con fines educativos. No es asesoramiento de inversión, jurídico, fiscal, de trading ni financiero. No es una recomendación, pronóstico ni señal de trading. El panel organiza condiciones observables; no predice rendimientos."
sources:
  - "Federal Reserve Board H.10 — Nominal Broad Dollar Index"
  - "Federal Reserve Board H.15 — rentabilidad constante del Treasury indexado a inflación a 10 años"
  - "Federal Reserve Bank of New York — Secured Overnight Financing Rate (SOFR)"
  - "Federal Reserve Board — Interest rate on reserve balances (IORB)"
internalLinks:
  - "/es/start-here"
  - "/es/dollar-framework"
  - "/es/framework/dollar-transmission-chain"
hero: "Tres Diales v2: dirección del dólar amplio, presión de tasas reales y presión de financiación antes de la interpretación entre activos."
subhero: ""
---

## Por qué existe Tres Diales v2

El panel mantiene el orden de lectura original de USD Impact y, al mismo tiempo, utiliza un contrato de datos públicos que puede obtenerse y redistribuirse sin depender de licencias pagadas de datos de mercado propietarios.

La versión 2 es un cambio metodológico explícito. **No** rebautiza DXY como dólar amplio y **no** afirma que un solo diferencial de financiación sustituya todas las medidas de crédito, volatilidad o estrés de mercado.

Los diales públicos son ahora:

**Dirección del dólar amplio → Presión de tasas reales → Presión de financiación**

En el marco educativo más amplio, el Dial 1 sigue respondiendo a la pregunta sobre la **dirección del dólar**; la versión 2 define su medida numérica pública como el índice amplio del dólar de la Reserva Federal.

Las observaciones históricas de la versión 1 y las de la versión 2 no deben unirse como si fueran una única serie continua.

---

## Dial 1 — Dirección del dólar amplio

### Medida pública

El dial numérico público utiliza el **Nominal Broad Dollar Index** del Federal Reserve Board, publicado en H.10.

El cambio de la semana completada se clasifica como:

- más firme;
- más débil; o
- en rango.

### Por qué usar dólar amplio

Una medida amplia ponderada por comercio reduce el riesgo de tratar los movimientos de una cesta pequeña de divisas tradicionales como si representaran todo el régimen del dólar.

DXY sigue siendo un concepto educativo importante. USD Impact continúa explicando qué mide DXY, por qué importa la composición de su cesta y cómo puede divergir de una medida más amplia. Tres Diales v2 simplemente no republica una observación DXY en vivo.

### No hagas esto

No etiquetes el índice de dólar amplio de la Reserva Federal como DXY.

No asumas que todos los activos deben responder en la misma dirección solo porque se movió el dólar amplio.

---

## Dial 2 — Presión de tasas reales

### Medida pública

El dial numérico público utiliza la **rentabilidad constante del Treasury indexado a inflación a 10 años** de H.15 del Federal Reserve Board.

El cambio de la semana completada se clasifica como:

- al alza;
- a la baja; o
- estable.

### Por qué importa

Las tasas reales son un canal importante de coste de oportunidad y tasa de descuento para el oro, las acciones y otros activos sensibles a duración. También ayudan a separar un movimiento del rendimiento nominal impulsado por compensación por inflación de otro impulsado por una reevaluación de las tasas reales.

### No hagas esto

No sustituyas el dial de tasas reales por un rendimiento nominal del Treasury.

Los rendimientos nominales pueden seguir siendo contexto útil en otras partes de USD Impact, pero no son un input adicional de Tres Diales v2.

---

## Dial 3 — Presión de financiación

### Medida pública

El dial numérico público utiliza:

**SOFR − IORB**

expresado en puntos básicos.

SOFR procede del Federal Reserve Bank of New York. IORB es una tasa de política del Federal Reserve Board. USD Impact calcula la diferencia de forma transparente.

El cambio de la semana completada se clasifica como:

- mayor presión;
- menor presión; o
- contenida.

### Qué indica

El diferencial es un indicador compacto de presión en la financiación garantizada a un día frente a la tasa pagada sobre los saldos de reserva. **No es un diferencial de crédito** y no es una medida completa de liquidez o estrés de mercado.

Puede ayudar a detectar si las condiciones de financiación se están volviendo marginalmente más o menos exigentes.

### Qué no indica

SOFR menos IORB **no es**:

- un diferencial de crédito;
- VIX;
- un índice de estrés bancario;
- una medida completa de liquidez de mercado;
- un sustituto de todos los indicadores de apetito por riesgo.

Los diferenciales de crédito, los índices de volatilidad, los indicadores bancarios y otras medidas de liquidez pueden seguir usándose como contexto educativo o de confirmación cuando los derechos y las fuentes lo permitan. Ya no son inputs numéricos en vivo del panel público Tres Diales v2.

---

## La hoja de trabajo semanal

| Dial | Medida pública v2 | Dirección | Base de evidencia |
|---|---|---|---|
| Dirección del dólar amplio | Índice de dólar amplio H.10 de la Reserva Federal | Más firme / más débil / en rango | Una medida de fuente primaria |
| Presión de tasas reales | Rentabilidad real a 10 años H.15 | Al alza / a la baja / estable | Una medida de fuente primaria |
| Presión de financiación | SOFR − IORB | Mayor / menor / contenida | Medida derivada transparente de fuentes primarias permitidas |

El panel no fabrica una etiqueta de “alta confianza” a partir de una sola observación. La versión 2 usa una confianza de evidencia media porque cada dial tiene una medida pública definida.

---

## Convertir las observaciones en una descripción del régimen

Las etiquetas siguen siendo descriptivas, no predictivas.

Ejemplos:

- **Entorno de dólar firme liderado por tasas:** dólar amplio más firme, tasas reales al alza y financiación sin mayor presión.
- **Entorno de dólar firme liderado por financiación:** dólar amplio más firme mientras aumenta la presión SOFR−IORB.
- **Entorno de dólar más débil y más relajado:** dólar amplio más débil, tasas reales a la baja y menor presión de financiación.
- **Entorno mixto o de transición:** las tres medidas no forman una configuración limpia.

Una descripción del régimen es un resumen disciplinado de observaciones completadas. No es una probabilidad sobre el próximo movimiento del mercado.

---

## DXY y la evidencia más amplia de estrés siguen importando conceptualmente

El contrato público de datos de la versión 2 es más estrecho que el marco educativo completo.

DXY puede seguir ayudando a explicar composición de cesta y comportamiento relativo en FX.

Los diferenciales de crédito, los índices de volatilidad, los indicadores bancarios y las medidas de balance pueden seguir ayudando a diagnosticar estrés financiero más amplio.

Esos conceptos siguen formando parte de la educación de USD Impact. Simplemente se separan del panel numérico público propio salvo que exista una base adecuada de derechos de fuente.

Esta separación es deliberada: la amplitud educativa no debe confundirse con permiso de redistribución.

---

## Añade confirmación entre activos después de los diales

Después de registrar los tres diales públicos, revisa cómo se comportaron los principales activos.

Pregunta:

- ¿El oro se comportó de forma coherente con el entorno de tasas reales?
- ¿El petróleo respondió principalmente al dólar o a noticias propias de oferta y demanda?
- ¿Las acciones confirmaron condiciones financieras más fáciles o más exigentes?
- ¿Bitcoin se movió con las condiciones de financiación/riesgo o con flujos específicos de cripto?
- ¿Los principales pares FX apoyaron o cuestionaron la lectura del dólar amplio?

El comportamiento entre activos puede confirmar o cuestionar la interpretación. La confirmación entre activos **no es un dial adicional**.

---

## Cómo se conecta con el Score semanal

El **USD Impact Score v2 semanal** sigue siendo un **indicador sistemático entre activos separado**, con su propia metodología publicada y su propia gobernanza de inputs.

Tres Diales v2 no se convierte en la fórmula del Score.

El Score no sustituye el orden de lectura de los Tres Diales.

La coincidencia entre ambos puede aumentar la coherencia narrativa, pero no demuestra poder predictivo.

---

## Rutina semanal de cinco minutos

1. Registra la dirección del dólar amplio de la Reserva Federal.
2. Registra la dirección de la tasa real a 10 años.
3. Registra la dirección de presión de financiación SOFR−IORB.
4. Escribe una frase de régimen no predictiva.
5. Comprueba evidencia relevante entre activos y de estrés más amplio para buscar confirmación o contradicción.
6. Registra las contradicciones sin borrarlas de la narrativa.
7. Compara con el Score semanal publicado sin asumir que ambos marcos miden exactamente lo mismo.

---

## Límite de fuentes y derechos

La información del Federal Reserve Board se trata conforme al aviso publicado por el Board y sus requisitos de atribución.

SOFR está sujeto a los Términos de Uso del Federal Reserve Bank of New York, incluido el aviso específico para tasas de referencia y las condiciones de no respaldo.

El valor SOFR−IORB de USD Impact se identifica como un cálculo derivado.

La implementación en vivo debe fallar de forma cerrada si faltan el contrato de fuentes aprobado, los identificadores de fuente o los avisos obligatorios.

---

## Qué representa y qué no representa el panel

El panel representa una lectura semanal ordenada de tres medidas públicas definidas. No representa una cartera, un pronóstico, una probabilidad de rentabilidad ni una recomendación de inversión.

Cuando se compare con una medición sistemática separada, ambas deben mantenerse conceptualmente distintas: el panel describe una lectura cualitativa del régimen; una metodología sistemática mide según sus propias reglas publicadas; **no asumas que ambas miden exactamente lo mismo.**

---

## Ejemplo práctico

Supón una semana completada con dólar amplio más firme, tasa real a 10 años al alza y presión SOFR−IORB contenida.

Una síntesis disciplinada sería:

> **La semana mostró un dólar amplio más firme y mayor presión de tasas reales, pero sin un aumento claro de la presión de financiación. La configuración encaja mejor con un entorno de dólar firme liderado por tasas que con una tensión de financiación.**

Eso no predice el siguiente movimiento del dólar, el oro, las acciones ni ningún otro activo.

---

---

## Fuentes verificadas / referencias

- [Federal Reserve Board H.10 — Foreign Exchange Rates](https://www.federalreserve.gov/releases/h10/current/)
- [FRED — 10-Year Treasury Inflation-Indexed Security, Constant Maturity (DFII10)](https://fred.stlouisfed.org/series/DFII10)
- [U.S. Treasury — Daily Treasury Par Yield Curve Rates](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve)
- [Federal Reserve Board H.15 — Selected Interest Rates](https://www.federalreserve.gov/releases/h15/)
- [Federal Reserve Bank of New York — SOFR](https://www.newyorkfed.org/markets/reference-rates/sofr)
- [Federal Reserve Bank of New York — Terms of Use](https://www.newyorkfed.org/privacy/termsofuse)
- [Cboe — VIX](https://www.cboe.com/tradable-products/vix)

## Conclusión clave

Tres Diales v2 mantiene una secuencia pública sencilla:

**Dirección del dólar amplio → Presión de tasas reales → Presión de financiación**

DXY, crédito, volatilidad y evidencia de liquidez más amplia siguen siendo contexto educativo importante, pero no se republican silenciosamente ni se disfrazan como inputs de los diales de la versión 2.

Empieza por los diales. Después sigue el mecanismo con la **[Cadena de Transmisión del Dólar](/es/framework/dollar-transmission-chain/)**.
