# Content-only publishing CI

## Purpose and boundaries

Reduce duplicated technical validation for new Daily and Catalyst publications without reducing source, editorial, calendar, compliance, archive, security, build or release protections. This is a CI routing change, not permission to publish or a repair for a failed source claim.

No generation endpoint, importer, fact/date validator, source allowlist, publication content, dependency, provider configuration, secret, schedule, retry budget, entitlement or delivery setting is changed by this design. Source-attribution repair remains separate. An open release hold is not cleared by selecting the content route.

## What changes

| Stage | Previous path | New path |
| --- | --- | --- |
| Before the Daily/Catalyst publication PR | Complete `npm run validate` (14 groups), then `npm run build` | Five existing content preflight groups; no pre-PR full build |
| Web Quality on the publication revision | All platform steps and production build | Content-specific route only after exact evidence checks; otherwise all platform steps and build |
| Push to main | Full Web Quality | Full Web Quality; never the lighter route |
| Other required workflows, Preview and release review | Independent gates | Unchanged independent gates |

The five preflight groups are `validate:content`, `validate:news`, `validate:compliance`, `validate:links` and `validate:publishing`. They still stop before PR creation on failure. The new runner reports command duration and stops on the first failed or interrupted command.

This removes one full validation/build pass from the pre-PR publication sequence. It does **not** promise only one build across GitHub PR events, explicit exact-head validation, main push, Vercel Preview and Production. It does not eliminate every repeated test: the content preflight and exact-commit validation deliberately overlap at separate boundaries.

## Conservative route selection

The default is `full`. The `content-only` route requires all of the following:

1. The exact repository is `usdimpact/usd-impact-site`. The event is a same-repository open PR targeting current main, or a manual quality dispatch with both exact base and exact head inputs. Inputs are evidence constraints, not a route override. Main pushes and other events always use full validation.
2. The policy is extracted from freshly fetched `origin/main`, not imported from the candidate branch. It is self-contained and runs before project dependency installation. An unavailable policy or failed fetch falls back to full validation. Consequently the first PR introducing the policy cannot optimize its own checks.
3. The fetched main SHA matches the claimed base, the checked-out SHA matches the expected revision, and the base is an ancestor of the head. A PR merge checkout must have exactly the expected base/head parents and the same tree as that head. Base movement or mismatched evidence cannot enable the lighter route.
4. The complete local Git raw diff, not an API first-page filename list, contains only additions of regular non-executable Markdown files at these paths:
   - `apps/web/src/content/news/YYYY-MM-DD.md`
   - `apps/web/src/content/catalyst-briefs/YYYY-MM-DD-<event>-preview.md`
   - `apps/web/src/content/catalyst-briefs/YYYY-MM-DD-<event>-outcome.md`
5. There are at most 10 files, at most 256 KiB per file and at most 1 MiB combined. All are valid UTF-8 with the recognized importer-style frontmatter. Raw HTML, unexpected root fields, malformed input and alternate formats fall back to full validation. This recognizer is **not** a sanitizer, complete schema validator or fact checker.
6. The newest Web Quality run returned for that exact main base is a completed, successful **main-push** run, no more than 72 hours old. Its workflow identity, repository, branch, event and SHA must agree. Missing, truncated, malformed, stale, future-dated, failed, pending or approval-required evidence falls back to full validation. A newer failed quality run cannot be replaced by an older green one.

Corrections to existing articles, deletions, renames, MDX, executable files, symlinks, content plus code, dependency/configuration/workflow changes and unknown paths use the full route. A full fallback is not rejection of an otherwise legitimate article; it simply retains the broader technical checks.

The selector writes its reason and, on the content route, its base, head, file list and baseline run ID to the workflow summary. It does not store or grant an editorial approval. A main update after route selection must still be caught by release preflight and repository protections; this selector is not a merge lock.

## Coverage map

### Retained for both routes

- Dependency installation under the existing strict script policy and the high/critical vulnerability audit.
- GitHub Action runtime and AI control-center contracts.
- The selector and workflow regression suites.
- Content, **news**, reports, compliance, links, **UX**, publishing/calendar and automation-health groups.
- Knowledge retrieval and the existing no-apply corpus validation: the corpus includes Daily and Catalyst content, so this is not an unrelated platform check.
- Daily Cards validation, retained conservatively.
- The unchanged `npm run build`, including its purchase-access-email, rendered structured-data, accessibility, checkout-presentation, CSP and production-build contracts.

