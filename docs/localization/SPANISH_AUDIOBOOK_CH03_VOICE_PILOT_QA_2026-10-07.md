# Spanish Audiobook Chapter 3 Voice Pilot QA — 2026-10-07

Status: **CONTENT INTEGRITY PASS / AUDITORY OWNER REVIEW REQUIRED / NO RELEASE**

## Pilot identity

- source: Spanish Edition 1.3 Candidate 1
- source Drive ID: `1hjOXZdqT1iIQWUenWuZwRYXHqJnT1u1f8v3_uaQ7ME`
- chapter: **Capítulo 3 — USD no es DXY**
- pilot voice: **Juliana - Voice 1**
- engine: HeyGen Starfish-compatible speech synthesis
- locale: `es-419`
- speed: `0.96x`
- generated duration: **158.302 seconds**
- QA project: Descript project `75e02740-968b-49ab-8ebb-cbbde6ef4a06`
- QA composition: `9431a768-d626-473e-8b1c-59866ec4e6f3`

## Integrity verification

The generated WAV was imported privately into Descript and transcribed as Spanish.

Transcript comparison against the locked pilot script found:

- missing sentences: **0**
- repeated sentences: **0**
- materially changed financial claims: **0**
- changed institution names: **0**
- changed asset names: **0**
- changed numerical values: **0**
- unintended recommendation/signal language: **0**
- DXY recognition: **consistent**
- USD recognition: **consistent**
- U.S. Dollar Index recognition: **preserved**
- Intercontinental Exchange recognition: **preserved**
- Bitcoin recognition: **preserved**
- `estrés de financiación global`: **preserved**
- `exposición ponderada por comercio`: **preserved**
- `mercados emergentes`: **preserved**

Differences observed by ASR are punctuation/paragraph normalization only and do not alter meaning.

## Pronunciation controls used

The synthesis request explicitly spelled `USD` and `DXY` as character sequences and used locale `es-419`.

The automated transcript supports intelligibility because both acronyms were recovered correctly. It does **not** prove that the exact phonetic rendition, accent, cadence, or proper-name pronunciation is subjectively acceptable.

## Release boundary

This pilot remains private.

This QA does not authorize:

- full 20-track Spanish synthesis;
- Supabase audiobook upload;
- member-facing Spanish audiobook routes;
- Spanish audiobook delivery;
- replacement or modification of the English audiobook;
- Production deployment;
- commerce, entitlement, auth, passkey or database changes.

## Remaining pilot gate

The remaining gate is **auditory owner acceptance** of:

1. voice suitability for a 4+ hour educational audiobook;
2. DXY pronunciation;
3. USD pronunciation;
4. U.S. Dollar Index / Intercontinental Exchange pronunciation;
5. treatment of the English loanword `legacy`;
6. pacing at 0.96x;
7. neutral international/LATAM Spanish character;
8. overall fatigue risk for long-form listening.

## Current disposition

**CONTENT INTEGRITY: PASS**  
**TECHNICAL PILOT GENERATION: PASS**  
**AUDITORY VOICE ACCEPTANCE: PENDING OWNER LISTEN**  
**FULL AUDIOBOOK PRODUCTION: HOLD**
