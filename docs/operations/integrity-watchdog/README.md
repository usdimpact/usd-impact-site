# USD Impact Integrity Watchdog

## Purpose

The watchdog applies the project integrity rule: identify what works, establish why it works, use it as the reference standard, and elevate weaker workflows through direct evidence, regression tests, and explicit approval gates.

It never treats the absence of an observed error as proof of success. It never labels an unusual result as broken without evidence. A single passing run can establish only `A_GOLD_CANDIDATE`; permanent `A_GOLD` requires accepted longitudinal evidence.

## Installed first slice

The first slice adds:

- a 33-workflow top-to-bottom register;
- deterministic repository and public-runtime contracts;
- current-head GitHub quality and branch-protection checks;
- optional Vercel, Supabase, Resend, and Google Drive evidence collectors with explicit provider and credential limitations;
- an optional independent OpenAI reviewer using structured JSON output and `store: false`;
- redacted evidence manifests, workflow classifications, and proposed-only fix packets;
- hourly critical checks, Monday full recertification, manual dispatch, and exact owner/collaborator comment commands.

The initial 19 contracts cover workflow permission and pinning safety, credential-shape scanning, canonical redirects, the Library Pass product contract, legal identity, checkout fail-closed behavior, anonymous paid-access denial, source-endpoint authorization, Score claim boundaries, privacy choice, Daily freshness, GitHub quality and protection, Vercel source and configuration metadata, Supabase Security Advisor, Resend domain and webhooks, Drive source metadata, and independent review.

## Safety boundary

The workflow has read-only GitHub permissions. It cannot merge, deploy, dispatch publication workflows, open or edit issues, send email, mutate Supabase, alter payments, change customers or entitlements, modify Google Drive, or rotate secrets.

HTTP bodies are used transiently to test explicit markers. Artifacts retain only bounded metadata, matched markers, selected non-secret headers, and SHA-256 fingerprints. Secret values, cookies, raw tokens, unnecessary personal data, email bodies, and Drive document contents are prohibited.

Fix packets are always `PROPOSED_ONLY` and always require human approval.

## Outbound network boundary

All network requests are restricted in code to HTTPS, the default HTTPS port, and this exact host allowlist:

- `usd-impact.com`
- `www.usd-impact.com`
- `score.usd-impact.com`
- `api.github.com`
- `api.vercel.com`
- `api.supabase.com`
- `api.resend.com`
- `api.openai.com`
- `oauth2.googleapis.com`
- `www.googleapis.com`

Credentials embedded in URLs and non-default ports are rejected. Redirects are handled manually, every redirect target is revalidated against the same allowlist, and redirects are never followed for POST requests. A response body is rejected above 750,000 bytes. Canonical USD Impact URLs and the canonical repository are immutable runtime constants; the policy file must match them exactly or the run fails closed.

## Schedule

- Hourly at minute 17: critical repository, GitHub, and public-runtime contracts.
- Monday at 05:23 UTC: full provider recertification.
- Manual workflow dispatch: choose `critical` or `full`, `audit_only` or `fix_ready`, and optional AI review.
- Pull request: unit, schema, and syntax validation only.

A verified P0 failure yields `RED / NOT_READY`. P0 unknowns, P1 failures, warnings, or incomplete evidence yield `AMBER / READY_WITH_CONDITIONS`. Unknown is never green.

## Connected GitHub commands

An exact issue or pull-request comment from a repository `OWNER`, `MEMBER`, or `COLLABORATOR` can trigger a read-only run:

- `/watchdog critical` — critical scope, fix-ready packets, no AI review;
- `/watchdog full` — full provider scope, fix-ready packets, no AI review;
- `/watchdog full ai` — full provider scope with the independent reviewer, only when both the dedicated OpenAI key and an explicit approved model variable are configured.

No prefix, suffix, extra argument, or command from an untrusted association is accepted. The workflow does not post a reply and retains read-only repository permissions.

## Outputs

Each audit uploads:

- `report.json` — redacted machine-readable findings;
- `report.md` — human-readable summary;
- `workflow-register.json` — all workflows with current classifications;
- `evidence-manifest.json` — report and evidence fingerprints;
- `fix-ready/*.json` — proposed remediation packets when mode is `fix_ready`.

## Local validation

