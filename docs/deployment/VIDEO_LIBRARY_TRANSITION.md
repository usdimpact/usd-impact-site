# Paid video library transition

## Scope

This release moves the 51-film USD Impact educational collection into the existing
paid-access application at `usd-impact.com`.

- Public catalog: `/video-library/`
- Subscriber catalog: `/guided-edition/video-library/`
- Entitlement: `read-the-dollar-first-guided-interactive-edition`
- Authentication, entitlement checks, and progress storage: existing Supabase
  foundation
- Video delivery: Cloudflare Stream with **Require Signed URLs** enabled
- Payment-provider replacement: intentionally outside this release

The standalone owner-only Sites application remains a QA/reference surface until
the native Vercel release has been verified. It is not the customer-facing paid
library.

## Security model

The public catalog contains titles, descriptions, durations, and collection
metadata only. It does not contain Stream video IDs, playback tokens, or customer
delivery URLs.

The protected Vercel function checks the existing paid entitlement before it asks
Cloudflare for a one-hour signed playback token. The raw Cloudflare API token is
server-only and must never be exposed in browser code or committed to GitHub.

## One-time manual secret setup

These steps cannot be completed by repository code because Cloudflare requires an
account owner to create the credential and Vercel requires the secret value to be
entered in the project settings.

1. Open the [Cloudflare API Tokens page](https://dash.cloudflare.com/profile/api-tokens).
2. Select **Create Token**, then **Create Custom Token**.
3. Name it `USD Impact Vercel Stream playback`.
4. Add the least-privilege Stream write permission. Cloudflare surfaces this as
   **Stream — Edit** in the token builder; some API documentation calls the
   equivalent capability **Stream Write**.
5. Restrict the token to the Cloudflare account that owns the 51 Stream videos.
6. Create the token and copy it once. Do not paste it into GitHub, a ticket, or
   chat.
7. Copy the 32-character **Account ID** from the same Cloudflare account's
   dashboard overview.
8. Open the [`usd-impact-site` Environment Variables settings](https://vercel.com/usd-impact/usd-impact-site/settings/environment-variables).
9. Add `CLOUDFLARE_ACCOUNT_ID` with the Account ID. Select **Preview** and
   **Production**.
10. Add `CLOUDFLARE_STREAM_API_TOKEN` with the token. Mark it sensitive and select
    **Preview** and **Production**.
11. Redeploy the pull-request preview so the new variables are included.

References:

- [Cloudflare: create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare: API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)
- [Cloudflare Stream: secure videos](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)
- [Cloudflare Stream: create a signed token](https://developers.cloudflare.com/api/resources/stream/subresources/token/methods/create/)
- [Vercel: environment variables](https://vercel.com/docs/environment-variables)

## Preview acceptance check

After the preview is redeployed:

1. Open `/video-library/` in a private browser window and confirm all 51 films are
   listed but no player is exposed.
2. Open `/guided-edition/video-library/` while signed out and confirm the site
   redirects to sign-in.
3. Sign in with an account that does not have the guided-edition entitlement and
   confirm the access-required screen appears.
4. Sign in with an actively entitled account and open films 1, 13, 31, and 51.
5. Confirm each player starts, English captions are available, and seeking works.
6. Watch part of a film, refresh, and confirm playback resumes near the saved
   position.
7. Confirm the browser network panel never receives
   `CLOUDFLARE_STREAM_API_TOKEN` or a raw API Authorization header.
8. When the preview and GitHub checks pass, approve and merge the pull request.

## Production acceptance check

After Vercel deploys `main`:

1. Repeat the entitled playback check on `https://www.usd-impact.com/`.
2. Confirm the deployment is `READY` in Vercel.
3. Keep the previous production deployment available for rollback.
4. Retire the standalone Sites library only after the native library has remained
   healthy through the agreed observation window.
