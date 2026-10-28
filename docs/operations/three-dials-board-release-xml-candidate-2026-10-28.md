# Three Dials Federal Reserve release-XML candidate — 2026-10-28

Status: **REVIEW-ONLY / NOT MERGED / NOT PUBLISHED**

## Why this supersedes the DDP stopgap

The Federal Reserve release pages now expose full-release XML ZIPs directly and describe XML as a migration option while the Data Download Program / Build Your Package path is being retired.

A dedicated read-only CI proof in PR #898 fetched the three public ZIPs without secrets and emitted schema metadata only. No observation values were logged.

Verified live structure:

| Input | Release ZIP | Data XML | Exact daily series |
| --- | --- | --- | --- |
| Broad USD | `/releases/h10/data/FRB_h10_xml.zip` | `H10_data.xml` | `JRXWTFB_N.B` |
| 10-year real yield | `/releases/h15/data/FRB_h15_xml.zip` | `H15_data.xml` | `RIFLGFCY10_XII_N.B` |
| IORB | `/releases/prates/data/FRB_PRATES_xml.zip` | `PRATES_data.xml` | `RESBM_N.D` |

All three use a `kf:Series` element and `frb:Obs` observations carrying `TIME_PERIOD`, `OBS_VALUE` and `OBS_STATUS` attributes.

Additional identity checks:
- H.10 daily broad USD: `FREQ=9`, `UNIT=Index:_1997_Jan_100`.
- H.15 daily 10-year real yield: `FREQ=9`, `INSTRUMENT=TCMII`, `MATURITY=Y10`, `UNIT=Percent:_Per_Year`.
- PRATES IORB: `FREQ=8`, `UNIT=Percent`.

## Candidate behavior

- Board-origin inputs come directly from the official release-page XML ZIPs.
- SOFR remains direct from the New York Fed API.
- The funding dial remains the USD Impact-derived SOFR-minus-IORB spread.
- Existing immutable Three Dials snapshots are not rewritten.
- No FRED or DDP package transport remains in the future generator path.
- The ZIP reader is bounded and accepts only the exact named data XML file.
- Series identity and required metadata are exact-match, fail-closed.
- XML schema/identity drift, duplicate series, missing observations, redirects or oversized payloads fail closed.

## Live adapter proof

PR #900 exercised the exact three public Federal Reserve release ZIPs without emitting observation values. The first run correctly failed closed because H.15's live uncompressed XML exceeded the original 64 MiB ceiling. Diagnostic proof measured:
- H.10: ZIP 2,085,508 bytes; XML 27,393,867 bytes.
- H.15: ZIP 4,286,577 bytes; XML 70,860,311 bytes.
- PRATES: ZIP 55,554 bytes; XML 860,523 bytes.

The candidate ceiling is therefore 96 MiB: above the observed H.15 payload with bounded headroom, while still rejecting unexpectedly large decompressed XML. A disposable child proof is required to pass at this exact ceiling before merge consideration.

## Release boundary

This candidate does not run the snapshot generator against live sources and does not publish any number.

Even if the technical adapter is accepted, a generated snapshot still follows the existing protected Three Dials publication workflow: generated branch, exact-head checks, pull request, human review and separate explicit owner approval before merge.
