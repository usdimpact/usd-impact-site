# Paddle webhook endpoint operations

## Purpose

Keep ordinary Vercel Preview deployments protected while allowing Paddle to reach the verified webhook handler at `/api/paddle-webhook`.

The application still verifies the `Paddle-Signature` against the exact raw request body before storing or processing any event. The Vercel automation bypass only allows the request to reach that handler; it does not replace Paddle signature verification.

## Preview and sandbox endpoint

Use the stable branch alias and append a Vercel Protection Bypass for Automation secret as a query parameter:

```text
https://usd-impact-site-git-agent-paddle-checkout-webhooks-usd-impact.vercel.app/api/paddle-webhook?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>
```

Requirements:

- Vercel Authentication remains enabled for Preview deployments.
- The bypass secret is generated in Vercel Project Settings under Deployment Protection.
- The complete URL is stored only in Paddle's sandbox notification destination and an approved company secrets manager.
- Never commit, paste into GitHub issues, email, screenshots, chat, analytics, or logs.
- Keep only one active Paddle sandbox destination for this endpoint.
- Continue using the existing scoped `PADDLE_WEBHOOK_SECRET` for Paddle signature verification.

## Validation

1. Keep Preview `Require Log In` enabled.
2. Activate the Paddle sandbox destination containing the bypass query parameter.
3. Send one Paddle simulation or replay a safe sandbox event.
4. Confirm Paddle reports `Delivered`.
5. Confirm Vercel runtime logs show `POST /api/paddle-webhook 200` on the expected branch deployment.
6. Confirm the matching `webhook_receipts` row is `processed`, `ignored`, or duplicate according to the event policy, with no unexpected error.
7. Leave the destination active only while sandbox integration testing is required.

## Rotation and incident response

Rotate or revoke the Vercel automation bypass immediately if the complete webhook URL is exposed. After rotation:

1. Update the Paddle notification destination URL with the new bypass value.
2. Send a safe sandbox simulation.
3. Confirm delivery and receipt processing.
4. Remove the old URL from approved storage.

The Paddle webhook signing secret is separate. Rotate it independently if that secret is exposed.

## Production

Production must use the stable production application domain and Production-scoped Paddle and Supabase credentials. Do not reuse sandbox API keys, client tokens, webhook signing secrets, product IDs, price IDs, or notification destinations in Production.

Vercel documentation:

- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- https://vercel.com/docs/deployment-protection/automated-agent-access
