# External release evidence procedure

This runbook is the owner-executable, read-only procedure for clearing the two unresolved external release gates for PR #140.

## Scope and safety boundary

This procedure may verify Vercel Production configuration and Paddle Live configuration. It must not merge PR #140, deploy to Production, enable checkout, alter environment variables, change Paddle configuration, create a transaction, expose credential values, or weaken any existing gate.

Every verification result must be bound to the exact current release SHA. If the PR head changes, discard prior evidence and repeat the procedure.

Current release branch: `release/production-library-pass-20260812`

Current expected release SHA at time of writing: `24a755f0e65f9e17ad901c74f52cf6fb0e44e3cb`

Before execution, re-read PR #140 and replace the SHA above with the current exact head if it changed.

## Evidence hygiene

Allowed evidence contains only:

- provider and gate identity;
- exact release SHA;
- observation timestamp;
- non-secret provider/audit reference;
- variable names and environment targets when required;
- boolean/readiness state;
- approved host/domain names;
- product/price IDs only where they are already intended configuration identifiers and not credentials.

Never copy, paste, screenshot, log, attach, or commit:

- API keys;
- secret keys;
- webhook secrets;
- client tokens;
- passwords;
- Authorization headers;
- full environment variable values;
- session cookies.

If a screenshot contains secret values, redact them before retaining it. Prefer views that reveal variable names without values.

## Gate 1 — Vercel Production environment

Expected Vercel scope:

- team: `team_1LuMlacGuM198mRjoID4O3Ct`
- project: `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`
- project name: `usd-impact-site`
- environment: Production

Required Production-scoped variable names:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_ENVIRONMENT`
- `PADDLE_API_KEY`
- `PADDLE_LAUNCH_PRICE_ID`
- `PADDLE_STANDARD_PRICE_ID`
- `PUBLIC_PADDLE_CLIENT_TOKEN`
- `PADDLE_CHECKOUT_URL`
- `PADDLE_CHECKOUT_ENABLED`

### Preferred API method

Use an authenticated read-only Vercel token locally. Do not paste the token into ChatGPT, GitHub comments, shell history that will be shared, or files.

Run the existing collector from `apps/web`:

```bash
VERCEL_TOKEN='<local-secret>' node scripts/collect-vercel-release-audit.mjs > /tmp/vercel-release-audit.json
```

The collector performs only GET requests to the expected project and environment endpoints. It discards ordinary values and emits only Production-scoped names/targets plus normalized checkout state.

Verify the generated JSON contains:

- `provider: "vercel"`
- `authenticated: true`
- `readOnly: true`
- `valuesExposed: false`
- exact expected project ID/name
- all required Production variable names
- `PADDLE_CHECKOUT_ENABLED` with `state: "closed"`

If any required variable is absent, the target is not Production, checkout is not explicitly CLOSED, the project differs, or the API call fails, stop. The Vercel gate remains BLOCKED.

### Dashboard fallback

If API execution is unavailable, open Vercel Dashboard > `usd-impact-site` > Settings > Environment Variables and select Production.

Capture proof showing:

1. project name and Production scope;
2. all required variable names exist in Production;
3. `PADDLE_CHECKOUT_ENABLED` is explicitly disabled/false/CLOSED;
4. values remain hidden or fully redacted.

Use a non-secret reference such as a timestamped owner audit ID in the final evidence record. Dashboard screenshots alone do not justify filling in unknown state; every required item must be visibly proven.

## Gate 2 — Paddle Live

Required Paddle Live controls:

1. Paddle account is approved for Live use.
2. `usd-impact.com` is approved as the production domain/site.
3. Live catalog is active and matches the application configuration for the launch and standard prices.
4. Live API credentials are present and valid.
5. Live notification/webhook destination is configured and validated for:
   `https://www.usd-impact.com/api/paddle-webhook`

### Preferred authenticated API method

Use Paddle Live API access locally where available. Do not paste API credentials or Authorization headers into evidence.

