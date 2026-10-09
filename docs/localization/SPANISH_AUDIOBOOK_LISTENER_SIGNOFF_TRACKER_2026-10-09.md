# Spanish audiobook — human listening sign-off tracker

**Latest status (2026-10-09): owner-reported PASS for the imported corrected Track 00 opening (00:00–00:12) and disclaimer (00:40–00:52), in addition to prior private A/B samples. Subsequent transcript QA detected a residual `Right` before `2026`, removed in a new separate private v2 duplicate; v2 listening remains PENDING. Original Track 00 failure is historical; original composition unchanged. Other reels, full 20-track listening, mastering, and all release gates remain HOLD.**
**Private project:** https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca
**Private reel:** `6b7b9e26-bde5-4b1b-a9f1-3346966a26c6` (3:06.888; 13 markers; excerpts play without inserted silence).
**Private appendix B A/B audition kit:** `/spanish-audiobook-appendix-b-8ms-private-listening-kit-2026-10-09.zip` in Library.
**Private full smoothed trial:** `/spanish-audiobook-appendix-b-8ms-private-mastering-trial-2026-10-09.mp3` in Library.

## User-reported listening defect — October 9

- **Track 00 opening click:** **FAIL (listener-reported)** near `00:47.07`, at `Este libro tiene un propósito exclusivamente educativo e informativo.` The listener stopped there. Cause not yet independently verified.
- **Copyright paragraph grammar:** parallel-list issue identified in opening copyright notice. Editorial candidate proposed only, no canonical or audio revision, legal sign-off required.
- **Remediation evidence:** `docs/localization/SPANISH_AUDIOBOOK_OPENING_TRACK_CLICK_GRAMMAR_QA_2026-10-09.md`.
- **At the time of the first click report, all subsequent checkpoints were PENDING.** The later owner-reported PASS applies only to the four offline A/B listening-package checks documented below; all Descript reel and full-book checks remain PENDING.

## Reviewer decisions (unfilled until actual listening)

Use PASS / FAIL / UNCLEAR, add evidence or a timecode. Do not mark PASS from transcript or waveform alone.

| Check | Approx. reel time | Status | Evidence / issue |
|---|---|---|---|
| 1. Chapter 8 → 9: Parte tres | 0:00–0:16 | PENDING | |
| 2. Chapter 9 → 10: Parte cuatro | 0:16–0:32 | PENDING | |
| 3. Chapter 10 → 11: Parte cinco | 0:32–0:48 | PENDING | |
| 4. Chapter 11 → 12: Parte cinco | 0:48–1:04 | PENDING | |
| 5. Chapter 12 → 13: Parte cinco | 1:04–1:20 | PENDING | |
| 6. Appendix B original/corrected reference seam; ICE, CME/NYMEX, S&P Dow Jones, Cboe, Treasury/FRED | 1:20–2:06; A/B clips at 0:14.84 and 0:47.12 | PENDING | |
| 7. Chapter 13 compliance ending | 2:06–2:46 | PENDING | |
| 8. Appendix A Spanish opening title | 2:46–2:57 | PENDING | |
| 9. Appendix B Spanish opening title | 2:57–3:07 | PENDING | |
| 10. Overall click, breath continuity, volume, pronunciation | Across reel and A/B comparison | PENDING | |

**Appendix title review evidence:** `docs/localization/SPANISH_AUDIOBOOK_APPENDIX_TITLE_PRONUNCIATION_QA_2026-10-09.md` documents source wording versus ambiguous speech-to-text only. The two title checks must remain PENDING until actual listening. Do not regenerate from ASR alone.

## Additional front-matter listening gate — October 9

- **Introduction → Chapter 1 boundary:** PENDING — new Intro candidate `aecc180b-4513-455b-a3e4-fce58da36fac` and new Chapter 1 candidate `686a4f65-8ff9-4141-aedb-bab9b4296602`. Listen to the restored mid-Introduction `la parte uno` near 07:59, the final 10s of the Intro, and first 8s of Chapter 1. Check for altered pauses, duplicate headings, silence, and clip artifacts.
- Evidence: `docs/localization/SPANISH_AUDIOBOOK_PART_I_FRONTMATTER_BOUNDARY_QA_2026-10-09.md`.
- **Status: PENDING — not approved by transcript equality alone.**

## Reviewer declaration

