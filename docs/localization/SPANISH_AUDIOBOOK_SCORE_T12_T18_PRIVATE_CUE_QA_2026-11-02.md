# Spanish audiobook — Score notation and label cue QA (Tracks 12 and 18)
Prepared: **2026-11-02** · Review only · Release: **HOLD**

> **Scope:** Compare the current selected private Descript composition transcripts with the existing Spanish Edition 1.3 Candidate 1, Chapter 10 and Appendix B. **These are automatic transcript (ASR) cues, NOT proof of mispronounced source audio.** Do not replace audio or supersede recorded owner listening PASS solely because ASR mistranscribed an acronym or mathematical symbol.

## Existing private evidence and authority

- Descript project: `2f542797-4a70-4d44-a164-76dee15859ca` — **PRIVATE QA**; no new publish/share.
- Historical [selected 20-track manifest](https://github.com/usdimpact/usd-impact-site/blob/feat/spanish-audiobook-pilot-foundation/docs/localization/SPANISH_AUDIOBOOK_PRIVATE_REVIEW_SEQUENCE_2026-10-09.json) selects Track 12 `ade2a5e4-2b8d-4342-8fc4-1869f61cd42d` (1089.773 s, Chapter 10) and Track 18 `6a251168-1d0d-4a9d-b9ea-daed1d1db016` (883.028 s, repaired Appendix B). Do **not** use original/unselected composition `5856dedb-b4e4-4fec-aa74-94882956fa74` or `aef945b9-0b31-48ad-9ec6-270c80f639c7` as final.
- [2026-10-27 QA closeout](https://github.com/usdimpact/usd-impact-site/blob/feat/spanish-audiobook-pilot-foundation/docs/localization/SPANISH_AUDIOBOOK_PRIVATE_QA_CLOSEOUT_2026-10-27.md) records owner-reported **20/20 complete-track listening PASS**. This is historical acoustic/editorial acceptance, **not** approved final mastering, exact source hashes, commercial rights, MP-21 repair or public delivery.
- Source text: local `USD Impact — Read the Dollar First — Spanish Edition 1.3 Candidate 1 — WORKING HOLD.txt`, checksum `5b12681b1fba8e0b0e6f713660e69d7350f9cdf4560afe8c1068823c7be2103b`, Chapter 10 and Appendix B, *not* a newly licensed successor edition.
- Private export ledger: **19/20** selected compositions have strong Drive WAV duration/filename candidates, but this is not 19 guaranteed byte-identical Descript renders. Edited Track 00 exact 109.835306 s WAV/hash and Track 02 MP-21 change remain separately blocked.

## Exact source-matched notation

The **eight weekly inputs** are DXY, WTI, S&P 500, VIX, BTC, GOLD, UST2Y and UST10Y. Normalize each *level* against the current production sample's mean and sample standard deviation, clip each to ±3.5, and combine:

`Score(t,T) = 0.125 × (DXY - WTI - SPX + VIX - BTC - GOLD + UST2Y + UST10Y)`

All eight weights have equal **absolute** magnitude 12.5%. Signs are **positive** for DXY, VIX, UST2Y and UST10Y, **negative** for WTI, SPX, BTC and GOLD. Source starts production history in 2015 and differentiates *recomputed history* from the originally published vintages; this is descriptive, not a prospective predictive backtest.

### Track 12 — Chapter 10, selected boundary-v2 composition

| Descript SRT range | Observed ASR transcript (diagnostic, not validated audio) | Source / what a listener must verify |
| --- | --- | --- |
| 03:04.825–03:23.445 (cues 40–41) | `Z de i, t, t`; `clip`; expressions of mean/std and the bounds `-3,5`, `+3,5` | The notation is **z(i,t,T)** (week t, production run T), standardized weekly **levels** and clipped ±3.5; the repeated spoken “t” might be an ASR notation loss, not wrong sound |
| 03:33.705–03:53.585 (cues 44–46) | `0,125` times letters/names for DXY, WTI, SPX, VIX, BTC and yields | Check **all eight input signs**; transcript contains letter grouping and could omit/misrecognize GOLD or part of formula; never accept a truncated formula as verified |
| 03:59.945–04:05.465 (cue 48) | `12, 5 % cada uno` | Listen to confirm *doce coma cinco por ciento*, not *doce por ciento y cinco* or *ciento veinticinco por ciento* |
| 04:37.336–05:09.756 (cues 55–62) | Five named regimes, including `hasta menos de más uno` and `hasta menos de menos cero coma tres` | Check correct endpoint inclusivity/exclusivity and preserved signs: **≥+1; [+0.3,+1); [-0.3,+0.3); [-1,-0.3); <−1** |
| 05:32.368–06:13.008 (cues 68–75) | Recomputed entire-sample historical readout and non-predictive-backtest caution | Must distinguish recalculated present-day historical readings from **contemporaneously published** observations |

### Track 18 — Appendix B, selected private repaired composition

| Descript SRT range | Observed ASR transcript (diagnostic, not validated audio) | Source / what a listener must verify |
| --- | --- | --- |
| 00:00.382–00:05.681 (cue 1) | `Appendix B` before a Spanish methodology title | Editorially verify whether the actual spoken words should be **Apéndice B**; a true English-title splice would warrant a targeted approved repair, not full regeneration |
| 03:58.725–04:36.879 (cues 44–49) | Unclear `i,t,T` symbols; `media de IT` | Verify exact time-indexed z-score notation, mean/std over the **current full production sample**, initial 2015-01-01 |
| 04:37.359–05:20.479 (cues 50–56) | ASR `La score B2` and `del S score` | Source says `Score v2`, **eight** equal absolute 0.125 weights, 8 signed components, clipped standardized values; ask listener to check if “B2” is just ASR mishearing “v2” |
| 05:43.028–06:27.558 (cues 63–72) | Five bands stated with awkward `menos de más` expressions | Verify all five ranges and endpoint semantics; spoken text may be correct but can be made clearer only if exact source-based edit is approved |
| 06:41.458–06:53.578 (cues 76–77) | ASR `La score BDOs` | Verify the actual sound says **Score v2**, not a different version; transcript uncertainty alone is not a new defect |
| 07:12.058–07:35.362 (cues 82–85) | Source's robustness and no-predictive-performance caveat | Confirm `las pruebas no establecen rentabilidad futura`; no new empirical success-rate or performance claim |

**Timecodes are SRT subtitle estimates** (not precise audio edit points or file evidence). Preserve waveform timing, breaths and existing narrator timbre if a later scoped correction is authorized.

## More natural Spanish spoken expressions — candidate only

The existing `hasta menos de más uno` is mathematically decipherable but awkward for an educational audiobook. A **proposed source-faithful** range reading for a future scoped correction is:

| Exact band | Candidate Spanish phrasing — do not generate yet |
| --- | --- |
| `Score ≥ +1.0` | “Igual o superior a **más uno**: régimen de dólar fuerte.” |
| `+0.3 ≤ Score < +1.0` | “Desde **más cero coma tres**, inclusive, **sin llegar a más uno**: régimen de dólar firme.” |
| `−0.3 ≤ Score < +0.3` | “Desde **menos cero coma tres**, inclusive, **sin llegar a más cero coma tres**: neutral o de transición.” |
| `−1.0 ≤ Score < −0.3` | “Desde **menos uno**, inclusive, **sin llegar a menos cero coma tres**: régimen de dólar blando.” |
| `Score < −1.0` | “**Por debajo de menos uno**: régimen de dólar débil.” |

These are **oral clarity alternatives**, not new thresholds, changes to the Score calculation or evidence of a defect. The editorial/Score authority should review the wording first. Any audio edit reopens the **specific affected passage**, not the already accepted unaffected chapters.

## Reviewer action and acceptance

1. Open the exact selected Track 12 and Track 18 compositions in the [private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca), not the old `01`/unselected reparations, and listen only at the cue windows above with the printed canonical formula.
2. Mark each row **PASS** (heard correctly), **ASR ONLY** (transcript is wrong, audio clear), or **DEFECT** (actual heard speech differs materially), with optional exact timestamp. Do not ask the user to approve a whole new album, and do not infer defects from ASR.
3. If all rows PASS/ASR ONLY, preserve existing 20/20 owner listening evidence and close only this *numerical-notation listening uncertainty*; final WAV/MP3 hash, Track 00, Track 02, rights and publisher release gates remain.
4. If DEFECT, create a versioned **minimum spoken-edit script** with only affected passages, approve editorial + Narrator Mateo rights before synthesizing/editing, and re-run local boundary plus complete-track playback QA. No rerender of entire 20-track audio.
5. Record a final source-audio mapping for each actual approved Descript WAV, LUFS/true-peak/silence and immutable MP3 SHA256 when eligible; the previously executed 192kbps encoding-profile hashes are technical **tests**, not 20 stored final masters.

**Release:** HOLD. No merge or public source, no Descript Publish, no new voice generation/ElevenLabs spending, no Supabase/Cloudflare uploads or paid/free media activation, no Source Rights/Score HOLD waiver. Latest Fundraising DEC-016 targets **future free educational/audio content where cleared and Research paid**, separate from existing protected Library Pass member delivery. Past symbolic audiobook pricing is superseded for that future mode; historic purchasers remain entitled.
