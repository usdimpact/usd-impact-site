# Spanish audiobook — Appendix B private QA and credit-hold recovery

Checkpoint date: **2026-10-09**. Branch: `feat/spanish-audiobook-pilot-foundation`.

**Release gate: HOLD.** Private production and QA only. Do not publish to Descript, Production, member storage, or commerce/auth. Voice remains **Narrator Mateo** (`626ca51acb2e496f8dcee8d7591fda3c`), `es-419`, `0.92x`; source remains Spanish Edition 1.3 Candidate 1.

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
- Descript's exported transcript for the 11-clip composition is **incomplete**: approximately 581 normalized transcript tokens compared with 1,252 source-script tokens, including one large missing *transcription* block. **Do not conflate missing Descript transcript with missing audio.** Preserve audio; investigate targeted transcription repair independently.
- Final audio true-peak/limiter and listening checks are **not passed**. Disposition: **AUDIO ASSEMBLY + PROVIDER SCRIPT/TIMESTAMP QA PASS; INDEPENDENT TRANSCRIPT + MASTERING HOLD**.

## Credit and guarded restart

- HeyGen `get_current_user`: Creator plan, premium credits remaining **0**, reset scheduled `2026-10-13T19:31:48Z`; no add-on credits reported.
- Remaining synthesis: **only segments 12, 13, 14, 15**. Segments 01–11 must not be regenerated.
- Until verified credits exist, **do not update the auto-trigger file** `docs/localization/heygen-api-trigger.json`, since changes automatically fire a costly GitHub Actions run. The current trigger still describes a stale range containing already-generated 09–11 and MUST be replaced with **12–15 only** after credit verification, immediately before a future authorized run.
- Closing Track 19 remains prepared/not triggered; use the same Mateo profile when credits are available.
- No purchases, plan changes, public publish, member access, entitlement, Production deployment, or merge were authorized by this checkpoint.