- Reviewer name / role: **owner (reply provided in current review; individual reviewer name not separately recorded)**
- Listening date: **2026-10-09 for scoped offline A/B verdict; separate Descript and full-book listening date not provided**
- Overall acoustic decision: **PENDING (whole book). Scoped four-check offline A/B review: owner-reported PASS. Original Track 00 source click: historical FAIL, still unchanged in Descript.**
- Defect tickets and exact timecodes: **No additional defect notes or individual timecodes supplied with the one-word PASS; do not infer unreviewed content has passed**
- Preferred Appendix B seam: **UNDECIDED** (Descript candidate / offline 8ms-smoothed alternative / neither)
- Permission to start production mastering: **NOT GRANTED BY THIS TRACKER**
- Permission to publish, merge PR, upload to member storage, or deploy Production: **NOT GRANTED**

## Machine checks already passed (not substitutes for listening)

- Six corrected Chapters 8–13 preserve 13,229 normalized core narration words, with intended part headings moved to correct opening.
- 20 private review tracks listed; all release flags OFF.
- Independently reconstructed Appendix B 8ms trial: 14:43, −16.31 LUFS, −2.21 dBTP, decoding PASS, no >5s silence at tested threshold.
- **Important:** Descript's editing interface cannot apply a verified 8ms fade; it did not change the actual Descript master/candidate. A/B smoothed audio exists only as private offline reconstruction.

## Gate to advance

Only after a real listener marks each checkpoint and supplies specific comments can accepted edits be selected for final mastering. Any FAIL/UNCLEAR must remain open until corrected and re-reviewed. After listening, conduct consistent mastering and a whole-book listen; require **separate explicit release authorization** for Production, member access, public Descript publishing or PR merge.

Current controls: PR #797 **draft/unmerged**, Descript public compositions **0**, Production/member distribution **OFF**.

## Owner approval — shortened Track 00 (2026-10-09)

- Owner approved continuing with the new shorter Mateo reproduction, excluding the spoken version/production-build announcement. Candidate private offline file: `/spanish-audiobook-track00-mateo-no-version-private-2026-10-09.wav`, approximately 1:45.31, preserved in Library.
- **Original Track 00:** listener reported clicks/poor narration — FAIL and archived, Descript original composition `91240c6b-78df-4910-a994-43c616f9b53f` remains untouched.
- **Shortened replacement:** approved for continuing **private QA only**; it has not been imported into Descript or independently approved for mastering/publication. The remaining frontmatter and chapter-join checks remain pending.
- Compliance/copyright text must not be silently altered or released without legal/editorial acceptance. NO PR merge, public publishing, member access, or Production change.

## Track 00 owner-directed deferral — DEFERRED_TO_FINAL_QA

Owner hears the same copyright-section error across versions and suspects playback-side causes. **Do not diagnose it as playback-side or mark PASS.** Keep original Track 00 `91240c6b-78df-4910-a994-43c616f9b53f` selected for private review, retain the original listener-reported defect at ~00:47.07, and defer further investigation to the final isolated playback/device QA pass. No more Track 00 repair or synthesis until owner asks.

Continue independently with the existing **51.101 s Part I reel** `db76c850-5004-4be7-bf56-70b93b04d779` and **186.888 s heading / Appendix B listening reel** `6b7b9e26-bde5-4b1b-a9f1-3346966a26c6`. Their acoustic decisions remain PENDING. All publication and Production gates stay HOLD.

## Independent Track 00 verification and private listener kit — 2026-10-09 (latest checkpoint)

- **Original source media:** Library `/00 - Lee primero el dólar.wav.mp3` (MP3 44.1 kHz mono, 113.345306s); SHA-256 `7f047959a07c527056ebb2446bf01a8008a806634751c67aa0338b64ace456dd`.
- **Non-destructive offline repaired candidate:** Library `/track00-private-declick-candidate-2026-10-09.wav` (24-bit PCM WAV, 44.1 kHz mono, same 4,998,528 decoded samples); SHA-256 `72ef9b827a87f2d340e200c2aa6d6315c7629ea94318a9b537d96773ecb53c0b`.
- Two source-waveform transients independently reproduced at **46.779274s** and **46.873764s**. The only intended repair windows are **46.772–46.850s** and **46.866–46.946s**. Original max sample jump in the first window was approximately **1.112328**; corrected max jump in the same window approximately **0.002504**.
- An independent decoded-PCM comparison found both files contain exactly **4,998,528 samples**, and **zero samples differ by more than 0.000001 outside the two repair windows** (maximum absolute quantization difference 0.000000119). The existing Track00 and Appendix B A/B archives each passed ZIP CRC verification.
- **New unified reviewer kit:** Library `/spanish-audiobook-private-listening-review-2026-10-09.zip`; SHA-256 `487c423d0ea7550353ca01d29369e6c0bc60d65b3927a588859821f93bf0fe2e`, contains audio-only paired excerpts, offline browser `index.html`, technical comparison JSON and local exportable review checklist.
- **Appendix B comparison** remains independent offline reconstructions, not actual Descript exports. Human listening still required at excerpt positions **00:14.84** and **00:47.12**.
- **No new synthesis or editing:** original Track00 Descript composition `91240c6b-78df-4910-a994-43c616f9b53f` remains selected, unchanged; no new import or Studio Sound applied. User's Track00 rerender deferral remains in effect. A measured transient does not prove every reported playback defect is resolved.
- **Required next gate:** actual listener compares original and offline corrected excerpt; separate original/corrected Descript playback verification will be needed if the candidate is selected. The Part I 51.101s reel and the 186.888s chapter/Appendix reel still require human decisions. **Do not mark any listening row PASS from technical measurements.**

