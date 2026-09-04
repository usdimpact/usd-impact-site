# USD Impact Integrity Watchdog

## Purpose

The watchdog applies the project integrity rule: identify what works, establish why it works, use it as the reference standard, and elevate weaker workflows through direct evidence, regression tests, and explicit approval gates.

It never treats the absence of an observed error as proof of success. It never labels an unusual result as broken without evidence. A single passing run can establish only `A_GOLD_CANDIDATE`; permanent `A_GOLD` requires accepted longitudinal evidence.

## Installed first slice

The first slice adds:

- a 33-workflow top-to-bottom register;
- deterministic repository and public-runtime contracts;
- current-head GitHub quality and branch-protection checks;
- optional Vercel, Supabase, Resend, and Google Drive evidence collectors with explicit credential boundaries;
- an optional independent OpenAI reviewer using structured JSON output and `store: false`;
- redacted evidence manifests, workflow classifications, and proposed-only fix packets;
- hourly critical checks, Monday full recertification, and manual dispatch.

The initial 19 contracts cover workflow permission and pinning safety, credential-shape scanning, canonical redirects, the Library Pass product contract, legal identity, checkout fail-closed behavior, anonymous paid-access denial, source-endpoint authorization, Score claim boundaries, privacy choice, Daily freshness, GitHub quality and protection, Vercel source and configuration metadata, Supabase Security Advisor, Resend domain and webhooks, Drive source metadata, and independent review.

## Safety boundary

The workflow has read-only GitHub permissions. It cannot merge, deploy, dispatch publication workflows, open or edit issues, send email, mutate Supabase, alter payments, change customers or entitlements, modify Google Drive, or rotate secrets.

HTTP bodies are used transiently to test explicit markers. Artifacts retain only bounded metadata, matched markers, selected non-secret headers, and SHA-256 fingerprints. Secret values, cookies, raw tokens, unnecessary personal data, email bodies, and Drive document contents are prohibited.

Fix packets are always `PROPOSED_ONLY` and always require human approval.

## Schedule

- Hourly at minute 17: critical repository, GitHub, and public-runtime contracts.
- Monday at 05:23 UTC: full provider recertification.
- Manual: choose `critical` or `full`, `audit_only` or `fix_ready`, and optional AI review.
- Pull request: unit, schema, and syntax validation only.

A verified P0 failure yields `RED / NOT_READY`. P0 unknowns, P1 failures, warnings, or incomplete evidence yield `AMBER / READY_WITH_CONDITIONS`. Unknown is never green.

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
node --check scripts/integrity-watchdog.mjs
node scripts/test-integrity-watchdog.mjs
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
| OpenAI | `USDIMPACT_WATCHDOG_OPENAI_MODEL` | Optional; defaults to `gpt-5.6-terra` |
| Vercel | `USDIMPACT_WATCHDOG_VERCEL_TOKEN` | Dedicated project/account read access |
| Vercel | `USDIMPACT_WATCHDOG_VERCEL_PROJECT_ID` | Target identifier |
| Vercel | `USDIMPACT_WATCHDOG_VERCEL_TEAM_ID` | Target identifier |
| Supabase | `USDIMPACT_WATCHDOG_SUPABASE_ACCESS_TOKEN` | Management API token limited to required read scopes |
| Supabase | `USDIMPACT_WATCHDOG_SUPABASE_PROJECT_REF` | Production project reference |
| Resend | `USDIMPACT_WATCHDOG_RESEND_API_KEY` | Resend currently has no metadata-only API-key permission; do not configure without separate approval |
| Resend | `USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED` | Must be exactly `true` before the GET-only collector may use an approved full-access key |
| Resend | `USDIMPACT_WATCHDOG_RESEND_DOMAIN` | Optional; defaults to `usd-impact.com` |
| Google Drive | `USDIMPACT_WATCHDOG_GOOGLE_SERVICE_ACCOUNT_JSON` | Service account limited to `drive.metadata.readonly` |
| Google Drive | `USDIMPACT_WATCHDOG_GOOGLE_DRIVE_ROOT_FOLDER_ID` | Canonical folder shared read-only with that account |

Missing optional provider configuration is reported as `E_UNKNOWN`; it is not silently treated as healthy. Do not install a write-capable credential solely to remove an unknown result.

The Supabase advisor Management API endpoint used by the first slice is experimental and deprecated. A clean response is therefore never sufficient for `PASS`; the contract remains `WARN` until direct RLS, grant, view, function, trigger, Auth, and Storage-policy evidence is independently collected.

Resend currently exposes `full_access` and `sending_access` API keys, not a metadata-only read key. The collector uses only `GET /domains` and `GET /webhooks`, but a full-access credential is still write-capable. It remains blocked unless a separate owner approval is recorded through `USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED=true`.

## Independent reviewer

The OpenAI reviewer is secondary to deterministic evidence. It receives only normalized, redacted findings and proposed fix packets. It may confirm, challenge, or mark evidence insufficient. It cannot change deterministic contract outcomes, approve its own repair, or call write tools.

`gpt-5.6-terra` is used as the default reviewer model because the reviewer is a bounded structured-analysis workload. The model can be changed through the repository variable without changing the secret or code.

## Expansion queue

The first slice deliberately retains these explicit gaps rather than simulating coverage:

1. direct read-only Supabase RLS, grant, view, function, trigger, and Storage-policy snapshots;
2. Lemon Squeezy payment, webhook, order, and entitlement reconciliation without customer mutation;
3. Cloudflare R2 and Stream object, caption, manifest, and token-boundary reconciliation;
4. HeyGen source-to-delivered-video provenance where still relevant;
5. Resend delivery-event-to-Supabase-ledger reconciliation and latency SLOs;
6. Drive revision-to-repository-to-public-output manifests;
7. persistent deduplicated incident history and repeated-failure thresholds;
8. browser-based authentication, consent-network, checkout, and accessibility verification;
9. complete Score release recomputation and independent replication execution.

Every expansion must preserve the no-write default and exact human approval boundaries.
