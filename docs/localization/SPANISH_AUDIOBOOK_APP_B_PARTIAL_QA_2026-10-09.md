# Spanish audiobook — Appendix B private QA and funded recovery

## Authoritative latest checkpoint — funded recovery + private repair candidate (2026-10-09)

**Current release gate: PRIVATE QA HOLD.** The earlier zero-credit blocker has been resolved for the repository's actual Developer API wallet, but a private replacement clip still needs *acoustic listening, splice verification, and mastering*. Production, entitlements, member storage, commerce, public Descript publishing, and merge remain prohibited without a separate release approval.

- Repository-key Developer wallet checked by GitHub run **37848860009**: `billing_type=wallet`, USD **$30.12** before synthesis. Subsequent readback **$29.40**, without a manual top-up during this workflow. The prior zero Creator subscription credits were a different balance, not this API wallet.
- Appendix B is now **15/15 generated and assembled** privately. Funded recovery runs: **37848963290** (segment 12), **37849165505** (segments 13–15); original private composition **aef945b9-0b31-48ad-9ec6-270c80f639c7**, **859.063 seconds / 14:19.1**. All original audio pieces remain.
- Closing Track 19 (*Sobre el autor*) is **1/1 generated and imported** privately, run **37849448901**, composition **1d15c8e2-dc3f-4c2d-9b95-b84a435dcb0b**, **43.598 seconds**, independent transcript **89/89 normalized tokens**.
- Appendix B original source-vs-independent-transcript readback: **1,572/1,670 exact normalized tokens (94.13%)**, with the formerly identified **28-word** institutional-source reference omission in clip 18-03. Audio-only listening remains needed before considering the original clip correct.
- Private repair workflow 99: initial piece A timed out in run **37849777222**, with provider warning that the operation **might** have been submitted. That exact request is quarantined **do not retry**; no usable audio was returned. The *distinct* reference-sentence piece B succeeded, run **37850234396**, **32.287 seconds**, no zero-duration spoken words in provider timestamps.
- Piece B is stored in a separate private QA composition **cd5a3d50-0a65-4ee2-b40a-c0eaee491338**, independent STT **42/43 exact normalized tokens (97.67%)**, with only numeral `quinientos` vs `500`.
- Descript created a **separate repaired Appendix B QA duplicate** **6a251168-1d0d-4a9d-b9ea-daed1d1db016** (**883.028 seconds / 14:43.0**). It retained original media until the sentence boundary at approximately **40.89 seconds** within clip 18-03 and inserted the validated reference sentence before clip 18-04. Original master remains untouched at 859.063 seconds.
- Direct complete repaired-candidate source-vs-transcript comparison: **1,599/1,670 exact normalized tokens (95.75%)**; **no omissions longer than three normalized source tokens**. The remaining three-token mismatch is numeric form `doce coma cinco` / `12.5`.
- **Final acceptance still pending:** a human must listen to the clip 18-03 cut, pronunciation of ICE/CME/NYMEX/S&P Dow Jones Indices/Cboe/Treasury/FRED, and the inserted recording's transitions; mastering must check loudness, peaks, and adjacent chapter/part transitions. The repair candidate is *not* automatically accepted as the delivery master.
- PR **#797 stays OPEN/DRAFT**, unmerged; changed-file scope: **241** files — **239** under `docs/localization/`, **2** CI workflows. There are no changes outside those two scopes. Descript publish count is **0**.

**Historical context:** the original recovery details below describe the *earlier* partial-credit state. They are retained for traceability and are **superseded** where they conflict with the authoritative checkpoint above.

---

Checkpoint date: **2026-10-09**. Branch: `feat/spanish-audiobook-pilot-foundation`.

**Release gate: HOLD — Segment 18-03 suspected material spoken omission.** The provider's complete word-timestamp *text* was not proof that each word was audible. Review `docs/localization/SPANISH_AUDIOBOOK_APP_B_SEGMENT03_REPAIR_PLAN_2026-10-09.md` before any release. In addition, segments 12–15 remain ungenerated due zero HeyGen credits. Private production and QA only. Do not publish to Descript, Production, member storage, or commerce/auth. Voice remains **Narrator Mateo** (`626ca51acb2e496f8dcee8d7591fda3c`), `es-419`, `0.92x`; source remains Spanish Edition 1.3 Candidate 1.

