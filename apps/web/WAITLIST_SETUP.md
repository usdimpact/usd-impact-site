# Book waitlist setup

The public form submits to the Vercel Function at `/api/waitlist`.

The function stores the email in a dedicated Resend Segment and sends a confirmation email. No credentials belong in Git or in client-side code.

## Required Resend setup

1. Create or open the USD Impact Resend account.
2. Add and verify a sending domain or sending subdomain.
3. Create a Segment named `Read the Dollar First Waitlist`.
4. Create a restricted API key that can create contacts, assign segments, and send email.
5. Copy the Segment ID.

## Required Vercel environment variables

In the Vercel project, open **Settings → Environment Variables** and add:

| Variable | Purpose | Example format |
|---|---|---|
| `RESEND_API_KEY` | Private Resend API credential | `re_...` |
| `RESEND_WAITLIST_SEGMENT_ID` | Dedicated book-waitlist segment | UUID from Resend |
| `RESEND_FROM_EMAIL` | Verified sender identity | `USD Impact <book@updates.example.com>` |
| `RESEND_REPLY_TO` | Optional monitored reply address | `support@example.com` |

Apply the variables to **Preview** and **Production**, then redeploy. Changes to Vercel environment variables do not affect an already-built deployment.

## Verification

1. Open the latest Vercel Preview deployment.
2. Visit `/book/read-the-dollar-first/#book-waitlist`.
3. Submit an address you control and accept the consent checkbox.
4. Confirm the page displays the success message.
5. Confirm the address appears in the Resend waitlist Segment.
6. Confirm the waitlist confirmation email arrives.
7. Submit the same address again and confirm the workflow remains successful without creating an unusable duplicate.

## Failure behavior

If the required environment variables are absent or Resend rejects the request, the function returns a controlled error and the form does not claim success.

## Launch workflow

When the book purchase page is ready, send the purchase link only to the dedicated waitlist Segment. Include the required sender identity and unsubscribe mechanism in the launch message.
