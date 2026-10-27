# Spanish Audiobook — Candidate Technical QA Baseline — 2026-10-27

Status: **PRIVATE QA / RELEASE HOLD**  
PR: #797  
Branch: `feat/spanish-audiobook-pilot-foundation`

This report records technical measurements of the current private candidate set without changing any Descript composition, publishing media, enabling member delivery, merging the PR, or changing Production.

## Evidence class

Tracks 01–19 are the private Drive WAV candidates whose filenames/revisions and decoded durations align with the exact selected Descript composition durations.

Track 00 is different: no exact selected-v2 WAV existed in Drive. It is represented here by the private **EDL render-equivalent reconstruction** produced from the known rendered v1 WAV using the exact selected-v2 Descript timeline cut. It is **not** claimed to be a byte-identical Descript v2 export.

Therefore these measurements are a strong mastering-QA baseline, not final export-provenance certification.

## Summary

| Check | Result |
|---|---:|
| Tracks measured | **20/20** |
| Decoder integrity | **20/20 PASS** |
| Format | **20/20 44.1 kHz / mono / PCM16** |
| Integrated loudness range | **−24.04 to −23.83 LUFS** |
| Cross-track loudness spread | **0.20 LU** |
| Sample-peak range | **−8.55 to −7.57 dBFS** |
| Full-scale samples | **0 across all 20** |
| Longest detected low-level run (≤ −45 dBFS) | **1.80 s** |
| Tracks with ≥5 s low-level run | **0** |
| Largest duration delta vs selected composition | **0.000494 s** |
| 4× true-peak spot checks | **−8.55 to −7.56 dBTP** on measured tracks |

The measured set is already unusually consistent in loudness. No normalization/mastering operation is authorized by this report; it only establishes that the current candidate exports are tightly matched and have substantial peak headroom.

## Per-track measurements

| Track | Duration delta (s) | Integrated LUFS | Sample peak dBFS | Longest ≤−45 dBFS (s) | Full-scale samples | Disposition |
|---|---:|---:|---:|---:|---:|---|
| 00 | −0.000000 | −23.910 | −7.572 | 1.047 | 0 | EDL render-equivalent candidate; exact Descript export still pending |
| 01 | +0.000429 | −23.831 | −7.853 | 1.081 | 0 | candidate technical PASS |
| 02 | +0.000000 | −24.015 | −7.994 | 1.598 | 0 | candidate technical PASS |
| 03 | −0.000467 | −24.022 | −7.970 | 1.327 | 0 | candidate technical PASS |
| 04 | +0.000003 | −24.002 | −7.927 | 1.425 | 0 | candidate technical PASS |
| 05 | +0.000023 | −24.011 | −7.792 | 1.801 | 0 | candidate technical PASS |
| 06 | +0.000000 | −23.944 | −7.608 | 1.340 | 0 | candidate technical PASS |
| 07 | +0.000000 | −23.989 | −7.844 | 1.784 | 0 | candidate technical PASS |
| 08 | +0.000000 | −24.014 | −7.871 | 1.421 | 0 | candidate technical PASS |
| 09 | +0.000000 | −23.917 | −7.707 | 1.307 | 0 | candidate technical PASS |
| 10 | +0.000001 | −24.022 | −7.879 | 1.321 | 0 | candidate technical PASS |
| 11 | −0.000061 | −23.992 | −7.763 | 1.488 | 0 | candidate technical PASS |
| 12 | −0.000188 | −24.010 | −7.795 | 1.271 | 0 | candidate technical PASS |
| 13 | +0.000229 | −23.926 | −7.939 | 1.246 | 0 | candidate technical PASS |
| 14 | +0.000331 | −23.997 | −7.852 | 1.313 | 0 | candidate technical PASS |
| 15 | +0.000469 | −24.000 | −7.751 | 1.285 | 0 | candidate technical PASS |
| 16 | −0.000490 | −24.018 | −7.840 | 1.243 | 0 | candidate technical PASS |
| 17 | −0.000388 | −23.998 | −7.850 | 1.434 | 0 | candidate technical PASS |
| 18 | −0.000494 | −24.008 | −7.760 | 1.351 | 0 | candidate technical PASS |
| 19 | +0.000367 | −24.035 | −8.550 | 0.959 | 0 | candidate technical PASS |

## True-peak spot checks

4× oversampled true-peak estimates were run on Tracks 00–05 and the two appendices plus closing track:

- 00: **−7.568 dBTP**
- 01: **−7.850 dBTP**
- 02: **−7.988 dBTP**
- 03: **−7.940 dBTP**
- 04: **−7.921 dBTP**
- 05: **−7.792 dBTP**
- 17: **−7.830 dBTP**
- 18: **−7.558 dBTP**
- 19: **−8.550 dBTP**

These spot checks confirm substantial headroom in the sampled candidates. Full final-master true-peak measurement remains a release-stage check because Track 00 is not yet an actual Descript v2 render and tracks 01–19 still require direct composition-to-export provenance certification.

## Track 00 exact-edit result

The selected v2 EDL proves that v2 removes exactly samples:

`115,542 .. 149,057`

from the 44.1 kHz source timeline.

That is exactly:

- **33,516 samples**
- **0.760000 seconds**
- source interval **2.620000 s -> 3.380000 s**
- selected output length **4,843,737 samples**
- selected duration **109.835306122449 s**

This supersedes approximate ASR word-boundary timestamps for any sample edit.

The private Track 00 render-equivalent QA candidate has SHA-256:

`fcef044efb009088e78d42dfdf5a280213ac2379275eff533b286381c94612f1`

It matches the selected EDL output frame count exactly, but is not designated the final Descript-rendered master.

## Interpretation

### Technical evidence now substantially closed
- all 20 current candidates decode cleanly;
- all are mono 44.1 kHz PCM16;
- no file reaches full scale;
- no >5 s low-level silence event was found;
- duration agreement with the selected manifest is sub-millisecond across the set;
- loudness is extremely consistent across tracks;
- measured true-peak samples have large headroom;
- no technical evidence here requires new synthesis.

### Still pending
1. exact selected-composition -> WAV provenance for tracks 01–19;
2. actual private Descript-rendered Track 00 v2 WAV, if final release policy requires byte-level Descript-export provenance;
3. full final-master true-peak/seam measurements on the exact certified exports;
4. legal/publisher release clearance;
5. final distribution authorization.

## Login workaround

Google SSO through the browser hit MFA. This no longer blocks structural or candidate technical QA because the Descript connector supplied the exact EDL timeline and the private Drive sources supplied the audio candidates.

Browser authentication is therefore deferred until the project specifically requires an actual Descript-rendered Track 00 v2 export or direct UI provenance confirmation.

## Controls

PR #797 remains Draft/unmerged.  
No public Descript publish/share was used.  
No synthesis was run.  
No member storage upload occurred.  
Production and entitlements are unchanged.  
Mastering approval remains **PENDING**.
