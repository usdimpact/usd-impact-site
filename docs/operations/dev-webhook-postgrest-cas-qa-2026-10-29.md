# Issue #620 — Development-only PostgREST outbox concurrency acceptance

**Prepared:** 2026-10-29  
**Status:** Draft PR / offline validation only until separately gated manual execution.  
**Production:** HARD HOLD. This proposal does not authorize a Production query, email, scheduled task, deployment, merge or changes to Score, Research, payments or entitlements.

## Purpose

The existing Resend webhook handler uses a status-conditional PostgREST PATCH with the HTTP header Prefer: return=representation and re-reads the authoritative outbox state when a conditional update affects zero rows. Existing in-memory and SQL tests do not prove that the real Development HTTP interface enforces this behavior under concurrent requests.

This harness is a CLI test script, not a website route, webhook or scheduler. It cannot be triggered by visiting USD Impact. It has no Resend integration or ability to send email.

### Pinned environment

- Supabase Development project: **ycstrcvshdluovtuasjc**.
- HTTP target: **https://ycstrcvshdluovtuasjc.supabase.co**; no alternative host.
- Postgres direct host: db.ycstrcvshdluovtuasjc.supabase.co, user postgres; or a Supabase session-pooler host with user postgres.ycstrcvshdluovtuasjc.
- Postgres port 5432 only, database postgres, TLS verify-full using the **Development Supabase CA certificate** in a temporary owner-only file. Other project IDs, hosts and pooling modes are rejected.

## One synthetic, non-sendable fixture

The runner inserts exactly one randomized record into the Development notification_outbox table. Its synthetic email address uses reserved domain example.invalid, business object type webhook_http_cas_qa, classification operational, template ID support_case_received, no consent requirement, empty payload, and initial status accepted. It uses a unique notification:v1: SHA-256 idempotency identity and a synthetic provider-message reference; it is never queued for delivery.

The preflight found the existing insert-consent validator and update timestamp trigger, with no email-dispatch trigger on this table. The CLI never calls the provider.

## Acceptance contract

1. Check that **zero previous synthetic QA rows** remain in this Development table. If any exist, fail closed and reconcile them manually; never silently delete older fixtures.
2. Insert the synthetic fixture through a separate authenticated Development Postgres connection, validate the exact UUID and accepted state.
3. Launch two HTTP PATCH calls concurrently against the same observed accepted state. One requests delivered; the other complained. Both requests include the exact fixture UUID, provider=resend, synthetic provider reference, expected status and the response header Prefer: return=representation.
4. Require exactly one successful updated-row response and one empty-array response, then independently GET the authoritative winning state.
5. If delivered won, apply a later conditional complaint transition. A complaint must become terminal.
6. Replay the stale original-status delivery PATCH, require zero rows updated and verify terminal complained remains unchanged.
7. Delete only the exact fixture UUID together with its QA business type, provider reference and non-deliverable address. Verify zero rows with that UUID remain.
8. Always attempt cleanup from a finally block. The manual GitHub Actions job independently repeats cleanup in an always-running step. A failed cleanup marks the whole acceptance FAIL and preserves the restricted, nonsecret fixture manifest for remediation.

The script emits only allowlisted evidence: PASS/FAIL, winning transition, terminal status, cleanup result and Development project ID. It never prints tokens, database passwords, recipient addresses, raw HTTP bodies or SQL errors.

**Scope limit:** These checks prove the Development outbox status compare-and-set HTTP interface, not the end-to-end signed webhook handler, receipt races, legal consent, real-device passkeys or Production sends.

## Protected manual-run setup — NOT ACTIVATED

1. A reviewer examines the [Draft PR and its exact commit](https://github.com/usdimpact/usd-impact-site/pulls), including the standalone runner, offline test suite, workflow and this document.
2. Open [GitHub Environments](https://github.com/usdimpact/usd-impact-site/settings/environments). Create a dedicated environment named **development-webhook-cas**. Configure required reviewers and restrict branches to a separately approved execution path. Never reuse a Production environment. If the repository plan does not permit an effective approval gate, do not launch the live job.
3. Set five **Development-only GitHub environment secrets**, directly in GitHub UI, not in a chat, issue, screenshot or log:
   - DEV_WEBHOOK_CAS_REST_SECRET: Development sb_secret API key or Development service-role JWT.
   - DEV_WEBHOOK_CAS_PGHOST: Development direct or session-pooler hostname.
   - DEV_WEBHOOK_CAS_PGUSER: matching Development user.
   - DEV_WEBHOOK_CAS_PGPASSWORD: matching Development database password.
   - DEV_WEBHOOK_CAS_PGROOTCERT_PEM: complete public PEM of the Development database's CA certificate, downloaded from Supabase Database Settings > SSL Configuration. It is written only to a temporary file for hostname-verified TLS and deleted after use.

   Retrieve connection settings privately from the [Development Supabase dashboard](https://supabase.com/dashboard/project/ycstrcvshdluovtuasjc). Follow [Supabase's PSQL TLS instructions](https://supabase.com/docs/guides/database/psql) for the CA certificate. No credentials are included in the repository or passed as command-line arguments. The script requires Node 24 and the PostgreSQL psql client, with no third-party Node dependencies.
4. The workflow runs offline unit tests on pull requests with **no secrets**. The live job exists only for manual workflow_dispatch with exact-head SHA input, the explicit DEV_ONLY_NO_SEND confirmation, and the protected Development environment.
5. **Important registration limitation:** GitHub requires a newly introduced manual workflow to exist on the default branch before it is normally offered through the Actions UI. This Draft PR must therefore stay unmerged. Merging into main would normally trigger the Vercel Git integration and a Production deployment even if only QA files changed. A separate release and deployment approval is required before merging; do not bypass this by allowing a pull-request CI job to see secrets.
6. Only after that separate decision, use [Development PostgREST webhook CAS QA — Actions](https://github.com/usdimpact/usd-impact-site/actions/workflows/dev-webhook-postgrest-cas-qa.yml). Set approval to DEV_ONLY_NO_SEND and reviewed_sha to the exact 40-character Git commit being executed. The script rejects any mismatched SHA/project/host, missing credential, wrong trigger or insufficient approval.
7. Check both the actual live HTTP result and independent cleanup result; record only redacted evidence in [Issue #620](https://github.com/usdimpact/usd-impact-site/issues/620). No recurring schedule is installed and broader email activation stays HOLD.

## Fail-closed controls

- Missing credentials, runner, Postgres client, reviewed Git SHA or required environment review: do not run.
- Never expose a server secret in a browser client, GitHub artifact, ChatGPT conversation, raw CI log or public endpoint.
- Never use Production database credentials or broaden service_role DELETE privileges.
- Any unexpected HTTP response, two successful conflicting updates, invalid final state or incomplete cleanup: FAIL/HOLD.
- An offline green check is not equivalent to live Development PostgREST HTTP acceptance.
- All outbox test rows must be absent before moving to the next release stage.

## Source baseline

The branch starts at protected main SHA 06e185d39b4768e1f2ab8aeabccd63b531bf1435, following the approved Spanish cookie-consent release. Passkey #930, email-cron HOLD #931 and Progress consent #934 remain distinct Draft PRs.

No Production action is authorized or necessary to review the proposed tests.
