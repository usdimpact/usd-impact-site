# Paddle production launch checkpoint

## Approved offer window

The owner approved the following Guided Interactive Edition offer on 2026-08-03:

- launch start: `2026-08-17T13:00:00Z`;
- launch deadline: `2026-09-16T13:00:00Z`;
- launch price: USD 39.00;
- standard price: USD 49.00; and
- launch limit: 100 completed purchases or 30 days, whichever occurs first.

Migration `20260803190000_guided_edition_launch_window.sql` records the dates. It locks the offer row and refuses to update it unless the product, currency, prices, and purchase limit match the approved contract.

## Evidence required before merging PR #65

Confirm all of the following without recording secret values in GitHub, chat, screenshots, logs, or analytics:

1. Paddle Production business verification is approved for SC Kela Leads SRL.
2. The Production product and the USD 39 and USD 49 one-time prices are active, quantity is limited to one, and their identifiers are stored in the approved secrets manager.
3. The Production default payment link uses `https://www.usd-impact.com/checkout/`.
4. A Production webhook destination targets `https://www.usd-impact.com/api/paddle-webhook` and includes every event handled by `paddle-event-processor.js`.
5. Vercel Production has separately created values for `PADDLE_ENVIRONMENT`, `PADDLE_API_KEY`, `PADDLE_LAUNCH_PRICE_ID`, `PADDLE_STANDARD_PRICE_ID`, `PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`, and `PADDLE_CHECKOUT_URL`.
6. `PADDLE_ENVIRONMENT` is `production`; no sandbox API key, client token, price identifier, webhook secret, or notification destination is reused.
7. Production Supabase uses the approved EU project and has `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and sensitive `SUPABASE_SECRET_KEY` values scoped only where required.
8. All committed Supabase migrations, including the launch-window migration, have been applied in order and the backup and isolated-restore plan is current.
9. The frozen Weekly Score v1.1 paid-member ZIP is present at the exact private Storage path, its SHA-256 matches the release contract, and anonymous/unpaid/refunded states receive no package bytes.
10. The transactional email sender, support address, accounting treatment, retained-record schedule, and final legal/privacy/terms copy are approved.

The production build runs `validate-paddle-deployment-config.mjs` and fails closed unless it receives a live-format API key, a live-format client token, distinct price identifiers, a webhook secret, `PADDLE_ENVIRONMENT=production`, and `PADDLE_CHECKOUT_URL=https://www.usd-impact.com/checkout/`. Preview builds require the matching sandbox credential formats. The check never prints credential values.

## Controlled release order

1. Record the non-secret Paddle Production product and price identifiers in the operator evidence log.
2. Verify the Production-scoped Vercel variable names and scopes without displaying their values.
3. Apply all Supabase migrations and confirm the offer remains closed until `2026-08-17T13:00:00Z`.
4. Merge PR #65 only after GitHub Web quality and the final Vercel Preview pass.
5. Confirm Production deploys the merge commit and both `/checkout/` and `/api/paddle-webhook` exist.
6. Send a signed Paddle Production simulation and confirm HTTP 200 plus one durable webhook receipt without granting an entitlement.
7. Upload and verify the private Weekly Score v1.1 member package by following `weekly-score-paid-member-delivery.md`.
8. Before launch, verify anonymous, unpaid, paid, refunded, disputed, revoked, deletion-pending, and deleted account states across both the Guided Edition and Weekly Score download.
9. At launch, verify the server selects USD 39 and does not trust browser-submitted account, price, or amount values.

If any check fails, keep PR #65 draft or disable the Production notification destination. Do not bypass signature verification, grant access manually, reuse sandbox credentials, or move the approved start time earlier.
