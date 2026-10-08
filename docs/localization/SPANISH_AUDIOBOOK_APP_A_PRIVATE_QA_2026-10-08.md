# Appendix A — Spanish audiobook private QA (2026-10-08)

**Track:** 17 — `Apéndice A — Glosario rápido`  
**Disposition:** PRIVATE AUDIO / ASSEMBLY / TEXT QA PASS; FINAL LISTENING AND MASTERING HOLD.

## Canonical source and provider

- Source: `Read the Dollar First`, Spanish Edition 1.3 Candidate 1, original document lines 968–1080.
- Narrator Mateo, `es-419`, speed `0.92x`; original text is adapted for speech using established acronym pronunciation rules.
- GitHub Batch A, segments **1–8**: run `37841109581`, artifact `11577741932`, 505.600 seconds, SHA-256 `a5341932492c36fb1cda3c67be647bc2cf1527b3e8d1e342d51ad35ca8fdbaab`.
- GitHub Batch B, segments **9–16**: run `37841664444`, artifact `11577608501`, 537.731 seconds, SHA-256 `cd9afd16b0c29f25f06e7d9ef903da4af1807767e500043d211706e1e9b8e9d3`.
- Private Descript project `2f542797-4a70-4d44-a164-76dee15859ca`; composition `625d0a1a-1bf2-42ac-b363-cb8b525e660b`.
- Both Descript imports reported **success**; final composition has **16/16** pieces and runs **1,043.331 seconds (~17:23)**; no Descript publishes.

## Technical validation

- All 16 segments decode as MP3; each unique, non-empty and canonical.
- Segment-level provider duration sums agree with the composition duration within rounding tolerance.
- No generation retry or duplicate canonical segment is required.

## Text/source verification

- Direct original-source vs Descript transcript: **1,949 exact normalized token matches out of 1,996 source tokens = 97.65%**.
- **Zero source-token omissions** in the aligned source comparison. Remaining differences largely reflect spaced-out acronyms becoming joined transcription tokens or natural letter/number readings.
- Prepared speech text vs Descript transcript: **97.53%** exact normalized token alignment; apparent long omissions are acronym-rendering artifacts rather than missing glossary entries.
- The initial chapter heading `APÉNDICE A` and `DFII10` are present in HeyGen's authoritative word-timing data, though Descript ASR incorrectly rendered them at points (e.g. `Aprendáis a`, `DFIY10`). Verify pronunciation **by listening to the original audio** during final QA rather than automatically regenerating on the basis of ASR.

## Release boundary

Private source, assembly and transcript QA: **PASS**. Full human listening, acronym/pronunciation verification and audio mastering: **HOLD**. No member-storage upload, public media publish, commerce/auth/entitlement change, or Production deployment is authorized. Production of prepared Appendix B can continue privately under the same guarded workflow.
