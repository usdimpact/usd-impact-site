# Spanish Audiobook Mateo Production Queue — 2026-10-07

Status: **PRIVATE PRODUCTION QUEUE / SYNTHESIS CREDIT HOLD**

## Resume point

- Approved voice: Narrator Mateo
- Voice ID: `626ca51acb2e496f8dcee8d7591fda3c`
- Locale: `es-419`
- Speed: `0.92x`
- Source: Spanish Edition 1.3 Candidate 1
- Source Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- Private Descript master: `2f542797-4a70-4d44-a164-76dee15859ca`
- Completed/locked through: **Track 05 — Chapter 3**
- Current synthesis track: **Track 06 — Chapter 4**
- Current completed Chapter 4 segments: **1–10**
- Exact next synthesis item: **Track 06 / Chapter 4 / segment 11**
- Do not regenerate Chapter 4 segments 1–10.

## Current provider hold

HeyGen Creator account state checked on 2026-10-07:

- billing type: subscription
- plan: Creator
- premium credits remaining: 2
- add-on credits: none available
- premium credit reset: `2026-10-13T19:31:48Z`
- speech synthesis currently returns HTTP 402 `insufficient_credit` because the endpoint requires available plan/generative credit.

No purchase or billing change is authorized by this file.

## Remaining track inventory

| Track | Source section | Approx. chars | 850-char production blocks | Preflight notes |
| --- | --- | ---: | ---: | --- |
| 06 | Chapter 4 | 17,687 | 23 | Chapter 4 blocks 1–10 already synthesized; Roman Part III; WTI/OPEC+/DXY/ETF/LNG/BIS/IMF/FRED |
| 07 | Chapter 5 | 15,915 | 21 | EUR/USD verbalization; percentages; WTI/CME/CFTC/USD/LNG |
| 08 | Chapter 6 | 12,701 | 17 | percentages; ETF/DXY/FRED/IMF |
| 09 | Chapter 7 | 13,770 | 18 | percentages; IMF/DXY/LNG |
| 10 | Chapter 8 | 12,785 | 17 | LNG/TTF |
| 11 | Chapter 9 | 11,636 | 15 | Part IV; EUR/USD, USD/JPY, USD/MXN; many percentages; FX |
| 12 | Chapter 10 | 13,350 | 18 | Part V; CME/NYMEX; USD/DXY/WTI/VIX/SPX/BTC/FRED/ICE/CME |
| 13 | Chapter 11 | 11,317 | 15 | Part V; EUR/USD, USD/JPY; percentages; WTI/CME/CFTC/USD/LNG/ICE/FRED |
| 14 | Chapter 12 | 14,732 | 19 | Part V; EUR/USD; DXY/LNG/OPEC+/BIS/IMF/USD/ETF/ICE/USDX/FRED |
| 15 | Chapter 13 | 16,334 | 21 | DXY/WTI/LNG/VIX/CFTC/ETF/USD/FRED/CME/ICE |
| 16 | Further reading | 1,901 | 3 | bibliography-style spoken treatment |
| 17 | Appendix A | 12,328 | 16 | USD/MXN; percentages; dense acronym/glossary treatment |
| 18 | Appendix B | 9,726 | 13 | CME/NYMEX, BTC/USD; regime table requires row-by-row narration |
| 19 | About USD Impact | 553 | 1 | closing track |

These block counts are preflight counts, not final media-piece counts. Any block that approaches the provider synchronous limit may be split at sentence boundaries without changing source wording.

## Governed spoken adaptations

Apply consistently to all remaining tracks:

1. Preserve every factual claim, number, date, source identity, uncertainty qualifier and compliance sentence.
2. Do not narrate literal `https://...` strings. Keep the source/institution name and the reference claim.
3. Speak `EE. UU.` as `Estados Unidos`.
4. Speak Roman part labels as words:
   - Part III → `parte tres`
   - Part IV → `parte cuatro`
   - Part V → `parte cinco`
5. Speak chapter numerals as Spanish words when needed for stable TTS.
6. Speak `H.10` as `H punto diez`.
7. Speak compact quarter labels as year + quarter.
8. Verbalize currency pairs:
   - EUR/USD → `euro frente al dólar`
   - USD/JPY → `dólar frente al yen japonés`
   - USD/MXN → `dólar frente al peso mexicano`
   - BTC/USD → `Bitcoin frente al dólar`
9. Verbalize `CME/NYMEX` as `CME y NYMEX` unless the source context requires a different relationship.
10. Tables must be narrated row-by-row with labels so no cell meaning is lost.
11. Percentages may be spoken naturally as words; ASR number formatting differences are acceptable when numerical value is unchanged.
12. Keep DXY, USD, FX, WTI, LNG/GNL, TTF, VIX, BTC, SPX, CME, ICE, IMF/FMI, FRED, BIS, CFTC, TIPS and ETF pronunciation explicit/consistent.
13. Preserve compliance wording and do not introduce advice, prediction or signal language.

## QA gates for every completed track

- all generated pieces imported successfully;
- composition duration equals the sum of intended pieces within normal assembly tolerance;
- no duplicate or missing segment;
- no accidental clip reorder;
- transcript/source alignment reviewed;
- number/acronym ASR normalization distinguished from material wording drift;
- any real TTS misread is regenerated at segment level only;
- no public publish;
- no member storage upload;
- no Production route or manifest change.

## Release boundary

This queue authorizes private production preparation only. It does not authorize:

- buying credits;
- changing the HeyGen plan;
- uploading Spanish masters to member storage;
- publishing from Descript;
- enabling Spanish audiobook routes;
- changing entitlement/auth/commerce;
- deploying Production.

Resume synthesis only when provider credits are available or a separately approved compatible Mateo-quality provider path exists.
