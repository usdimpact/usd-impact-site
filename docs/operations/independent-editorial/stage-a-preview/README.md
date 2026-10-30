# Stage A independent Macro Weekly — isolated protected preview

> **DRAFT ONLY — NO PUBLICATION / NO RIGHTS APPROVAL / NO MERGE / NO PUBLIC PRODUCTION.**

This source tree contains precisely one self-contained original English educational page, `macro-reviews/weekly/2026-10-30/index.html`, and its two Vercel static-serving controls. It is a separate review artifact, not the original eight-driver Score, not a new public `/reports/weekly/` route, and not part of the running USD Impact site. The exact article is based on the independently authored unpublished Weekly in Draft PR #1019 and cites the same five issuer sources and the five existing published Dailies.

## Deployment invariants

- Target: **isolated standalone Vercel project** with **Vercel Authentication for ALL deployments** configured and read back *before* any upload/deployment. Do not connect Git, alias a custom domain, or deploy to the public site project.
- Vercel Preview deployment API: `target` MUST BE OMITTED for a Preview; do not set `target:"preview"` (the API rejects that literal).
- Files: one HTML page, this `vercel.json` and `robots.txt`. No analytics, scripts, fonts, images, remote assets, auth secrets, provider APIs, market observations or dependencies.
- `vercel.json`: noindex/nofollow/noarchive/nosnippet via X-Robots-Tag, no-store, strict CSP (no scripts or network calls), anti-framing and robots disallow.
- Anonymous direct URL must be denied by platform Vercel Authentication. **An HTML noindex tag alone is insufficient protection.** Do not share an unprotected URL, grant a share link with public access, disable Vercel auth or promote this Preview to Production.
- Verify account-authenticated access, exact headline and sources; compare the same file blobs. Recheck public USD Impact Production as an independent project.

## Releasing is a DIFFERENT future decision

- Original publication rights and Score-derived Weekly/Monthly remain HOLD.
- Exact five-item reuse and Romania/EU/international treatment remain pending. A protected private Preview can be reviewed without treating public-domain notices as completed legal signoff.
- Official issuer-stated release times are not first HTTP-posting times. The original Weekly's three missing sourceReleaseAt fields remain unresolved pending adopted methodology and claim-level independent editorial PASS.
- Protected Preview is not a member page, production release, or an actual published independent Weekly. Monthly eligibility remains **0/4**.
- Future live route, publication method, date, indexability and rights require separate affirmative owner approval and exact-commit QA.

In case of unexpected anonymous access to the project URL, stop sharing the Preview and immediately restore project-wide Vercel Authentication before proceeding.
