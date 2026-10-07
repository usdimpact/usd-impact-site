# Spanish Audiobook Full Production Progress — 2026-10-07

Status: **PRIVATE PRODUCTION IN PROGRESS / NO MEMBER DELIVERY / NO PRODUCTION CHANGE**

## Approved voice

Owner approved **Narrator Mateo** as the Spanish audiobook baseline voice.

Production settings:

- voice: Narrator Mateo
- voice ID: `626ca51acb2e496f8dcee8d7591fda3c`
- locale: `es-419`
- speed: `0.92x`
- source: Spanish Edition 1.3 Candidate 1
- source Drive ID: `1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU`
- delivery state: private QA only

## Private master QA project

Descript project:

- project ID: `2f542797-4a70-4d44-a164-76dee15859ca`
- project name: `USD Impact — Spanish Audiobook Full Production — Mateo — PRIVATE QA`
- URL: https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca

No composition in this project is published.

## Completed production tracks

| Track | Composition | Duration | QA state |
| --- | --- | ---: | --- |
| 00 | Lee primero el dólar | 113.345 s | imported / private |
| 01 | Reconocimientos y guía del lector | 228.571 s | imported / private |
| 02B | Introducción — Por qué existe este libro — corrected | 838.818 s | integrity PASS |
| 03B | Capítulo 1 — Por qué el dólar va primero — corrected | 1064.385 s | audio assembly PASS; combined transcript export limitation documented |
| 04 | Capítulo 2 — De Bretton Woods a la disciplina fiat | 1108.924 s | integrity PASS |

Completed private audio represented above: approximately **55.9 minutes**.

## Chapter QA evidence

### Introduction

- corrected Roman-numeral spoken forms
- source alignment: **99.94%**
- only remaining ASR difference: orthographic `adónde` / `a dónde`
- disposition: PASS

### Chapter 1

- final composition duration: **17:44**
- all 16 final audio pieces imported successfully
- literal source URLs omitted from speech only
- `H.10` spoken as `H punto diez`
- quarter labels adapted to natural spoken Spanish
- Descript combined transcript export currently truncates after approximately 62% despite full audio duration and later-media indexing
- direct media indexing confirms later clips exist
- disposition: **AUDIO ASSEMBLY PASS / COMBINED TRANSCRIPT TOOLING LIMITATION**

### Chapter 2

- final composition duration: **18:29**
- source alignment: **99.65%**
- remaining differences are benign spoken-number forms
- `EE. UU.` spoken as `Estados Unidos` to prevent abbreviation splitting
- literal URLs omitted from speech only
- disposition: PASS

## Governed spoken adaptations

These adaptations preserve written Candidate 1 while improving narration quality:

- Roman numerals in section/part labels are spoken as Spanish words.
- Chapter numerals are spoken as Spanish words where needed for stable TTS.
- `EE. UU.` is spoken as `Estados Unidos`.
- `H.10` is spoken as `H punto diez`.
- compact quarter labels such as `2025T4` are spoken as year + `trimestre cuatro`.
- literal `https://...` strings are not narrated; source names and reference claims remain spoken.
- acronyms governed by the pronunciation list are synthesized explicitly as characters where appropriate.

No source facts, numbers, dates, claims, compliance language or source names are removed by these spoken adaptations.

## Release boundary

Still prohibited at this checkpoint:

- no Supabase/Storage audiobook upload;
- no member-facing Spanish audiobook route;
- no Spanish audiobook manifest in Production;
- no entitlement change;
- no commerce/auth/passkey/database change;
- no replacement or modification of the English audiobook;
- no Production deployment;
- no public publish from Descript.

### Chapter 3

- title: **USD no es DXY**
- table content adapted row-by-row for intelligible audio while preserving every cell meaning
- failed Descript transcription for segment 05-10 repaired by re-importing the same generated audio as `05-10-retry.wav`
- duplicate original 05-10 timeline clip removed; final order restored
- source alignment: **99.06%**
- remaining differences are spoken-number / ASR formatting, including percentage rendering, configuration numerals, `U.S.` and `H.10`
- no material claim, date, source identity, asset identity or compliance language changed
- disposition: **PASS**

## Next production step

Continue with **Chapter 4 — Cómo el dólar mueve petróleo, oro, Bitcoin, gas y divisas**, using the approved Mateo voice and governed spoken-adaptation rules. Chapter 4 synthesis has started privately; segments 1–5 are complete.


## Provider-credit hold — 2026-10-07

Production continued into Chapter 4 after Chapters 00–05 were locked.

Current Chapter 4 synthesis state:

- segments 1–10: **complete**
- segment 11: **next**
- segments 11–23: **not synthesized**
- no completed segment should be regenerated

HeyGen account verification:

- plan: Creator
- premium credits remaining: 2
- add-on credits: none available
- premium-credit reset: `2026-10-13T19:31:48Z`
- current speech endpoint result after segment 10: HTTP 402 `insufficient_credit`
- endpoint requires plan/generative credit; no billing purchase or plan change has been authorized

Operational response:

- synthesis paused exactly at Chapter 4 segment 11;
- tracks 06–19 were fully inventoried and preflighted;
- a human-readable and machine-readable production queue was added to this branch;
- no voice substitution, lower-quality fallback, public publish, member upload or Production change was made.

Queue files:

- `docs/localization/SPANISH_AUDIOBOOK_MATEO_PRODUCTION_QUEUE_2026-10-07.md`
- `docs/localization/spanish-audiobook-mateo-production-queue-2026-10-07.json`

The safe resume command is: **Track 06 / Chapter 4 / segment 11 with Narrator Mateo, es-419, 0.92x.**


### Chapter 5

- title: **El petróleo no es solo una operación de dólar**
- funded HeyGen Developer API run: `37692807367`
- generated pieces: **22/22**
- total generated duration: **1,227.833 s (~20:28)**
- private Descript composition: `1e8ae260-ddfc-481b-8089-358561b2a4e9`
- all 22 media imports: **PASS**
- source alignment: **99.07%**
- remaining differences are benign spoken/ASR normalization of numerals, percentages, `EUR/USD`, `U.S.`, chapter number `200`, and `OPEP/OPEC`
- missing material claim: **none found**
- changed compliance meaning: **none found**
- disposition: **PASS**



### Chapter 6

- title: **El oro y el dólar**
- funded HeyGen Developer API run: `37695486557`
- generated pieces: **17/17**
- total generated duration: **1,002.553 s (~16:43)**
- private Descript composition: `2b9e5a60-028f-4ff4-8581-25db456bdda5`
- all 17 media imports: **PASS**
- source alignment: **98.87%**
- stricter omission scan: **0 multi-word source omissions**
- remaining differences are benign spoken/ASR normalization of numerals, `DFII10`, `Goldhub`, hyphenation and singular/plural ASR rendering
- missing material claim: **none found**
- changed compliance meaning: **none found**
- disposition: **PASS**