Collect only non-secret metadata sufficient to prove:

- environment is Live;
- account approval state;
- domain `usd-impact.com` approval state;
- intended live product/price IDs are active;
- an authenticated harmless read request succeeds with the live credential;
- the notification destination exists, is enabled/validated, and points to the exact Production webhook URL.

Record provider-generated resource IDs or audit references where available. Do not retain request headers or secret values.

### Dashboard fallback

In Paddle Dashboard, ensure the account is in Live mode and capture redacted proof for:

- account/verification status showing approved/ready for Live;
- domain/site status for `usd-impact.com` showing approved;
- Products/Prices showing the intended active live catalog IDs;
- Developer Tools / Authentication showing live credentials exist without revealing their values;
- Notifications/Webhooks showing the exact Production destination and validated/enabled status.

If any control cannot be demonstrated, stop. The Paddle gate remains BLOCKED.

## Required evidence records

Do not manually invent `verified` records from incomplete screenshots or stale state. Only construct records after every required control for that gate has been freshly proven.

For the exact release SHA, the eligible structured records are:

```json
{
  "gate": "vercel-production-environment",
  "status": "verified",
  "source": "vercel-api",
  "ref": "vercel-api:project-env:<project-id>:<timestamp>",
  "observed_at": "<ISO-8601 timestamp>",
  "release_head": "<exact 40-char release SHA>"
}
```

```json
{
  "gate": "checkout-closed",
  "status": "verified",
  "source": "vercel-api",
  "ref": "vercel-api:checkout-gate:<project-id>:<timestamp>",
  "observed_at": "<ISO-8601 timestamp>",
  "release_head": "<exact 40-char release SHA>"
}
```

```json
{
  "gate": "paddle-live",
  "status": "verified",
  "source": "paddle-api",
  "ref": "paddle-api:live-readiness:<non-secret-audit-ref>",
  "observed_at": "<ISO-8601 timestamp>",
  "release_head": "<exact 40-char release SHA>"
}
```

If dashboard evidence is used instead, use only source classes already accepted by the gatekeeper policy (`vercel-dashboard`, `owner-visible-vercel`, `paddle-dashboard`, or `owner-visible-paddle` as applicable).

## Envelope assembly

The full gatekeeper envelope uses schema `usd-impact.release-gate-evidence.v1`:

```json
{
  "schema": "usd-impact.release-gate-evidence.v1",
  "release_head": "<exact 40-char release SHA>",
  "records": [
    "<fresh Vercel Production record>",
    "<fresh checkout CLOSED record>",
    "<fresh Paddle Live record>",
    "<fresh Production data-plane record from the already approved evidence path>"
  ]
}
```

For `production-promotion`, all required records must be fresh under the gate-specific freshness windows. Do not reuse a stale record merely because it was previously valid.

The repository validator will reject malformed JSON, wrong SHA, stale timestamps, unsupported sources, unverified statuses, invalid refs, arbitrary fields, and secret-bearing payloads.

## Owner handoff checklist

Before submitting evidence to the gatekeeper:

- confirm PR #140 exact head again;
- confirm exact-head `Web quality` is completed/success;
- confirm checkout is still CLOSED;
- confirm Vercel Production variable set is complete;
- confirm Paddle is in Live mode and all five Paddle controls are approved/active/validated;
- confirm every evidence timestamp is fresh;
- confirm no evidence contains secret values;
- confirm every record uses the exact same release SHA;
- validate the envelope through the repository evidence parser before dispatch.

If any item fails, do not dispatch an approval request. Keep PR #140 DRAFT/unmerged and checkout CLOSED.

## What happens after both external gates pass

Passing these two external gates does not enable checkout and does not authorize a transaction.

Only after fresh external evidence, current Production data-plane evidence, exact-head CI, and the scoped `production-promotion` gatekeeper decision are all satisfied may the exact candidate be promoted with checkout CLOSED.

Protected Production verification must then pass before the separate `checkout-enable` decision can be evaluated.
