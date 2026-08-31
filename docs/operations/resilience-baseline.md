# USD Impact resilience baseline and recovery runbook

Last verified: 2026-07-30
Owner: KELA LEADS S.R.L. / USD Impact
Tracking issue: #55

This document records reconstruction information only. Secret values, recovery codes, API keys, database passwords, SMTP credentials, and private backup archives must never be committed to Git or pasted into issues.

## 1. Verified source baseline

- Repository: `usdimpact/usd-impact-site`
- Default branch: `main`
- Account and durable-record foundation merge: `99bd83655af5e08980cf1e313f8e94b2565cae8f`
- Historical pre-paid-access restore branch: `backup/pre-paid-access-2026-07-29`
- Current resilience branch: `ops/resilience-baseline`
- Application root in the repository: `apps/web`
- Package manager: npm
- Lockfile installation rule: use `npm ci` when restoring from a clean archive
- Complete validation command: `npm run validate`
- Production build command: `npm run build`

## 2. Vercel reconstruction inventory

### Project identity

- Team ID: `team_1LuMlacGuM198mRjoID4O3Ct`
- Project ID: `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`
- Project name: `usd-impact-site`
- Linked repository: `usdimpact/usd-impact-site`
- Root directory: `apps/web`
- Node runtime: 24.x
- Deployment regions currently observed for serverless functions: `iad1`

### Build configuration

The repository-controlled `apps/web/vercel.json` is authoritative for build, install, output, rewrites, and security headers.

- Install: `npm install --no-audit --no-fund`
- Build: `npm run validate && npm run build`
- Output directory: `dist`
- Framework mode: Astro static output with Vercel serverless functions and routing middleware

### Production and platform domains

- `usd-impact.com`
- `www.usd-impact.com`
- `usd-impact-site.vercel.app`
- `usd-impact-site-usd-impact.vercel.app`
- `usd-impact-site-git-main-usd-impact.vercel.app`

The registrar account, DNS provider, billing owner, recovery email, MFA method, and domain-transfer lock status must be retained in the approved password manager or company recovery register, not in Git.

### Environment-variable names

The following names are application configuration contracts. Record their values only in Vercel and the approved secrets vault.

Account and Supabase:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` or the currently approved server-only Supabase key name

Quiz progression:

- `QUIZ_PROGRESS_SECRET`

Daily-news and OpenAI automation:

- `OPENAI_API_KEY`
- any currently deployed daily-news source, model, retry, or publishing variables referenced by the Vercel project

Telemetry and operational integrations:

- any server-side telemetry-store credentials currently configured in Vercel

Future Paddle variables must be inventoried before sandbox integration and separated by Preview and Production environments.

### Environment scope policy

- Development-only credentials belong in local `.env` files excluded from Git.
- Preview credentials must point only to development or sandbox services.
- Production credentials must point only to production-owned services.
- A secret must not be copied from Preview into Production without confirming provider project, environment, and ownership.
- Every production secret must have a named recovery owner and a rotation procedure in the approved secrets vault.

## 3. Supabase reconstruction and backup policy

### Verified development project

- Project name: `usd-impact-development`
- Project reference: `ycstrcvshdluovtuasjc`
- Authentication method: passwordless email using Supabase standard PKCE confirmation URLs
- Branded sender domain: `updates.usd-impact.com`
- SMTP provider: Resend

### Required pre-production controls

Before the first production customer record:

1. Create or approve a production Supabase project owned by KELA LEADS S.R.L. in the selected EU region.
2. Record project reference, region, organization owner, billing owner, and recovery owner in the company recovery register.
3. Confirm database backup retention and point-in-time recovery capabilities for the selected plan.
4. Export the database schema and migration history after each production schema milestone.
5. Define an Auth-user export procedure that preserves immutable user UUIDs and verified email state where legally and technically appropriate.
6. Define storage-bucket inventory and export procedures before customer files are introduced.
7. Run a restore test into an isolated non-production project before live Paddle activation.
8. Record the restore date, source backup identifier, restored migration level, row-count checks, and responsible operator.

### Minimum database backup cadence

- Before every production migration.
- Immediately after every material schema migration.
- Daily once production customer records or entitlements exist.
- Before and after payment-provider or entitlement reconciliation changes.
- Quarterly restore verification and after material architecture changes.

Backups must be encrypted, access-controlled, and stored outside the active Supabase project. Secret values must not be embedded in export archives or checklists.

## 4. Paddle resilience policy before live transactions

Before live checkout is enabled:

- Record Paddle account owner, billing owner, recovery owner, MFA method, and approved support contacts in the company recovery register.
- Export and retain product, price, tax, checkout, notification, and webhook configuration.
- Keep sandbox and production identifiers separate.
- Define a daily transaction and entitlement reconciliation export.
- Retain webhook event identifiers and processing outcomes for idempotent replay and audit.
- Document refund, dispute, chargeback, cancellation, and reversal recovery procedures.
- Verify that no checkout-success redirect can grant access without a verified webhook-backed durable entitlement.

## 5. GitHub configuration inventory

- Repository visibility: public
- Default branch: `main`
- GitHub Actions workflow used for web validation: `Web quality`
- Vercel Git integration is installed and posts deployment status to pull requests.
- Required branch-protection, Actions-permission, collaborator, deploy-key, webhook, and installed-app settings must be exported or captured in screenshots after each material governance change.

Manual verification still required in GitHub settings:

- Branch protection rules and required checks.
- Whether force pushes and branch deletions are blocked on `main`.
- Actions workflow permissions and allowed actions.
- Repository collaborators and roles.
- Installed GitHub Apps and OAuth applications.
- Deploy keys, webhooks, environments, environment reviewers, and secrets names.

Do not store access tokens, webhook secrets, private keys, or recovery codes in this document.

## 6. Source archive procedure

Run from an authorized workstation with Git and SHA-256 tooling:

```bash
mkdir -p usd-impact-backup-2026-07-30
cd usd-impact-backup-2026-07-30