```bash
node --check scripts/integrity-watchdog-policy.mjs
node --check scripts/integrity-watchdog-http.mjs
node --check scripts/integrity-watchdog-repository.mjs
node --check scripts/integrity-watchdog-provider-common.mjs
node --check scripts/integrity-watchdog-github.mjs
node --check scripts/integrity-watchdog-vercel.mjs
node --check scripts/integrity-watchdog-supabase.mjs
node --check scripts/integrity-watchdog-resend.mjs
node --check scripts/integrity-watchdog-drive.mjs
node --check scripts/integrity-watchdog-collectors.mjs
node --check scripts/integrity-watchdog-reviewer.mjs
node --check scripts/integrity-watchdog-artifacts.mjs
node --check scripts/integrity-watchdog.mjs
node scripts/test-integrity-watchdog.mjs
node scripts/integrity-watchdog-vercel.test.mjs
node scripts/integrity-watchdog-supabase.test.mjs
node scripts/integrity-watchdog-resend.test.mjs
node scripts/integrity-watchdog-drive.test.mjs
node scripts/integrity-watchdog-artifacts.test.mjs
node scripts/integrity-watchdog-reviewer.test.mjs
node scripts/integrity-watchdog-github-rulesets.test.mjs
node -e "JSON.parse(require('fs').readFileSync('docs/operations/integrity-watchdog/POLICY.json', 'utf8'))"
node -e "const i=JSON.parse(require('fs').readFileSync('docs/operations/integrity-watchdog/WORKFLOW_INVENTORY.json', 'utf8')); if(i.workflows.length !== 33) throw new Error('Incomplete inventory')"
```

Run a read-only audit:

```bash
node scripts/integrity-watchdog.mjs --scope=critical --mode=fix_ready --ai-review=false
```

Do not place secrets on a shared command line or print environment files. Use the approved repository secret store.

## Optional provider configuration

The critical watchdog works with the GitHub-provided token and public routes. Full recertification recognizes these dedicated settings:

| Provider | Name | Required access |
|---|---|---|
| OpenAI | `USDIMPACT_WATCHDOG_OPENAI_API_KEY` | Project-scoped key for independent review only |
| OpenAI | `USDIMPACT_WATCHDOG_OPENAI_MODEL` | Explicit approved Responses/Structured-Outputs-capable model; required when AI review is enabled. `gpt-5.6-terra` is the current recommended bounded-review choice, not a silent code default. |
| Vercel | `USDIMPACT_WATCHDOG_VERCEL_TOKEN` | Dedicated credential with the minimum read access available for the target project; no general Vercel credential fallback |
| Vercel | `USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID` | Target identifier |
| Vercel | `USDIMPACT_WATCHDOG_VERCEL_TEAM_ID` | Target identifier |
| Supabase | `USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN` | Dedicated fine-grained PAT with `Advisors: Read` / `advisors_read`; no general Supabase credential fallback |
| Supabase | `USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF` | Production project reference |
| Resend | `USDIMPACT_WATCHDOG_RESEND_API_KEY` | Dedicated full-access key only after separate owner approval; never reuse the general Production sending key |
| Resend | `USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED` | Must be exactly `true`; defaults to `false` |
| Resend | `USDIMPACT_WATCHDOG_RESEND_DOMAIN` | Optional; defaults to verified `updates.usd-impact.com` |
| Resend | `USDIMPACT_WATCHDOG_RESEND_WEBHOOK_ENDPOINT` | Optional; defaults to `https://www.usd-impact.com/api/resend-webhook` and scopes lifecycle evidence to that enabled endpoint |
| Google Drive | `USDIMPACT_WATCHDOG_GOOGLE_SERVICE_ACCOUNT_JSON` | Dedicated service account limited to `drive.metadata.readonly`; no general Google credential fallback |
| Google Drive | `USDIMPACT_WATCHDOG_GOOGLE_DRIVE_ROOT_FOLDER_ID` | Exact `USD Impact — Release Control Center` folder shared read-only with that account |

Missing optional provider configuration is reported as `E_UNKNOWN`; it is not silently treated as healthy. Do not install a write-capable credential solely to remove an unknown result.

The Supabase Security Advisor collector calls only `GET /v1/projects/{ref}/advisors/security`. Current Supabase permissions allow a fine-grained token with `Advisors: Read` / `advisors_read` to access that endpoint, so the watchdog must use a dedicated token with only that read permission. The endpoint is experimental and deprecated. A clean response is therefore never sufficient for `PASS`; the contract remains `WARN` until direct RLS, grant, view, function, trigger, Auth, and Storage-policy evidence is independently collected.

Resend currently exposes `full_access` and `sending_access` API keys, not a metadata-only read key. The collector uses only `GET /domains` and `GET /webhooks`, but a full-access credential is still write-capable. It remains blocked unless a separate owner approval is recorded through `USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED=true`. Only the dedicated `USDIMPACT_WATCHDOG_RESEND_API_KEY` is eligible; the general Production `RESEND_API_KEY` is intentionally not a fallback. Disabled webhooks do not satisfy lifecycle coverage, and webhook URLs are never persisted in watchdog evidence.

## Provider-secret fallback policy

