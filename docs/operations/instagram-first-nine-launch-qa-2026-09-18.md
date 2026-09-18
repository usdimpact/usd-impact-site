# Instagram First-Nine Launch Batch QA — 2026-09-18

Status: pre-publication QA checkpoint. No launch date, Instagram/Meta connection, scheduling, posting, Production deployment, or social activation.

## Batch definition

The first-nine architecture remains:

1. IG-001 — Read the Driver
2. IG-002 — The 3 Dials
3. PIN-003 — What USD Impact Is
4. IG-006 — DXY in 30 Seconds
5. IG-011 — Dollar vs Gold
6. IG-021 — Repo in Plain English
7. DYN-DAILY if launch-current and verified; otherwise IG-008 — What Is Liquidity Stress?
8. IG-004 — What Changed First?
9. DYN-SCORE if launch-current and verified; otherwise IG-007 — Real Yields in 30 Seconds

The slot-7 fallback was corrected from IG-004 to IG-008 so a no-Daily launch does not duplicate IG-004 in adjacent grid positions.

## Canonical cover rule

Do not rely on provider-selected HeyGen thumbnails for launch-grid identity.

A deterministic nine-cover set has been created for the first-nine architecture:

- 4:5 portrait cover system;
- USD Impact Production palette;
- consistent family label, lesson title, framework motif and asset ID;
- dynamic slots visibly marked as launch-time placeholders rather than current facts;
- structural overflow QA: PASS;
- contact-sheet review: PASS.

Dynamic-slot covers are internal placeholders only. A launch-current Daily/Score asset must receive a current cover generated from its verified candidate packet before posting.

## Video candidate QA

The evergreen Reel candidates used in the first-nine architecture were re-read from HeyGen:

| Asset | Canonical video ID | Status | Captioned MP4 | SRT |
|---|---|---|---|---|
| IG-001 | 7f215827561a44e7a83481a68f71a2f8 | completed | present | present |
| IG-002 | 8fb537b27be64db6a1e4a1b627ff865e | completed | present | present |
| IG-006 | f951f11371264c0ca596ce64a35cfdde | completed | present | present |
| IG-011 | 17c3f4ecb12c4061814023838a239a3e | completed | present | present |
| IG-021 | 99dbccf5b1d447d7a51828f459fa7c89 | completed | present | present |
| IG-004 | cad3422d41a3457380fed9aec6b78ff9 | completed | present | present |
| IG-007 | 0ffc8423aa2d4a73b1742f4c615522c3 | completed | present | present |

Publishing must use the verified captioned MP4, not the raw uncaptioned render.

## PIN-003 product-state QA

PIN-003 remains accurate against the current USD Impact product structure:

- learning / Start Here / Guided Edition;
- Daily USD Impact;
- Weekly Score;
- Reports;
- protected Library surfaces including Audiobook and Video Library.

PIN-003 does not hard-code pricing and does not claim future Research Membership or TradingView access.

Before actual launch, rerun this product-state check because navigation and product contracts can change.

## CTA destination contract

Current canonical destinations remain:

- Framework/foundation → Start Here (/start-here/)
- Daily current-context → Daily USD Impact (/news/)
- Weekly Score → Weekly Score (/score/)
- Report → Reports (/reports/)
- deeper product learning → the then-current Library evaluation path

The current public homepage continues to expose Start Here, Daily USD Impact, Weekly Score, Reports, Audiobook and Video Library as active platform surfaces as of this QA checkpoint.

Destination response/redirect behavior must still be re-tested immediately before launch.

## Dynamic-slot hold

Because publication is not beginning now, slots 7 and 9 remain **UNASSIGNED DYNAMIC** rather than being populated with September 2026 market material.

At launch:

- Slot 7: use a current Daily candidate only if it is source-verified and still fresh; otherwise use IG-008.
- Slot 9: use the current completed Weekly Score only if it is governed and launch-relevant; otherwise use IG-007.
- Do not carry a September candidate forward merely to preserve the planned grid.

## Phone-size / visual QA status

- Dedicated first-nine covers: PASS at contact-sheet scale.
- Deterministic 4:5 layout overflow test: PASS.
- Reel captions: provider captioned variants and SRT verified present.
- PIN-003 deterministic carousel: previously passed structural QA.
- Final phone-device review of complete motion + cover + caption combination remains a launch-week gate.

## Remaining launch-week gates

1. Resolve DYN-DAILY and DYN-SCORE from then-current governed publications.
2. Re-test all CTA destinations in Production.
3. Perform phone-device review of the selected captioned MP4s with the canonical covers.
4. Recheck PIN-003 and any HOW/product claims against then-current Production.
5. Editorial/compliance sign-off.
6. Confirm account ownership/recovery and publishing operator.
7. Only after separate authorization: configure Meta/Instagram publishing connection or schedule.

## Boundary

This checkpoint does not authorize merge, Production deployment, Meta login, OAuth/token setup, scheduling, posting, or automatic publication.
