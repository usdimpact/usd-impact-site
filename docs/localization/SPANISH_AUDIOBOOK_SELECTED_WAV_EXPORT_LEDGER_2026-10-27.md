# Spanish Audiobook — Selected WAV Export Ledger

Date prepared: 2026-10-27  
Project: `2f542797-4a70-4d44-a164-76dee15859ca`  
Purpose: **private lossless-export provenance only**  
Release authority: **NONE**

Use only the exact selected composition IDs below. Do not substitute alternate, repair-test, boundary-test, prior-version, or similarly named compositions.

For each row, export a **private local WAV** from Descript. Do **not** use Publish/Share. Record the actual export settings and checksum after the file is created.

| Track | Selected description | Exact Descript composition ID | Expected duration (s) | Export filename | Export UTC | WAV sample rate | Bit depth | Channels | SHA-256 | Identity result |
|---|---|---|---:|---|---|---:|---:|---:|---|---|
| 00 | Opening | `ebe7f026-e369-4dd4-a184-9476a6482f5b` | 109.835306 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 01 | Acknowledgments and reader guide | `a65d72b2-4c79-454c-9215-0c292d856b69` | 228.571 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 02 | Introduction, corrected variant | `aecc180b-4513-455b-a3e4-fce58da36fac` | 837.44 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 03 | Chapter 1, corrected variant | `686a4f65-8ff9-4141-aedb-bab9b4296602` | 1065.766 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 04 | Chapter 2 | `592e27f8-5337-4058-8f6d-e0f2cb749251` | 1108.760224 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 05 | Chapter 3 | `afef9b85-5d80-443b-b39d-6ac07a4e298b` | 1140.4 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 06 | Chapter 4, final private variant | `c99a187a-501f-4a7c-b481-db2f0a179183` | 1374.2 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 07 | Chapter 5 | `66cdab8b-cb68-4839-82b0-af50fce19c7b` | 1228.21 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 08 | Chapter 6 | `88370601-0fec-4194-90ae-cfbb3a58c89f` | 1002.3 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 09 | Chapter 7 | `fc98ab59-811a-4e42-81f6-a08471dc7b0a` | 1070.8 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 10 | Chapter 8 | `217a0453-50cb-4b62-9117-e8009c2b1244` | 1012.682199 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 11 | Chapter 9 | `d154039c-2b7d-4002-9bd3-032e3531eef1` | 916.027 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 12 | Chapter 10 | `ade2a5e4-2b8d-4342-8fc4-1869f61cd42d` | 1089.773 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 13 | Chapter 11 | `8644e0dc-4fc1-475a-ab30-85a53521445b` | 930.629 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 14 | Chapter 12 | `fc7b5ff2-9f63-4e36-ba53-00240cb05058` | 1167.664 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 15 | Chapter 13 | `34e4b853-0b77-4a21-9830-f231a9045383` | 1347.663 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 16 | Further reading | `827db26b-1a82-4f29-a588-48eadadca1a7` | 148.376 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 17 | Appendix A, glossary | `625d0a1a-1bf2-42ac-b363-cb8b525e660b` | 1043.331 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 18 | Appendix B, repaired private candidate | `6a251168-1d0d-4a9d-b9ea-daed1d1db016` | 883.028 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 19 | About the author | `1d15c8e2-dc3f-4c2d-9b95-b84a435dcb0b` | 43.598 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## Identity rule

An export is acceptable for technical mastering QA only when all of the following are recorded:

1. exact selected composition ID matches this ledger;
2. exported file is WAV/lossless;
3. filename and export timestamp are recorded;
4. sample rate, bit depth and channel count are measured from the file, not assumed from the dialog;
5. SHA-256 is recorded from the exported bytes;
6. decoded duration is reconciled against the expected selected-composition duration with any container/sample rounding explicitly noted;
7. no alternate candidate is silently substituted.

## Special attention

- Track 00 must be selected v2 `ebe7f026-e369-4dd4-a184-9476a6482f5b`, not the older 110.595306 s candidate.
- Track 18 must be repaired candidate `6a251168-1d0d-4a9d-b9ea-daed1d1db016`, not the original Appendix B or an offline mastering trial.
- Tracks 02–15 include selected corrected/boundary variants. Match by composition ID, never by filename alone.

## After export

Do not publish or upload to member storage. Keep files private, then run decoder integrity, LUFS, true peak, clipping, excessive-silence, seam, and cross-track balance measurements. Final mastering approval and legal/publisher distribution approval remain separate.
