# Capacity Preview metadata adapter - proposed, inactive

## Purpose

Review-only native metadata adapter for the existing Vercel watchdog reporting
contract. It is NOT registered with `integrity-watchdog-collectors.mjs`, does not
change workflow YAML, and is not called by any scheduled or manual audit. Importing
it has no provider side effect. This is not a repair of the hosted Preview.

The companion test module is imported by the existing Vercel test entrypoint.
That change runs synthetic tests, not the collector against a real account.
The audit and publication-calendar schedules and their permissions are unchanged.
If later merged, the test import adds the new synthetic checks to the existing
Vercel test step, including two real five-second deadline cases (about ten seconds
per test invocation). This is not zero recurring CI/audit test overhead.

## Four-file proposed scope

- Add `scripts/integrity-watchdog-capacity-preview.mjs`.
- Add `scripts/integrity-watchdog-capacity-preview.test.mjs`.
- Add the offline test import to `scripts/integrity-watchdog-vercel.test.mjs`.
- Add this document.

No application, dependency, schema, provider setting, permission, secret store,
workflow YAML, existing collector or source PR is changed by this proposal.
The original test assertions remain byte-for-byte intact.

## Before any real collection

Activation requires separate approval, the dedicated watchdog Vercel credential
and exactly the approved project/team identifiers. A trusted transport must be
passed explicitly. `process.env` and `globalThis.fetch` are not implicit fallbacks.
The adapter does not look up, create or widen a credential, and does not prove its
permissions. These must be established before activation, not by probing writes.
Missing dedicated configuration remains UNKNOWN. General credentials are never
substituted. Do not ask the owner to paste credentials into chat.

One approved invocation can make at most one GET:

`/v10/projects/{approvedProjectId}/env?decrypt=false&teamId={approvedTeamId}`

There is no automatic retry, pagination request, key-specific decryption, mutation
endpoint, CLI runner, alert sender or deployment action. A five-second budget
spans headers, response-body reading and parsing; the decoded response is bounded
to 750,000 bytes, 1,000 returned variables and 20 exact SUPABASE_URL records.
Aborting bounds local waiting; it does not prove remote work stopped. Response
redirects, final-URL mismatches, partial-response headers, unknown root semantics,
malformed data and unsupported native timestamps remain UNKNOWN.

## What is retained

Only exact-key SUPABASE_URL metadata is projected: native row identifier, target
list, creation/update timestamps, and a classified branch relation. The complete
approved branch and the historically reported short branch are distinct constants.
Other branch names are omitted. NEXT_PUBLIC_SUPABASE_URL is not an exact-key match.
Opaque values, plaintext values, creator information, comments, integration hints
and arbitrary metadata are never copied into evidence. The raw native response is
transient, not persisted, and is never used as a report error message.

A currently parsed listing is not an exhaustive historical inventory. An empty
array is not proof that the earlier Save never occurred. Conflicting exact-branch
records are never resolved by selecting the first or last entry. Custom-environment
scope is not discarded to manufacture a Preview-only result.

## Scope metadata is NOT destination or deployment proof

The adapter deliberately ignores every `value` field, including SUPABASE_URL.
It must therefore never fill the previous validator's `origin` from the intended
Development URL. Doing that would convert a desired setting into alleged evidence.
There is no automatic conversion into a passing `assessPreviewSelection` receipt.

The collection contract may PASS because bounded metadata fields were parsed.
The separate isolation contract remains UNKNOWN even with one correctly scoped
record: the non-secret destination, effective frozen deployment configuration and
prior mutation reconciliation still require independent evidence. Widening an
exact matching branch beyond Preview produces a scope FAIL. No result grants
release or deployment approval, and none certifies customer capacity.

The adapter uses the existing watchdog `result`, classifications, sanitizer,
evidence digest, `health` and proposed-only remediation handling in tests. It does
not replace the watchdog's status vocabulary or create another reporting service.
The two contract IDs are CAPACITY-VERCEL-URL-METADATA and CAPACITY-PREVIEW-ISOLATION,
under existing workflow VERCEL-DRIFT-02. They are not registered at this stage.

## Outcome-cohort review - separate producer required

The earlier offline gate checks declarations such as `complete` and `deduplicated`;
it does not prove a capture really was complete or remove duplicate events itself.
A metadata collector cannot supply the missing browser-save population. Before
integrating that part, a separately reviewed producer must define:

1. Exact project, team, source, deployment, environment and capture window.
2. One opaque per-attempt identifier kept transiently, not an email/account ID.
3. One terminal browser result per initiated eligible save attempt. A browser
   timeout and its late server acknowledgement are NOT two attempts or a success.
4. Retries as new attempts, while optionally reporting logical-save outcomes
   separately. Expected anonymous refusals do not enter the member denominator.
5. Started-but-unfinished attempts, lost telemetry, sampling and dropped records
   as incomplete coverage, not success. Queue/drain boundaries must be explicit.
6. A reproducible pooled histogram or deduplicated raw-duration percentile method,
   with sample count, population and window. Averaged instance p95s are invalid.
7. Low-cardinality outputs only; no raw URLs, auth headers, member IDs or tokens.

No live browser instrumentation, event collector, stream counter or SQL was added.
The prior billing gate also requires a trusted upstream source to verify the
correct organization, cycle and all-project scope; the standalone input's simple
`all_projects` label is not an organization identity. Do not manufacture a receipt
from unrelated project/account data just because its numerical shape passes.

## Verification and deployment boundaries

Local tests exercise the actual unchanged watchdog policy module, not a substitute.
They do not execute the entire existing Vercel test entrypoint or full repository.
Fresh Node 24/watchdog CI and security checks remain required for a future draft PR.
A dedicated credential's current availability in GitHub was not inspected here.
Tests contain synthetic responses and do not contact Vercel or USD Impact.

Do not add this work to video PR #695. Publishing the four-file candidate to a
separate draft monitoring PR requires exact base/scope approval. Review first;
keep it inactive. A later activation/collector-registration decision has separate
credential, scheduling, privacy, cost and live-verification scope.

## Primary documentation

- Vercel native environment listing (queried through connected documentation):
  https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name
- Environment-variable scope and new-deployment applicability:
  https://vercel.com/docs/environment-variables

The public documentation describes a read endpoint and branch/decryption inputs;
it does not provide this organization's actual records. Unsupported response
variants fail closed pending review. No claim of live API compatibility follows
from synthetic tests alone.