**Disposition unchanged:** Track00 original listener-reported FAIL remains open, acoustic sign-off PENDING, final mastering HOLD, PR #797 DRAFT/unmerged, public Descript publishes 0, Production/member access OFF.

## Owner-reported scoped local A/B listening PASS — 2026-10-09

The owner replied **PASS** immediately after being asked to evaluate the four audio checks in the private, offline listening package `/spanish-audiobook-private-listening-review-2026-10-09.zip`. Record this as **owner-reported acceptance of the specific local A/B checks**, not independent listener certification of the full album or the actual Descript mix. No separate exported sign-off form, playback device, comments, individual timecodes or preferred Appendix B master variant were provided.

| Private package check | Owner-reported listening decision | Boundary |
| --- | --- | --- |
| Track 00: original vs offline declicked 43–55s excerpt | **PASS** | Only this corrected local clip; original Descript recording is unchanged and retains the historical reported click |
| Appendix B: first splice (58s raw vs smoothed, 00:14.84) | **PASS** | Offline comparison only, not a Descript export |
| Appendix B: second splice (58s raw vs smoothed, 00:47.12) | **PASS** | Offline comparison only, final chosen splice/master still undecided |
| Appendix B: institutional names in 58s excerpts | **PASS** | Only names covered by the private samples, not every title or technical term in the book |

**Disposition:** private A/B excerpt acceptance **PASS (owner-reported)**. No new synthesis, editing or media import is authorized or necessary from this verdict alone. The repair is still a candidate, **not selected into Descript**; preserve the current Track 00 composition `91240c6b-78df-4910-a994-43c616f9b53f`. An actual candidate mastered from the agreed source needs its own playback review.

**Still PENDING:** Part I 51.101s reel; five chapter joins in the 186.888s reel; Chapter 13 full disclaimer; Appendix A/B actual spoken titles; any remaining full-track pronunciation, pauses and loudness; the complete 20-track listen and consistent final mastering. Appendix B selection between the actual Descript repaired candidate and the smoothed offline alternative remains undecided. Original Track 00 source defect is **not retroactively marked PASS**. The copyright grammar/legal text is unchanged and still requires legal/editorial sign-off before any proposed change.

**Release controls unchanged:** PR #797 DRAFT/unmerged, public Descript publishing 0, member storage OFF, Production unchanged, full-book acoustic and mastering approval **NOT GRANTED**.

## Track 00 single-word private deletion candidate — 2026-10-09

- Owner reported hearing the same issue in the copyright section and requested: "just delete the word and let's move forward." The specific word was **not named** in that message. The operator interpreted this as the isolated spoken English word `Copyright` in the first line (`Copyright 2026`), **not** the earlier click transients near 46.78–46.87 seconds. This inference must be confirmed before any master selection.
- Descript Agent Underlord created **private reversible duplicate only** `a7f430c6-d368-4eae-8fc2-29b2f17486b1` (`00 - Copyright word omitted - private QA - DO NOT PUBLISH`). The single spoken word `Copyright` is ignored. `2026` remains at 00:03.270–00:04.230; `Todos los derechos reservados` at 00:05.090–00:06.930. The full following copyright clause and educational disclaimer are present in readback. Independent Descript metadata confirms **110.425306s** vs original **113.345306s**; the edit rippled 2.920s.
- The original composition `91240c6b-78df-4910-a994-43c616f9b53f` remains unchanged. The candidate is **not selected** in the canonical private manifest. `Copyright` omission is a **private audition variant, not canonical legal copy approval**. Whole-book legal text and exceptions were not changed.
- **QA not passed:** word-cut join between `USD Impact` and `2026` has not been waveform-verified or heard; `2026` beginning might be clipped. Original click transients near 46.78–46.87s (shifted to about 43.86–43.95s in the edit) have **not** been repaired in this Descript duplicate. The previously accepted offline declicked WAV is separate.
- The user's reported issue in the copyright area could instead refer to the click or another audible word. Do not infer this speculative removal fixes that report. Confirm exact intended deletion with the owner before further editing or mastering; avoid further repeated synthesis or new audio edits until clarified.
- **Release status unchanged:** PR #797 DRAFT/unmerged, public Descript compositions 0, Production/member storage OFF, full-book listening and mastering HOLD.

