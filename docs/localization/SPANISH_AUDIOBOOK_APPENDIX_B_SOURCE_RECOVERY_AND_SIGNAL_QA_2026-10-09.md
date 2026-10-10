# Spanish audiobook — private Appendix B source recovery and signal QA

**2026-10-09. PRIVATE QA ONLY — NOT FINAL MASTERING APPROVAL.**

## Source preservation

Five GitHub Actions artifact archives were downloaded before their scheduled **2026-10-15** expiration, verified by SHA-256 and ZIP CRC, and saved in the owner-only Google Drive `USD Impact/09_QA_Reports`. The 15 original MP3 recordings and one existing reference-repair MP3 are available in these archives:

| GitHub artifact | Private Drive copy | SHA-256 |
| --- | --- | --- |
| 11577893181 | [Tracks 18-01 through 18-08](https://drive.google.com/file/d/1NQdGC7vNRjQJtqa4wDBGIihsz1EZj0e2/view) | `12a203287c1e6e67209bb58f5dbea8e4a543dbeb1bc0dfc397eb66d77fd7a22c` |
| 11579291355 | [Tracks 18-09 through 18-11](https://drive.google.com/file/d/1Ei0yNpA3Z53scyQRnr7Bg3XgEH_xR2ht/view) | `e4822190edddcffbf37bc530318c5aa3fe4d6dac27054a3a66d9d8c951f2bc29` |
| 11581316339 | [Track 18-12](https://drive.google.com/file/d/1gcgstxBEr8tX6W8h-lhtd_QvFH8ELfc7/view) | `5788814608709dbb109d4649cbeb1619273e397cd3c36f05f8843ff98af7e33b` |
| 11580478314 | [Tracks 18-13 through 18-15](https://drive.google.com/file/d/1oq3s0YZT-Z8xtM79HUvzxA52NW-1FhN6/view) | `a78483dc6876b0ae3d6c16005599d573ad6c5bb4cdd80a3374d979c209faaadf` |
| 11581931482 | [Reference-repair audio](https://drive.google.com/file/d/1wbfhzuBzoGNJQSd7svuRbKteI_lyQ0Q4/view) | `95d4ecaa552394870d11f50094178c805f4dde994a725548fc47841d89c5b92f` |

All five Drive copies were independently read back as **shared=false, owner-only**. The original GitHub workflows, sources, and current Descript compositions were left unchanged.

## Independent audio metrics

- **16/16 source MP3s:** FFmpeg decoder PASS; mono 44,100 Hz.
- Raw source integrated loudness range: **-16.31 to -15.81 LUFS**.
- Raw source true-peak range: **-0.40 to +0.21 dBTP**.
- **16/16** raw source recordings exceed a provisional **-1.5 dBTP** mastering peak limit. This is an observation about UNMASTERED input audio, not an error in any finalized output.
- Existing **private offline** Appendix B 8 ms smoothed MP3: **883.069388 s, -16.31 LUFS, -2.21 dBTP, decode PASS**.
- Prior private Track00 **v1** WAV (not the selected v2): **110.595306 s, -16.05 LUFS, +0.04 dBTP**.

Full per-segment measurements are saved privately in:
- [Technical report](https://drive.google.com/file/d/1qYaeSrHx_fZEkfO8L-d7bVOfWSmSAV2H/view)
- [Machine-readable measurements](https://drive.google.com/file/d/1zbOPHZEXyMeglgoaqlHA4SCMY09qBtlK/view)

## Blocked final-master validation

The measurements above are of GitHub/HeyGen source MP3s and a private offline trial, **not** the current edited Descript output. The selected audiobook is 20 compositions totaling **17,747.673118 s** in the private manifest. Descript's connector cannot export final rendered audio directly for offline measurements.

Required next: obtain private rendered audio of all selected Descript compositions, run final encoded LUFS/true-peak/click/silence checks, and complete whole-book acoustic and editorial review including standalone Introduction ~07:59, the complete Appendix B and copyright/version metadata. These remain pending even though the three targeted private listening reels have owner PASS.

**Release controls unchanged:** PR #797 DRAFT/unmerged, Descript public publishes 0, member delivery OFF, Production unchanged, mastering approval PENDING. No new synthesis or publishing performed.
