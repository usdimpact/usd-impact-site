# Spanish audiobook — Chapters 2–8 part-heading audio verification

**Date:** 2026-10-09  
**Disposition:** TRANSCRIPT FLAG / HUMAN AUDIO CONFIRMATION REQUIRED. Do not master affected boundaries or change original recordings until confirmed.

## Authoritative source

[Spanish Edition 1.3 Candidate 1](https://docs.google.com/document/d/1hjOXZdqT1DajsiGvNm8motQIJ4yuxi6zNwDiU1bpYnU/edit), body sections, repeats its Part I/II/III label immediately **before each applicable chapter**. This comparison is to the body, not the front table of contents. Source wording is unchanged.

## 7 targeted listening checks

Open the [private Descript audiobook project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca). Listen to the ending of the first composition and the beginning of the next. Each listed time is from the current private SRT, approximate and **not a certified audible cut boundary**.

| Transition | Private source compositions | First composition: inspect | Next composition: inspect | Expected source |
| --- | --- | --- | --- | --- |
| 03→04 (Chapter 1→2) | `686a4f65` → `b6df4dcc` | Track03 last ~00:17:39–00:17:45 | Track04 00:00–00:06 | A new `Parte uno` before `Capítulo dos`; currently missing in SRT |
| 04→05 (Chapter 2→3) | `b6df4dcc` → `478f0683` | 00:18:27.8–00:18:28.6: `Parte dos` | 00:00–00:06 | This `Parte dos` belongs before `Capítulo tres` |
| 05→06 (Chapter 3→4) | `478f0683` → `3166b677` | 00:18:59.5–00:19:00.4: `Parte dos` | 00:00–00:09 | `Parte dos` belongs before `Capítulo cuatro` |
| 06→07 (Chapter 4→5) | `3166b677` → `1e8ae260` | 00:22:52.6–00:22:53.8: `Parte tres` | 00:00–00:07 | `Parte tres` belongs before `Capítulo cinco` |
| 07→08 (Chapter 5→6) | `1e8ae260` → `2b9e5a60` | 00:20:26.9–00:20:27.6: `Parte tres` | 00:00–00:06 | `Parte tres` belongs before `Capítulo seis` |
| 08→09 (Chapter 6→7) | `2b9e5a60` → `f053f190` | 00:16:41.1–00:16:42.2: `Parte tres` | 00:00–00:06 | `Parte tres` belongs before `Capítulo siete` |
| 09→10 (Chapter 7→8) | `f053f190` → `2f2d2ff3` | 00:17:49.4–00:17:50.5: `Parte tres` | 00:00–00:07 | `Parte tres` belongs before `Capítulo ocho` |

**Reviewer result for each:** HEARD HEADING AT PRIOR TAIL / SILENT OR ASR-ONLY / UNCLEAR. Also note clipped audio or abrupt pauses. A single unqualified PASS to this checklist does not establish which interpretation applies; specify the seven results when possible.

## Automatic repair attempt and stop

Descript Agent Underlord was authorized to test **only** an isolated two-duplicate Chapter2→Chapter3 transfer, without publishing. The agent **ABORTED BEFORE ANY MODIFICATION** because its script-word search could not isolate the final `Parte dos` clip and could not confidently bind Chapter3 opening to the correct media. **No duplicate, rendered audio, synthesized speech or edited source was produced**. This may be a limitation of the agent's script parsing, not proof of damaged audio.

An isolated read-only timeline export was produced for Track04 (EDL, no media bundled), but its timeline file has not been independently inspected. Do not assume the EDL proves an acoustic edit boundary.

**Next safe action:** listen at these specific timestamps in Descript; if the words are genuinely audible at the prior tail, carry out exact boundary corrections only with a reliable editor/media alignment workflow in NEW private duplicates. Recheck core narration, total duration and sample joins. Do not use text-only transcript edits to sever uncertain audio. The existing owner-approved 3-reel checkpoint covered different boundaries.

## Final release boundary

20/20 private selected compositions remain present. Mastering, complete 20-track listening, PR #797 merge, public Descript publishing, member delivery and Production are NOT approved here. Preserve all canonical originals.

## Owner confirmed audible Part II heading at Chapter 2 tail — 2026-10-09

**Listening evidence:** Asked to play private Chapter 2 composition `b6df4dcc-811f-4ec5-a577-f33c5e81b415` at **18:27–18:29** and say HEARD / NOT HEARD / UNCLEAR. The owner replied **HEARD**, confirming **audible `Parte dos` after Chapter 2's disclaimer** (SRT locates it approximately **18:27.832–18:28.612**). This is no longer merely an ASR/transcript flag for transition **04→05**.

**Required editorial placement:** Authoritative Spanish Edition 1.3 Candidate 1 places the repeated `PARTE II` at the start of Chapter 3 (`05`), before `Capítulo tres`. Track 04 should end after `Verifica los datos actuales antes de utilizarlos`. Preserve the **different** `Parte dos` spoken at the end of Track 05 for the separate Track05→06 boundary investigation.

**Attempted automatic edit remains ABORTED:** Agent Underlord could not find a reliable source-media/word edit boundary, so no audio clip was moved, no duplicates created, and the originals were not modified. Audible presence confirms the defect, **not** a safe waveform cut location. EDL metadata alone has no bundled audio.

**Repair method:** First obtain private actual **audio-only exports** of Chapter 2 and Chapter 3 (WAV preferred, no mastering or public publish); then use a precise editor to isolate the known tail phrase by listening and waveform, move recorded speech to a **separate private corrected candidate**, verify intact disclaimers and track-duration conservation, and solicit new acoustic PASS. Do not cut at SRT timestamps without waveform verification. Do not regenerate with HeyGen/ElevenLabs.

**Other six checklist transitions (03→04 and 05→06 through 09→10) remain unconfirmed by this single `HEARD` response.** PR #797 draft/unmerged; public Descript sharing, member audio, Production and mastering remain held.

## Offline recorded-heading transfer — private WAV candidates (2026-10-09)

Following the owner's `HEARD` confirmation, the owner uploaded native lossless WAV exports of source Descript Chapter2 (`b6df4dcc-811f-4ec5-a577-f33c5e81b415`) and Chapter3 (`478f0683-3203-43f1-b78b-4f1dbc4ec144`). Both uploads were validated as signed 16-bit PCM, 44.1kHz, mono and fully decoded. Their native durations were **1108.924081633s** and **1140.715102041s** respectively.

**Exact offline repair:** Split source Chapter2 at **1107.380000s** (silence/low-energy interval between the disclaimer ending ~1107.22s and `Parte dos` starting ~1107.48s), then move its whole remaining **1.544081633s** of existing PCM audio, including the heading and pause, to the beginning of an unchanged copy of Chapter3. The output Chapter2 ends after the compliance sentence at **1107.380000s** and Chapter3 begins with the recorded heading at **1142.259183673s** total length. Leave the separate original `Parte dos` at Chapter3's end intact. No resynthesis, editing within voiced speech, filtering or level changes.

**Strong sample-preservation verification:** SHA-256 of combined input Chapter2 PCM followed by input Chapter3 PCM is **`c5d0e8d1a9d231a5d52e2c94987444f0e31b5f557ec9b2c15f1d4c3d12041c17`** [checksum in private machine-readable QA report governs; verify exact before using literal]. Repaired Chapter2 PCM followed by repaired Chapter3 PCM is **byte-for-byte identical** across the same 99,209,088 total frames; duration and content are conserved. Split quiet gap RMS **0.00020779** full scale; zero sample jump at split.

**Saved private, owner-only Drive recordings:**

- [Corrected Chapter 2 WAV](https://drive.google.com/file/d/1q5ljVsqJRHNJ9FYxThfa1sjsbskVmyKH/view) — 97,670,960 bytes.
- [Corrected Chapter 3 WAV](https://drive.google.com/file/d/1NcGQb_Y_ZOt5FiEeZQZzrGeZisAEWMwG/view) — 100,747,304 bytes.
- [Listening-kit ZIP (four before/after WAV excerpts)](https://drive.google.com/file/d/1vFkdpDJmDMsjcLZG_pvrNrhZhvAKjtlz/view).
- [Private full QA report](https://drive.google.com/file/d/1tagWn7hsrOf0A42PiezUdp06u2m_wy53/view) and [machine-readable hashes/metrics](https://drive.google.com/file/d/1Mw85FlDnbp8gXbJ37E8MCVO1YNpLhHI-/view).

**Human acoustic verdict:** PENDING. Listen to Chapter2's last 10 seconds for a complete disclaimer without `Parte dos`, and Chapter3's first 10 seconds for `Parte dos` followed by `Capítulo tres`, with no clicks/clips. This was an **offline** audio repair; the approved private Descript review manifest still points at original Chapter2 and Chapter3 compositions until the corrected WAVs are auditioned, imported as new private duplicates, and approved.

**Remaining 6 heading checks** and whole-book listen/mastering are still pending. PR #797 DRAFT/unmerged; public/member/Production unchanged; original files preserved.