## Evidence and recovery

- Track 18: **Apéndice B — Metodología de la USD Impact Score**; 15 planned narration segments.
- Batch A: GitHub run `37842325398` / artifact `11577893181`: segments **01–08**, 8/8 generated.
- Batch B: GitHub run `37844306100` / artifact `11579291355`: segments **09–11**, 3/7 attempted segments generated. The provider rejected segment 12 with `insufficient_credit`; segments 13–15 were never called.
- First Descript import job `project-media-import-87f9ad2c-40ac-41f3-92ea-0d03fdc80696` showed stale `running / Processing / 0%` state and an incomplete transcription. After confirming the complete eight-item media assembly and preserving the GitHub artifact, the stalled job was cancelled; all 8 audio pieces remained in the private composition.
- Exact replay-free import of existing **09–11** through job `project-media-import-aec47d57-90bb-4535-aeb0-71595fc73fdf`: **success**, 3/3 segments; no prior pieces were regenerated.
- Descript private master project: `2f542797-4a70-4d44-a164-76dee15859ca`, Appendix B composition: `aef945b9-0b31-48ad-9ec6-270c80f639c7`.
- **11/15** generated and assembled, composition **607.269 seconds (10:07.3)**; media files `18-01.mp3` to `18-11.mp3` all present.

## Audio technical and text controls

- All **11/11** preserved MP3 files decode without errors, are uniquely hashed, and have no detected continuous silence lasting more than four seconds at the tested threshold.
- Prepared scripts 01–11 versus HeyGen `word_timestamps`: **1,252/1,252 exact normalized matching tokens** (100%). This verifies provider timestamps agree with submitted narration script, **not** independent acoustic correctness or end-to-end listening quality.
- Descript's **initial** exported transcript for the 11-clip composition was incomplete: approximately 581 tokens compared with 1,252 source-script tokens. Subsequent transcription-only repair restored clips 03–08, but a *material suspected spoken omission* remains within clip 03: an approximately 28-token institutional source-reference passage is still absent from independent STT, coinciding with 16 zero-duration provider timestamps. **Do not presume content is audible merely because provider timestamps list its words.**
- Final audio true-peak/limiter and listening checks are **not passed**. Disposition: **AUDIO ASSEMBLY PASS; MATERIAL CONTENT QA HOLD FOR CLIP 18-03, CREDIT HOLD FOR 12–15, FULL LISTENING AND MASTERING HOLD**.

## Credit and guarded restart

- HeyGen `get_current_user`: Creator plan, premium credits remaining **0**, reset scheduled `2026-10-13T19:31:48Z`; no add-on credits reported.
- Remaining synthesis: **only segments 12, 13, 14, 15**. Segments 01–11 must not be regenerated.
- Until verified credits exist, **do not update the auto-trigger file** `docs/localization/heygen-api-trigger.json`, since changes automatically fire a costly GitHub Actions run. The current trigger still describes a stale range containing already-generated 09–11 and MUST be replaced with **12–15 only** after credit verification, immediately before a future authorized run.
- Closing Track 19 remains prepared/not triggered; use the same Mateo profile when credits are available.
- No purchases, plan changes, public publish, member access, entitlement, Production deployment, or merge were authorized by this checkpoint.

## Transcript repair attempt (private only)

- Agent Underlord transcription-only job: `project-agent-edit-2f542797-4a70-4d44-a164-76dee15859ca-60e240c5-16e1-45b1-adaf-9dec3ed2f0b2`.
- Target: restore independently derived Spanish transcripts for EXISTING audio clips 18-03 through 18-08 without editing audio, duration, clip count, or publishing.
- Final observed agent job status: **stopped/success**, completed from existing audio without replacement synthesis. Independent Descript transcript recovered 1,200 normalized tokens versus 1,252 prepared script tokens (1,159 exact; **92.57%** token agreement); the institutional-reference gap in clip 03 remains unresolved.
- Verified readback after repair: **11 audio clips**, unchanged **607.269 s** composition, and **0 publishes**. QA HOLD remains in effect until the clip 03 content discrepancy is resolved, plus final listening/mastering.

## PR scope check

- PR #797 currently changes **237 files**: **235** under `docs/localization/` and **2** GitHub workflows. No application runtime, Production route, commerce/auth, or entitlement files are in this PR diff. **Keep PR open/draft**.
