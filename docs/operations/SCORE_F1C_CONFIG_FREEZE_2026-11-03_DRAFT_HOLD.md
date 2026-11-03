# Additional F1b adversarial review: commented/aliased Astro loader bypass
_Date: 2026-11-03 | Draft-only, no Production authority_

## Reproduction and disposition

The original [#1080](https://github.com/usdimpact/usd-impact-site/pull/1080) loader check compares two exact source **strings** and searches only additional `glob({})` expressions containing `reports` or `score`. At that source-policy layer, a modified `content.config.ts` can leave the exact Weekly loader line in a comment while activating an indirect `archiveLoader` pointing to a neutral directory such as `./src/content/auxiliary`. The original check returns PASS. This was confirmed by independent source-policy evaluation; it is **not** a demonstrated Production exposure or full end-to-end build exploit.

## Fail-closed correction

Pin the **complete Git blob identity** of the existing Production `apps/web/src/content.config.ts`, SHA-1 `dc34afdf430a074d4118d55a4f7001564d7bcc2c`, while original Score publication-rights HOLD remains active. This exact blob matches both Production main `d1740214f5737996f321a037efe3f2f7d21ecd64` and the head of #1080 at review time. Change the two existing trusted loader checks only by adding the whole-file hash check, plus negative tests for comments, indirect aliases and unreviewed schema edits. Clean original configuration remains allowed.

**Trade-off:** unrelated legitimate collection-schema edits also fail until an independently reviewed update to the policy. This is deliberate during the Score rights freeze and is not a substitute for approved source licensing.

**Still unresolved:** F2's PR-controlled guard/workflow design; trusted-base execution plus owner CODEOWNERS and strict required-check policy must be bootstrapped separately. A malicious PR that edits the security guard alongside its own content remains out of scope for this same-PR execution. F3 Vercel Preview custom-domain authentication remains owner HOLD. Date-based built-output checks cannot detect all semantically Score-derived copying to arbitrary paths, and original historical Score output rights are not cleared.

## Verification before accepting

- Confirm exact frozen config blob against main and the new Draft head.
- Confirm three new source-policy negatives and all preexisting nested reports, real filesystem and published artifact tests.
- Require GitHub exact-head `fail-closed-contract` Production- and Preview-classified build success and Supabase migration intake success.
- Keep original CodeQL parent review threads open; no merge, deploy, public route, rights or GitHub ruleset changes.

This correction should be incorporated only after independent owner/security review of its scope and the full stacked ancestry. The live site is unaffected by Draft work.