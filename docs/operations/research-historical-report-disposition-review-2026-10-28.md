# Research historical report rights and access disposition — review packet

**Prepared:** 2026-10-28  
**Status:** REVIEW ONLY / ALL 16 UNDECIDED / RIGHTS HOLD / NO PRODUCTION CHANGE  
**Authoritative blocker:** [pipeline rights Issue #155](https://github.com/usdimpact/usd-impact-pipeline/issues/155).

## Why this second packet is needed

The existing immutable source inventory confirms **13 Weekly and 3 Monthly** reports are already static/public, including the designated complete 2026-08-07 Research sample. All 16 use component-discussion language, and all 13 Weekly sources reference a Score `weekly_input.json`. No reviewed provider/counsel distribution right has been recorded for the source-derived output.

A report being marked `status: published` in Astro content means **public static output exists**, not that it is commercially licensed or that a paying Research member has exclusive access.

The new machine-readable [disposition review packet](../../apps/web/scripts/fixtures/research-historical-disposition-review-2026-10-28.json) maps the 16 current URLs **one-to-one** against the frozen, Git-blob-backed [source inventory](../../apps/web/scripts/fixtures/research-report-public-baseline-2026-10-28.json). No report is reclassified, redacted, moved or approved. Only non-sensitive metadata is repeated; report bodies and source values are not copied.

## Decisions required for *each* existing report

For each existing public URL, the authorized owner/editorial reviewer and provider/counsel must separately record:

1. **Current public rights:** Are this report's source-derived values, contribution text, source links and aggregate Score statements eligible for public display? Identify the exact scope and written evidence; never infer consent from public availability.
2. **Paid-member rights:** Does the same source/provider allow subscription delivery, or must a genuinely different reviewed data input and license be used?
3. **Access classification:** Keep historical public, produce a reviewed aggregate-safe public replacement, or migrate **future-only newly authored content** to protected Research delivery. Existing historical content must never be silently moved behind a paywall.
4. **URL/history treatment:** For each existing public route, review preserve/replace/redirect/remove choices, existing newsletter links, indexing, caches, canonical/sitemap/feed behavior, archived copies and historical report correction/retention notices.
5. **Audit retention and checkout truthfulness:** Before any redaction, preserve authorized private evidence under an approved secure origin. Review Research marketing copy that promises full current Weekly/Monthly member reports when the historical archives remain public.

The selected public sample remains `/research/sample/`. It is **not** a rights receipt and must be independently reviewed for public derived content. A proposed aggregate-safe score JSON schema does not settle legal data-distribution rights by itself.

## Possible outcomes for the 16 historical URLs

| Option | Release effect | Prerequisite | Current authorization |
| --- | --- | --- | --- |
| Keep historical reports publicly accessible | Existing URL remains | Written public scope rights + editorial decision | HOLD |
| Replace with vetted aggregate-only historical report | Same URL with different body | Provider/counsel scope + fixed schema + cache/history plan + owner signoff | HOLD |
| Remove or redirect historical public content | Changes existing links and archival access | Legal retention assessment + source evidence preservation + customer/SEO/cache plan + Production approval | HOLD |
| Move existing body to member-only storage | Requires no prior public copies to remain accessible and a separate paid rights scope | Written paid-member rights + secure private origin + actual session/entitlement checks + cache handling | HOLD |
| Keep an approved old public sample while new reports are private | Requires two distinct authorization scopes | Sample public rights + new paid rights + age rule + exact-head end-to-end QA | HOLD |

**Moving an unlicensed report behind a paywall does not cure source-redistribution rights.** Likewise a public HTML page cannot be made private with middleware alone if its static/CDN copies already exist.

## Automatic non-activation checks

The new `audit-research-historical-disposition-review.mjs --check` is wired **only to Draft PR #924's `validate:reports`**. It verifies exactly 16 snapshots with matching route/date/40-hex Git blob, the singleton sample, unchanged rights HOLD, all future dispositions `undecided`, no owner/counsel approval claim, no private origin authorization and no Production flag.

Any added, modified, deleted, reordered, automatically privatized or allegedly rights-cleared report fails the review, requiring a separate owner+provider/counsel decision and deliberate template versioning. Synthetic mutation tests prove that it **cannot** authorize publishing even when someone fabricates an approval flag.

This packet is a *decision checklist*, not a legal opinion or operational migration plan. No route, report, sitemap, cache setting, public provider data, research data, entitlement, purchase, subscription, payment, webhook, Production deployment or legal approval was changed.

## Next owner-controlled handoff

- Attach the official rights and licensing findings to Issue #155; obtain a per-output and per-use written response from provider/counsel.
- Select the historical-report URL retention policy and confirm the public sample's permitted data scope.
- After rights, authorize and implement real private Research report storage in Development/Preview, with independent first paid-member acceptance and strict return of 401/403 for non-entitled users.
- Only after exact-head security/QA, explicit owner approval and a verified Production release should the Draft be considered for merging into runtime.

**Default today:** **all 16 historical reports remain observed-public, unreviewed and unchanged**, and every new private/report distribution approval remains false.