## Owner-confirmed Copyright deletion and combined offline QA — 2026-10-09

- **Unambiguous owner decision:** owner explicitly confirmed **the word `Copyright` at the beginning** of spoken Track 00 is the requested deletion and approved continuing private QA. Earlier uncertainty about which word was meant is therefore resolved. This is not authorization to remove `2026`, `Todos los derechos reservados`, copyright conditions, or the educational/non-advice disclaimer.
- **Current Descript private word-level variant:** `a7f430c6-d368-4eae-8fc2-29b2f17486b1` remains non-published; the original canonical composition `91240c6b-78df-4910-a994-43c616f9b53f` remains unchanged. Its 2.920s ripple edit is **not selected for master** because its transcript-only cut could truncate the spoken year. Descript composition metadata readback confirmed the original 113.345306s and private copy 110.425306s; acoustic proof for `2026` is not yet available.
- **Safer private offline WAV candidate built from the previously accepted declicked source**, using a silence-to-silence deletion of source samples **2.500–5.250s (2.750s)**, plus a **10ms fade applied only to pre-splice quiet material**. Subsequent audio, including the whole spoken year and the prior click repair near source times 46.779274/46.873764, is preserved sample-for-sample before 24-bit PCM encoding. No voice synthesis, changed words beyond the named deletion, legal manuscript change or destructive Descript edit.
- **Private candidate:** Library `/spanish-track00-copyright-removed-declicked-private-QA-2026-10-09.wav`; SHA-256 `98b5c92d291ed09881a7d1bef284a937fad04f2a61f4de4160767bb616efb0d5`; 44.1kHz mono 24-bit PCM; 110.595306s; FFprobe/decoder PASS. New-splice sample jump `0.0000823` full scale; no high transient near corrected former click locations **44.029274s** and **44.123764s**. Technical signal/structure checks PASS, **human acoustic review still PENDING**.
- **Listening package:** Library `/spanish-track00-copyright-private-QA-listening-kit-2026-10-09.zip`; SHA-256 `4abaf816eac70f9a2cf3d8980061c395f774da97896a33bb12dc3acf0efa9b03`, ZIP integrity PASS. Contains lossless before/after WAV clips for the opening and later disclaimer, technical JSON and local `index.html` for browser-based listening.
- **Private Drive copy, unshared:** `USD Impact/04_Language_Packs/spanish-track00-copyright-removed-declicked-private-QA-2026-10-09.wav` (Drive ID `1Je9aiLtl8QkhYLxPhOEGMX0-ePz11DAK`); Drive metadata reports `shared=false`, owner-only. The attempted Descript import using the authenticated/private Drive *view* URL **FAILED URL validation (HTML login/view rather than direct media)**, so the WAV has **not** been imported into Descript. Do not weaken Drive sharing to bypass this without separate authorization. All existing project originals and compositions remain unchanged after the import rejection.
- **Human hearing gate:** the revised 0–12s spoken `2026` must be checked for a complete initial syllable and natural pause, and revised ~44s disclaimer must be listened to independently. This candidate is NOT approved as a final audio master on signal readback alone.
- **Still on HOLD:** the Part I and chapter/Appendix reels, all-20-track listening, mastering and release. PR #797 DRAFT/unmerged; no public Descript publication, member storage, or Production change. Do not switch the private review manifest's canonical composition ID until the new combined source is actually imported and accepted.

### Direct private Descript upload attempt — stopped (2026-10-09)

- Direct signed-URL import job `project-media-import-44825e49-ab4d-472f-9d24-9452b18ac631` tried to upload the private 14,631,804-byte WAV to the existing Descript project. Sandbox storage host DNS resolution failed: HTTP 000, **0 bytes uploaded**. The upload was explicitly reported failed; Descript wait_for_job readback: **stopped/error — Failed to upload file**. No imported media or new composition resulted from this attempt.
- The separate private Google Drive link had already failed media-validation because the unauthenticated link returned an HTML page. Owner-only Drive sharing remains unchanged; do not make the asset public to bypass transfer controls.
- **Manual browser handoff if needed:** private WAV is in Library and Drive (`1Je9aiLtl8QkhYLxPhOEGMX0-ePz11DAK`) and can be added to Descript via the authenticated browser. On upload, create a new private audio-only composition rather than changing the canonical original, and check the opening/44s disclaimer by listening. No production/mastering/release authority is granted.

