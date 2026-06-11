# USD Impact - Session 16B Deployment Provider Configuration

Status: configuration-ready; no live deployment performed.

## Active repository root

`usd-impact-site/`

## Astro app root

`apps/web/`

## Primary preview approach

Use GitHub pull request preview builds first. Do not connect the production domain until preview output, compliance language, navigation, download behavior, and page metadata are verified.

## Recommended provider priority

1. Cloudflare Workers static asset deployment / Cloudflare stack.
2. Vercel preview deployments if faster review is required.
3. Netlify preview deployments as an alternate static host.

## Standard build settings

| Setting | Value |
|---|---|
| Root/base directory | `apps/web` |
| Install command | `npm install --no-audit --no-fund` |
| Validation command | `npm run validate` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22.16.0` |
| Site URL | `https://usd-impact.com` |

## Cloudflare Workers static configuration

File added:

`apps/web/wrangler.jsonc`

Commands after dependencies are installed:

```bash
cd apps/web
npm install --no-audit --no-fund
npm run validate
npm run build
npx wrangler dev
npx wrangler deploy
```

Required GitHub secrets for deployment workflow:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do not commit these secrets.

## Netlify configuration

File added:

`apps/web/netlify.toml`

Dashboard settings:

- Base directory: `apps/web`
- Build command: `npm run validate && npm run build`
- Publish directory: `dist`
- Node version: `22.16.0`

## Vercel configuration

File added:

`apps/web/vercel.json`

Dashboard settings:

- Root directory: `apps/web`
- Framework preset: Astro
- Build command: defined in `vercel.json`
- Output directory: `dist`

## Security controls added

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Long cache for static assets
- Short cache for downloadable lead-magnet PDFs

## Environment controls

Files added:

- `apps/web/.env.preview.example`
- `apps/web/.env.production.example`

No real secrets were committed.

## Boundary

Session 16B does not perform a live deployment, does not attach the production domain, does not configure analytics, does not set email provider credentials, and does not modify the certified book.

