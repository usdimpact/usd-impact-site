# Production deployment

## Canonical provider

The canonical production provider for `usd-impact-site` is **Vercel**.

- Repository: `usdimpact/usd-impact-site`
- Production branch: `main`
- Application root: `apps/web`
- Framework: Astro
- Production domain: `https://www.usd-impact.com/`
- Apex domain: `https://usd-impact.com/` redirects to `www`
- Build command: `npm run validate && npm run build`
- Output directory: `dist`
- Runtime and routing configuration: `apps/web/vercel.json`

Every change to production must be merged through a pull request after the required repository checks pass. Vercel creates preview deployments for pull requests and deploys merged `main` commits to production.

## Deployment ownership

Vercel owns web application hosting, preview deployments, production deployments, redirects, response headers, static assets, and serverless API routes for this repository.

Netlify and Cloudflare Workers are not deployment targets for this site. Their repository configuration was removed after Vercel production, custom-domain routing, automation, and Lighthouse verification passed.

The standalone Weekly USD Impact Score dashboard at `usd-impact-pipeline.pages.dev` is a separate application in the `usdimpact/usd-impact-pipeline` repository. Its Cloudflare Pages deployment is not part of this site's production configuration and must not be removed as part of `usd-impact-site` cleanup.

## DNS boundaries

The authoritative DNS zone remains outside this repository. Web-routing records direct the apex and `www` hostnames to Vercel.

Do not delete or repurpose records used by cPanel mail or Resend, including:

- apex MX records
- `mail`
- SPF
- DKIM
- DMARC
- `updates`
- `send.updates`
- Resend verification records

A deployment cleanup must not include DNS changes unless a separate, reviewed DNS plan explicitly identifies the exact records and verifies mail continuity.

## Production verification

After a production deployment:

1. Confirm the Vercel deployment is `READY` and targets `production`.
2. Confirm `https://www.usd-impact.com/` returns HTTP 200.
3. Confirm `https://usd-impact.com/` redirects to `www`.
4. Confirm the waitlist endpoint and Daily USD Impact automation remain operational when affected by the change.
5. For presentation or performance changes, rerun PageSpeed Insights on mobile and desktop.

## Rollback

Use the previous healthy Vercel production deployment as the rollback candidate. Do not restore obsolete Netlify or Cloudflare Workers configurations as an emergency rollback mechanism.