## Browser-imported private Track 00 candidate — October 9

- Owner manually uploaded the locally prepared WAV `spanish-track00-copyright-removed-declicked-private-QA-2026-10-09.wav` to an isolated Descript composition **`8efce146-f4c8-4a8f-89c0-b0bd5402abac`**, `00 - Copyright Fixed - PRIVATE QA`. Browser screenshot shows the imported file on the timeline, length 1:50.5, and transcription still at 0%. Connector readback independently confirms **110.595306s**, correctly matching the private WAV, and confirms original `91240c6b-78df-4910-a994-43c616f9b53f` remains present unchanged at 113.345306s. Descript project still lists **0 public publishes**.
- Private asset was imported via the owner's browser after the earlier connector attempted imports failed. Project media inventory includes the uploaded `...-1.wav` asset with the correct duration; the failed import attempt remains a separate historical record. No new TTS or generation was performed in this verification.
- **Current stage: TRANSCRIPTION PENDING / HUMAN ACOUSTIC CHECK PENDING.** The connector transcript export returned empty while in progress. At the beginning, reviewer must hear `USD Impact. 2026. Todos los derechos reservados`, with no English `Copyright`, no clipped first syllable of `dos`, and a clean transition. Around **00:44** the disclaimer `Este libro tiene un propósito exclusivamente educativo e informativo` must be heard without the previously reported click. Check remaining copyright and disclaimer words preserved. Listening of these specific regions is NOT inferred from metadata or waveform alone.
- This candidate is **not** automatically selected as canonical in the private review manifest, not mastered and not approved for full-book release. Part I and chapter/Appendix B private reels, whole-book acoustic review, legal/editorial review for any changed manuscript text, and mastering remain separate pending checkpoints. PR #797 stays **DRAFT/unmerged**, Production, member delivery and Descript public publish **OFF**.

## Owner PASS for imported Track 00 and follow-up suffix cleanup — 2026-10-09

**Owner listening decision, scope:** The owner replied **PASS** after being directed to play imported Descript private composition `8efce146-f4c8-4a8f-89c0-b0bd5402abac` (`00 - Copyright Fixed - PRIVATE QA`) and check **00:00–00:12** (word omission and complete "2026" opening) plus **00:40–00:52** (previously clicked educational disclaimer). Record this as owner-reported PASS **only for these two sections of that specific imported audio version**. No separate timestamp-level comments, hearing device, or full-track certification were supplied.

**Post-PASS independent transcript QA:** Completed SRT of the 110.595306s imported composition begins `USD Impact. / Right 2026. / Todos los derechos reservados.`, contradicting the intended complete omission of the English word `Copyright`: an audible-looking `Right` token remained before the year. This is an **ASR flag, not an independent human listening FAIL**. The source waveform also includes residual pre-year speech after the previous offline cut. Do not declare the original request fully remediated on the basis of the earlier two-point PASS alone.

**Non-destructive private follow-up:** Descript Agent Underlord duplicated the imported private composition into **`ebe7f026-e369-4dd4-a184-9476a6482f5b`**, titled `00 - Copyright Tail QA v2 - DO NOT PUBLISH`, and used an isolated reversible word-ignore edit for `Right` only. The clip shortened by **0.760s** (110.595306s to **109.835306s**); no new TTS, changes to original or imported v1, or publication. Connector readback confirms new v2 SRT starts `USD Impact. / 2026. / Todos los derechos reservados.`; remainder includes the original legal restrictions and education disclaimer, shifted by 0.760s (disclaimer begins around **00:43.55**). This is **transcript/structure QA PASS, not an acoustic PASS**. Agent cannot verify word edit splices by ear or sample-level waveform.

**Next listening requirement:** Audition **private v2 composition**, 00:00–00:09, for complete clean `2026` without a preceding `Right`/click, and 00:42–00:51 for clean educational disclaimer. Mark PASS / FAIL / UNCLEAR for v2 specifically. Prior PASS for v1 remains recorded without being transferred to v2. Then independently listen to the Part I 51.101s reel and 186.888s chapter/Appendix reel; 20-track mastering and release remain separately blocked.

**Release controls:** Keep original Track 00 composition `91240c6b-78df-4910-a994-43c616f9b53f` unchanged; v2 private audition only. PR #797 DRAFT/unmerged, zero public Descript publishes, no member/storage or Production changes, full-book acoustic/mastering approval NOT granted.
