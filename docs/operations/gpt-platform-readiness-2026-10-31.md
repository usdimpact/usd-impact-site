# USD Impact — GPT Platform readiness and opt-in Daily diagnostics

**Checkpoint:** 2026-10-31. **Status:** Draft-only implementation; no Production enablement, model upgrade, new OpenAI key, API request, billing change, schedule change, or publication authorization.

## What was verified

- The Daily source endpoint uses OpenAI Responses, web search, strict JSON and deterministic source/editorial validation. The background route uses a stored initial response for bounded retries; repair calls use store:false. This is an intentional storage/retention distinction, not proof that content retention policy has been approved.
- The Daily research code defaults to gpt-5 when OPENAI_NEWS_MODEL is unspecified. Its bounded repair defaults to gpt-5-mini (OPENAI_NEWS_REPAIR_MODEL can override it). Do not infer actual Production model selection from code defaults.
- Catalyst Brief source research has web grounding, validation and smaller-model repair. Both publication paths are protected by editorial and repository gates; model output is never automatic permission to publish.
- Vercel error groups dated 2026-10-27 through 2026-10-29 show source-count, provenance, stale-source and catalyst-consistency failures. Validation is doing useful work. Do not weaken it or assume a newer model fixes an unsupported source.
- The AI Guide remains design-only; the separate knowledge-search endpoint is a source-retrieval service, not a deployed OpenAI assistant.
- The independent integrity watchdog reviewer is optional and requires a dedicated key plus explicit model; it does not override deterministic evidence.
- The production API key's OpenAI project attribution, live model overrides, cost and API consumption are **not independently verified** from the available connector read surface. Do not assume this lab project pays for Production.

## Proposed improvement — metrics only, OFF by default

The branch introduces a pure helper and one offline test to support diagnostic logs when specifically enabled. It emits **only** a bounded JSON record containing:

- a fixed event/component/stage/outcome label;
- a sanitized model identifier;
- a bounded repair-attempt number;
- an enum-only validation failure category;
- provider-reported input, cached input, output, reasoning and total token counts when present.

It does not store prompts, generated text, source URLs, response IDs, API keys, customer data, log raw errors, call OpenAI, modify a publication, create a database table, or create a scheduled task. With USDIMPACT_GPT_METRICS_ENABLED absent (the default) or not exactly true, it emits **no diagnostic logs**. These counts are not billing certification; compare them with OpenAI Usage exports. The script's cost is the existing CI/test runtime only.

## Acceptance before any Production activation

1. Review the code diff; confirm unchanged source-generation, repair, release and fail-closed rules.
2. Run node scripts/test-gpt-usage-diagnostic.mjs from apps/web; run the existing validation and Web Quality checks.
3. Owner uses https://platform.openai.com/usage to compare the correct organization, **all** projects, and individual projects for the same UTC dates; export Activity and Cost CSV files. Do not paste API keys.
4. Owner uses https://platform.openai.com/settings/organization/projects and project Limits to verify model permissions, monthly spend alerts, hard-limit policy, and rate limits. Any budget change requires a separate decision.
5. Owner uses Vercel Environment Variables to check (without revealing secrets) the OPENAI_API_KEY scope/project association and OPENAI_NEWS_MODEL / OPENAI_NEWS_REPAIR_MODEL overrides.
6. Review the stored initial background response lifecycle, data retention and need for response retrieval before changing store:true or creating any learner-facing AI feature.
7. Only after separate production release approval, optionally set USDIMPACT_GPT_METRICS_ENABLED=true server-side for an explicitly bounded observation window. Never set it as a PUBLIC_ or browser-exposed variable.
8. Compare generated metadata-only logs with API usage totals and source-validation error classes. Reset/disable the flag after the observation window unless explicitly approved to continue.

## Next decisions, in order

**P0 — Daily scheduling:** UI-01 / Issue #840 remains the primary gate. The next real weekday native event is Monday 2026-11-02. A green fallback or skipped native schedule is not proof of native dispatch reliability. Do not force duplicate generation or adjust cron for this metrics patch.

**P1 — model evaluation:** Build an offline regression fixture set from redacted failures (source count, URL grounding, stale dates, catalysts and compliance). Compare candidate models with **no production writes**, no automatic upgrade, documented API spend approval and identical acceptance gates. Score verified facts and source-date/citation discipline, not simply fluency.

**P2 — learning guide:** Do not activate until the certified source corpus, access tiers, rights, privacy, grounded citation verification, and advice-leakage tests in docs/book-site-bridge/ai-guide-design.md are approved.

**Explicit HOLD:** No public tutor, no changed production model, no new key, no paid benchmark or API generation, no direct publish/merge, no changes to the operational Score or existing user entitlements.
