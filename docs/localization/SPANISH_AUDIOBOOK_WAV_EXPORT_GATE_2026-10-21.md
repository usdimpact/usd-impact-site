# Private Spanish audiobook WAV export gate — 2026-10-21

**HOLD — no selected WAV exported; no production or publication change.**

## Exact target and requested capability

The selected Track 00 composition is `ebe7f026-e369-4dd4-a184-9476a6482f5b` in the [private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca), duration **109.835306 s**. It is **not** the 110.595306-second older Drive private cleanup candidate. See the [20-track WAV provenance ledger](./SPANISH_AUDIOBOOK_WAV_PROVENANCE_REGISTER_2026-10-21.md).

A constrained Agent Underlord inspection was requested on October 21, forbidding composition edits, new synthesis, publication, share links, lossy substitution or member/production changes. Agent job `project-agent-edit-2f542797-4a70-4d44-a164-76dee15859ca-a7d793ca-c936-4e73-a5d7-2fb90bad0d56` completed with `result.status=success` **for the read-only capability investigation only** and `project_changed=false`; **it did not create an audio export**. Agent-reported AI credits used: `1.932`.

The agent reported:
- Its available `export_video` produces **MP4**, not lossless WAV/PCM. It could not set sample rate, bit depth or channel count.
- `publish_video` would create a shareable link, contrary to the explicit HOLD.
- Converting to audio-only would mutate the composition and **still would not guarantee** a WAV export.
- It therefore made **no source change, no export and no share/publish**. There is no new file name, export timestamp, SHA-256, decoded QA result, or acoustic acceptance.
- Descript's **interactive app** may offer direct WAV export, but that route was **not executed or verified** by this agent.

## Second source search

Read-only Google Drive search for the selected `109.835` duration and Track00 titles did not produce a positive, authenticated v2 export match; the original [Drive WAV folder](https://drive.google.com/drive/folders/1l5vmUukQpw4HoBhvs0N50fr2I4Wg3o8e) contains 63 WAV objects and no size-compatible v2 WAV. Separate ChatGPT Library listing revealed only **older** Track 00 private variants; none is proven the selected v2.

## Next safe operator action

1. Use the [private Descript project](https://web.descript.com/2f542797-4a70-4d44-a164-76dee15859ca) and open composition **`ebe7f026-e369-4dd4-a184-9476a6482f5b`**. Use the **direct Export** dialog to inspect whether an **audio WAV / PCM download** is offered, **without** Share/Publish or editing the composition.
2. If a nonpublishing WAV export is available, export **only this exact composition**. Write down the tool/format/export UTC timestamp and place the unchanged export in the **private** Drive QA folder (not public site/member storage). If that requires altering the composition or publishing, **stop**.
3. Before using any result as a selected master, hash the exact bytes with SHA-256 and verify header/decoder, channel count, sample rate, bit depth, duration, clipping, true peak, integrated loudness, discontinuities, whole-track listening and owner verification against its SHA-256. Do not assume the export's content merely from filename or duration.
4. Repeat the same per-selected-composition provenance steps only after the Track 00 method is proven safe. Track 18 and Tracks 02–15 remain especially vulnerable to wrong alternate-selection.

## State invariant

No PASS for Track 00 WAV provenance or mastering. No new export. All **20 selected WAV master identities unconfirmed**. `production_enabled=false`, `public_allowed=false`, `merge_allowed=false`, `publication_approval=NOT_GRANTED`, `mastering_approval=PENDING`. Keep PR #797 **draft / unmerged**; no member access, Vercel, Supabase, Render, Resend, Lovable, or Production changes.
