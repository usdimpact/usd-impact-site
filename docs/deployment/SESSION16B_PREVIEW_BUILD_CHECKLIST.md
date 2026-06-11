# USD Impact - Session 16B Preview Build Checklist

## Pre-build

- [ ] Repository uploaded to GitHub.
- [ ] Branch protection enabled on `main`.
- [ ] Pull requests required before merge.
- [ ] Deployment provider selected.
- [ ] Root/base directory set to `apps/web`.
- [ ] Node version set to `22.16.0` or compatible current LTS.
- [ ] Real secrets stored only in provider dashboard or GitHub Secrets.

## Build commands

```bash
cd apps/web
npm install --no-audit --no-fund
npm run validate
npm run build
npm run preview:local
```

## Preview review

- [ ] Home page loads.
- [ ] Start Here page loads.
- [ ] Book product page loads.
- [ ] Dollar Transmission Chain page loads.
- [ ] Three-Dial Macro Dashboard page loads.
- [ ] Weekly checklist landing page loads.
- [ ] Benchmark dashboard page loads.
- [ ] Lead magnet PDF download works.
- [ ] Header/logo renders cleanly.
- [ ] Cover image renders cleanly.
- [ ] Framework visuals render cleanly.
- [ ] Mobile viewport checked.
- [ ] Desktop viewport checked.
- [ ] Internal links checked.
- [ ] Download links checked.
- [ ] No dashboard/checklist/benchmark language framed as trading signals.
- [ ] Compliance note visible where needed.
- [ ] No API keys or credentials in repository.

## Production hold

Do not connect `usd-impact.com` until preview build has been reviewed and approved.