`validate:news` and `validate:ux` are explicitly added to Web Quality because the previous broad pre-PR validator covered them and the former Web Quality workflow did not call those groups directly. Removing pre-PR full validation must not remove that coverage.

### Narrowed only for proven new-publication-only revisions

Five broad steps are omitted on the lighter route: Vercel function contracts, paid access/protected audiobook contracts, quiz contracts, protected video-library contracts and Supabase contracts. The exact base must already have the successful full-platform result described above. All five remain on every full route and every main push. Skipping them is reported by job steps; it is not described as rerunning those tests successfully.

The publishing tests embedded inside the broad function group are retained separately on the content route:

- `test-daily-news-source-function.mjs`
- `test-daily-news-grounded-schema.mjs`
- `test-daily-news-editorial-validation.mjs`
- `test-daily-news-validation.mjs`
- `test-daily-news-collection-normalization.mjs`
- `test-import-daily-news.mjs`
- `test-daily-news-retry-policy.mjs`
- `test-catalyst-brief-selection.mjs`
- `test-catalyst-brief-source-function.mjs`
- `test-import-catalyst-brief.mjs`

The full route continues to run them through the original function group, not a second new copy.

### Factual and editorial boundaries

Generation, grounded-source validation, import-time checks, calendar enforcement, duplicate protection and archive overwrite protection are unchanged. Source document identity, date basis, factual support, figures/units/reference periods and preview/outcome distinctions still need their applicable source/editorial checks. An approved domain, a well-formed URL or a passing regression fixture is not proof that a current claim is true. Do not reuse factual approval merely because code is unchanged or the platform baseline is green.

## Exact-version quality handoff

Both publication workflows pass the PR's exact base and head to their existing quality dispatch. Run lookup also requires a creation time at or after that dispatch request, in addition to the matching head. Both workflows require an explicit `success` conclusion; `action_required`, cancelled, skipped, unknown and failed outcomes are not success.

The required job name remains `validate-and-build`, the workflow name remains `Web quality`, and the PR/main/dispatch triggers remain. There are no workflow path filters, `continue-on-error`, auto-merge commands or protection bypasses. Only read-only Actions access is added to Web Quality to inspect the baseline.

A successful manually dispatched run does not waive required PR-event checks or their approval requirements. Inspect the repository's actual required-check state. Do not rename or remove required contexts as a shortcut. Independent CodeQL, Dependency Review, supply-chain, calendar-enforcer and applicable Preview requirements remain in force.

The Daily failure classifier preserves its historical default `site-validation-build` label for existing callers. This workflow supplies a bounded `publication-content-preflight` label so failures accurately describe the new stage. Failure in exact-head Web Quality retains the separate publication-quality gate.

## One consolidated release decision

Prepare one release packet only after routine read-only verification is complete. Include:

- Exact repository, PR, base/head SHA and full file scope; factual/source/calendar review tied to the publication bytes.
- Current required PR-event checks, exact-head quality evidence and independent applicable security checks; actual Preview readiness and relevant page verification.
- Unresolved reviews, release holds, base/head drift and any deployment anomaly; precise merge/deployment scope for owner authorization.

Do not repeatedly ask for permission merely to inspect already-authorized evidence. Do not turn a technical green into publishing approval. A changed head, changed base or changed publication evidence invalidates the affected approval and must be reassessed. Production verification remains a post-release obligation, not something inferred from CI.

## Validation and rollout

The implementation PR is a code/workflow change and must take the **full** route. Local selector tests use disposable synthetic Git repositories and mocked baseline metadata, not live publications, credentials or customer records. Workflow contract tests inspect the actual files and parse shell syntax without dispatching them. These tests do not substitute for full-project Node 24 CI, actual required checks, Preview or factual review.

Before release, verify the complete implementation diff, full Node 24 quality result, applicable security/required checks and actual Preview. Do not merge or deploy on local tests alone. No automatic Daily or Catalyst generation is part of testing this change.

After a separately authorized release and a genuine eligible publication, inspect the route summary and step durations. Compare similar editions and separate generation time, preflight time, queue/approval delay, exact-version CI, Preview and owner-review time. Measure full fallbacks, rejected content, bypass incidents and end-to-end readiness time. The baseline implementation provides no measured percentage speedup.

Rollback of the CI change requires the normal reviewed code-change process. Preserve sources, calendar checks, archive protection, security workflows and editorial/release approval during rollback. Never use a bypass of those protections as a performance experiment.