The temporary provider-secret reuse approved on September 4, 2026 has now been fully retired from the integrity watchdog. Vercel, Supabase, Resend, and Google Drive collectors accept only their dedicated watchdog credentials. OpenAI likewise has no general credential fallback.

The Supabase fallback to `USDIMPACT_SUPABASE_ACCESS_TOKEN` is intentionally retired because the Security Advisor endpoint supports a narrower fine-grained `Advisors: Read` permission. Vercel does not inherit `USDIMPACT_VERCEL_TOKEN`; Resend does not inherit `RESEND_API_KEY`; Google Drive does not inherit `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON`. Missing dedicated configuration remains `E_UNKNOWN` rather than borrowing a broader Production credential merely to remove uncertainty.

## Google Drive provenance evidence

`DRIVE-SOURCE-OF-TRUTH` is intentionally metadata-only. When the dedicated service account and Release Control Center folder ID are configured, the collector:

- verifies that the configured root is exactly `USD Impact — Release Control Center`;
- locates exactly one `01_FINAL_BOOK_CURRENT` folder and one `09_QA_CHECKSUMS` folder;
- verifies unique metadata for the accepted Edition 1.3 Candidate 2 PDF, its Candidate 2 SHA-256 record, and its owner-acceptance record in the current-book folder;
- verifies that the QA folder exposes SHA-256 marker metadata and at least one checksum-manifest CSV;
- records only bounded counts, timestamps, booleans, and SHA-256 digests of Drive item IDs.

The collector never downloads Drive files, never reads checksum or document contents, never persists Drive filenames in the evidence artifact, and never changes Drive files or sharing. A complete metadata structure can establish `PASS / B_FUNCTIONAL`; it is not proof that the checksum text equals the delivered file bytes. Byte-level provenance remains a separately governed expansion.

## Vercel evidence boundary

When direct Vercel API configuration is unavailable, full recertification can still inspect the exact `GITHUB_SHA` through GitHub's combined commit-status endpoint. A successful status whose context begins with `Vercel` establishes bounded evidence that Vercel accepted the exact current head. This result is classified as `B_FUNCTIONAL`, not GOLD, because it does not independently expose the Production target or environment metadata.

When a dedicated Vercel credential is configured, the collector uses GET-only project/deployment/environment requests, the current deployment endpoint, and the current project-environment endpoint with `decrypt=false`. The variable-presence contract uses only Production variable names. Provider-returned value fields are ignored and never persisted in watchdog evidence. The collector never requests decrypted values and the workflow does not fall back to the general `USDIMPACT_VERCEL_TOKEN`.

`VERCEL-CONFIG-PRESENCE` remains `E_UNKNOWN` until that dedicated Vercel credential and target identifiers are separately approved and installed. Public runtime contracts separately continue to test canonical routing, security headers, checkout, access denial, legal identity, consent, Daily freshness, and product behavior. A successful commit status must never be treated as proof that every Vercel configuration value is correct.

## Independent reviewer

The OpenAI reviewer is secondary to deterministic evidence. It receives only normalized, redacted findings and proposed fix packets. It may confirm, challenge, or mark evidence insufficient. It cannot change deterministic contract outcomes, approve its own repair, or call write tools.

Current OpenAI documentation confirms `gpt-5.6-terra` supports the Responses API and Structured Outputs and is appropriate for intelligence/cost-balanced workloads. The watchdog nevertheless has no silent model default: AI review remains `E_UNKNOWN` unless both the dedicated project-scoped key and `USDIMPACT_WATCHDOG_OPENAI_MODEL` are explicitly configured. This prevents unreviewed model substitution or drift from being hidden by code defaults.

The reviewer uses `POST /v1/responses` with `store: false`, an explicit strict JSON schema, `tools: []`, `tool_choice: none`, and no previous response/conversation state. A refusal, incomplete response, malformed envelope, or invalid structured assessment remains `E_UNKNOWN`; it never upgrades deterministic evidence.

## Expansion queue

The first slice deliberately retains these explicit gaps rather than simulating coverage:

1. direct read-only Supabase RLS, grant, view, function, trigger, and Storage-policy snapshots;
2. Lemon Squeezy payment, webhook, order, and entitlement reconciliation without customer mutation;
3. Cloudflare R2 and Stream object, caption, manifest, and token-boundary reconciliation;
4. HeyGen source-to-delivered-video provenance where still relevant;
5. Resend delivery-event-to-Supabase-ledger reconciliation and latency SLOs;
6. Drive byte-level revision-to-repository-to-public-output manifests beyond metadata-only provenance;
7. persistent deduplicated incident history and repeated-failure thresholds;
8. browser-based authentication, consent-network, checkout, and accessibility verification;
9. complete Score release recomputation and independent replication execution.

Every expansion must preserve the no-write default and exact human approval boundaries.
