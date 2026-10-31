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

## Owner-supplied dashboard checkpoint — 2026-10-31

The owner provided five direct screenshots of the OpenAI Platform and Vercel dashboards. These are UI observations, not complete API billing/export evidence and not proof of credential-to-project identity.

| Check | Observed value | Scope / qualification |
| --- | --- | --- |
| Selected API project | USD Impact H1 Lab | Usage dashboard filtered to this project, all API sources and API keys |
| H1 Lab usage | 0 requests, 0 tokens, no usage data | Selected **Last 7 days**, not a full October activity export |
| H1 Lab October spend | $0.00 | OpenAI Projects table |
| H1 Lab limit | $1.00 | OpenAI Projects table; do not increase automatically |
| Default project October spend | $2.15 | Project table; do not attribute to USD Impact until supported by project logs or usage breakdown |
| Organization October spend indicator | $2.15 / $100.00 | Personal organization; this is not evidence of sufficient budget controls for every project |
| Vercel `OPENAI_API_KEY` | present for Production and Preview | Secret remains masked; screenshot shows last update September 7 |
| Vercel `OPENAI_NEWS_MODEL` | present for Production and Preview | Masked; exact deployed model value **not established** |
| Vercel `OPENAI_NEWS_REPAIR_MODEL` | no match in Project environment variables search | Existing repair fallback in code is gpt-5-mini; absence alone is not a defect |

The H1 Lab project was created September 25, after the Vercel OpenAI key was last updated on September 7 according to the screenshots. This chronology and the H1 Lab's zero observed usage **suggest** that the active production key is associated with the older Default project, but the dashboard evidence is insufficient to certify that identity. Do not rotate or reassign the working key based solely on inference.

**Owner-only follow-up:** In https://platform.openai.com/usage, remove the project filter, select October 1–31 and compare project and model costs. In https://platform.openai.com/settings/organization/projects inspect project-level limits and key metadata without disclosing key material. In https://vercel.com/usd-impact/usd-impact-site/settings/environment-variables keep secrets masked, confirm the exact model name only if it can be shown without exposing the API key, and do not edit Production. Any key migration requires a separate documented rollback and smoke-test plan.

**CI coverage:** `apps/web/package.json` now adds `node scripts/test-gpt-usage-diagnostic.mjs` to the existing `validate:automation-health` chain. Successful CI must be observed on the **latest** PR head before considering the branch reviewed.

## Owner screenshot reconciliation — full October 2026

Three further owner-supplied OpenAI dashboard screenshots (2026-10-31) resolve the **project-level spend and model inventory**, but not yet the mapping from the deployed Vercel key to the API project.

- **Default project; October 1–31, 2026:** Total spent **$2.15**, **72 requests**, **1,024,045 input tokens** in the Responses and Chat Completions usage view.
- **Model dimension:** The only model displayed for that input-token breakdown was `gpt-5-mini-2025-08-07` (1.024M input tokens). This is observed **Default-project API usage**, not a verified Production `OPENAI_NEWS_MODEL` environment value, and does not establish that every request belonged to USD Impact.
- **USD Impact H1 Lab:** The prior project listing showed **$0.00 October spend**. Its API Keys page, with access set to all project keys, showed a single **expired** replacement key named `usd-impact-h1-lab-replacement`: created 2026-09-27, last used 2026-09-27, expired 2026-10-27, monthly spend **$0.00**. Do not copy key prefixes, tracking IDs or secret material into audit reports.
- **Account chronology:** The H1 Lab was created 2026-09-25, after the currently shown Vercel Production/Preview API key entry was last updated 2026-09-07. Both timing and usage suggest the Vercel key is **not** the expired H1 Lab replacement key. This is a strong inference, **not a verified key/project identity**.
- **Earlier last-seven-days screenshot:** Across all projects it showed **34 requests**, **570,781 tokens** and **$1.12** over the selected window. These totals are a **subset** of, not a replacement for, the full-October Default-project view.

**Reconciliation status:** **PASS** for project-level October spending, request count and the displayed model-token breakdown. **HOLD** for attributing production traffic to a particular key, establishing the exact Vercel `OPENAI_NEWS_MODEL` value, migrating keys/projects or changing the Production model. The Daily source code defaults to `gpt-5`, and its smaller bounded repair model defaults to `gpt-5-mini`; the visible Default-project `gpt-5-mini-2025-08-07` usage may reflect the research override, repairs or unrelated workloads. Do not conflate these.

**Remaining manual non-secret evidence:** In OpenAI Usage for the **Default project** and October 1–31, view the **API Keys**/Services breakdown and compare masked key labels (never share key values). In the Vercel Project environment settings, inspect **only** the non-secret model name for `OPENAI_NEWS_MODEL`; do not reveal or rotate `OPENAI_API_KEY`. Keep the H1 Lab $1.00 limit and all existing Production controls unchanged. No new key is required to complete this audit.

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