git clone --mirror https://github.com/usdimpact/usd-impact-site.git usd-impact-site.git

git -C usd-impact-site.git bundle create ../usd-impact-site-2026-07-30.bundle --all

git -C usd-impact-site.git archive --format=zip --output=../usd-impact-site-99bd836.zip 99bd83655af5e08980cf1e313f8e94b2565cae8f

sha256sum usd-impact-site-2026-07-30.bundle usd-impact-site-99bd836.zip > SHA256SUMS
```

Store at least one encrypted copy outside GitHub in company-controlled storage. Retain the `SHA256SUMS` file beside the encrypted archive and in the company recovery register.

## 7. Isolated restore verification

```bash
mkdir usd-impact-restore-test
cd usd-impact-restore-test

git clone ../usd-impact-site-2026-07-30.bundle restored
cd restored

git checkout 99bd83655af5e08980cf1e313f8e94b2565cae8f

test "$(git rev-parse HEAD)" = "99bd83655af5e08980cf1e313f8e94b2565cae8f"

cd apps/web
npm ci
npm run validate
npm run build
```

Restore evidence must record:

- archive filename and SHA-256 result;
- restored commit SHA;
- Node and npm versions;
- dependency-install result;
- validation result;
- production-build result;
- operator and date;
- any deviations or missing external configuration.

## 8. Secret recovery ownership

The company recovery register or approved password manager must identify a primary and secondary authorized owner for:

- GitHub organization and repository administration;
- Vercel team and project administration;
- production domain registrar and DNS;
- Supabase organization and production project;
- Resend account and sender-domain DNS;
- OpenAI Platform organization and API billing;
- Paddle account, billing, tax, and webhook administration;
- company email accounts used for provider recovery.

Each entry must include MFA recovery instructions and a rotation date. Secret values must never appear in Git, issue comments, screenshots attached to public issues, or unencrypted backup archives.

## 9. Manual completion checklist for issue #55

- [ ] Create an immutable Git tag or GitHub release at `99bd83655af5e08980cf1e313f8e94b2565cae8f`.
- [ ] Produce the Git mirror, bundle, source ZIP, and SHA-256 checksums.
- [ ] Store an encrypted external copy in company-controlled storage.
- [ ] Capture GitHub branch protection, permissions, collaborators, apps, deploy keys, webhooks, and environments.
- [ ] Capture Vercel environment-variable names and environment scopes from the dashboard.
- [ ] Capture registrar and DNS records, ownership, recovery, MFA, and transfer-lock status.
- [ ] Confirm the production Supabase backup/PITR plan and execute an isolated restore test before customer data exists.
- [ ] Create the Paddle configuration and reconciliation export procedure before live transactions.
- [ ] Record primary and secondary recovery owners in the approved password manager.
- [ ] Run the isolated source restore procedure and attach non-secret evidence to issue #55.
