# USD Impact - GitHub Provider Setup Instructions

## 1. Create or update repository

Repository: `usd-impact-site`

Upload the Session 16B repo package contents to a branch:

`feature/session16b-deployment-config`

## 2. Run local commands after dependencies are available

```bash
cd apps/web
npm install --no-audit --no-fund
npm run validate
npm run build
npm run preview:local
```

## 3. GitHub branch protections

Protect `main`:

- Require pull request before merge.
- Require status checks.
- Require review before merge.
- Block force pushes.
- Block direct pushes.

## 4. Preview build workflow

Workflow added:

`.github/workflows/preview-build.yml`

It validates content/compliance/links, builds the Astro site, and uploads the `dist` folder as a build artifact.

## 5. Cloudflare option

Use Cloudflare only after a successful preview build.

Required secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do not commit these secrets.

## 6. Vercel option

Import the GitHub repository in Vercel:

- Root directory: `apps/web`
- Framework: Astro
- Output: `dist`

## 7. Netlify option

Import the GitHub repository in Netlify:

- Base directory: `apps/web`
- Build command: `npm run validate && npm run build`
- Publish directory: `dist`

## 8. Hold condition

Do not attach `usd-impact.com` until preview has been reviewed.
