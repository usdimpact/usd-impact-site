# Weekly Score v1.1 paid-member delivery

## Purpose

Deliver the frozen USD Impact Weekly Score v1.1 package only to a verified account with an active entitlement for `read-the-dollar-first-guided-interactive-edition`.

The public repository contains the protected page, entitlement gate, download proxy, instructions, and expected integrity hash. It must never contain the Pine source or paid-member ZIP.

## Frozen asset

- local release name: `USD_Impact_Weekly_Score_v1.1_Paid_Member_Package.zip`
- expected SHA-256: `10fb9a407a31e6ae0faef9b1f7dc4cdc74b38b353655e56e495eb88084be0b18`
- private bucket: `paid-member-assets`
- exact private object path: `weekly-score/v1.1/USD_Impact_Weekly_Score_v1.1_Paid_Member_Package.zip`
- maximum accepted download size: 10 MiB

The wrapper package contains the exact frozen official v1.1 release plus `00_BEGIN_HERE_PAID_MEMBERS.md`. The main Pine source remains byte-identical to the final release.

## One-time private Storage setup

Perform these steps only in the approved Production Supabase project:

1. Open **Storage** in the Supabase dashboard.
2. Create the bucket `paid-member-assets`.
3. Keep the bucket **Private**. Never enable public access.
4. Upload the exact member ZIP at:

   `weekly-score/v1.1/USD_Impact_Weekly_Score_v1.1_Paid_Member_Package.zip`

5. Do not create a public URL or commit the ZIP to GitHub.
6. Independently calculate the uploaded source file's SHA-256 and confirm it equals the frozen value above.

No new browser-facing Storage policy is required. The Vercel function verifies the signed-in account and durable paid entitlement first, then retrieves the exact private object server-side through the existing secret-scoped Supabase configuration. The function verifies the ZIP hash before returning it.

## Required deployment configuration

The member download reuses the existing server-side Production variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Do not expose `SUPABASE_SECRET_KEY` to the browser, logs, screenshots, client bundles, or public documentation. No new environment variable is required for the frozen v1.1 object path.

## Pre-launch verification

Run the complete state matrix against the exact Production candidate:

1. **Anonymous:** `/guided-edition/weekly-score/` redirects to sign-in and preserves the protected destination.
2. **Authenticated without entitlement:** redirects to `/account/access-required/` and returns no package bytes.
3. **Active paid entitlement:** member hub opens, beginner guide renders, and the download succeeds.
4. **Downloaded ZIP:** filename is correct, the archive tests cleanly, and SHA-256 equals the frozen value.
5. **Suspended, disputed, refunded, charged-back, revoked, deletion-pending, and deleted:** access is denied and no package bytes are returned.
6. **Missing or altered Storage object:** the endpoint fails closed with a generic temporary-unavailability message; no internal path, credential, or provider error is disclosed.
7. **HEAD request:** returns protected download metadata only after account and entitlement verification.

## Member workflow

The protected route `/guided-edition/weekly-score/` supplies the full beginner path:

1. Download and extract the member ZIP.
2. Create a new blank TradingView Pine indicator.
3. Paste all 753 lines of the frozen v1.1 Pine source.
4. Save privately and add it to a `1W` chart.
5. Confirm `TV proxy v1.1` and `Fixture QA: PASS`.
6. Read score, weekly delta, dominant driver, largest mover, pillars, breadth, boundary, and flags in order.
7. Use the U.S. high-importance Economic Calendar separately.
8. Use `Once per bar close` alerts only when the member's TradingView plan supports technical alerts.

## Security and compliance boundary

- Browser state and checkout redirects never grant access.
- Only the existing verified entitlement state authorizes the page and file.
- The private package is not placed in Astro `public/`, Vercel static output, GitHub, sitemap, or a public Storage bucket.
- The Weekly Score is educational context—not a forecast, trading signal, or recommendation.
- TradingView plan limits are third-party conditions and are not included in the USD Impact purchase price.
