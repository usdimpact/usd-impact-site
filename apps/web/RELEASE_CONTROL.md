# Release Control Marker

This inert file lives inside the Vercel application root so a reviewed release-control change can trigger the normal Git-to-Vercel Production deployment path when repository-level documentation changes may be skipped by path-based build detection.

It contains no runtime configuration, secrets, customer data, commerce activation, scheduler activation, provider activation, entitlement mutation, or executable application logic.

## 2026-08-22 Production catch-up gate

- Supabase Production and Development migration ledgers were reconciled and verified to match through `20260822023747_knowledge_search_rpc`.
- Production account-deletion schema preflight and post-apply verification passed; runtime finalizer, scheduler, and provider delivery remain disabled.
- `learning_progress` own-row authenticated INSERT/UPDATE policies are present for the adaptive-learning path.
- `push_subscriptions` and `knowledge_chunks` remain server-only with RLS enabled and no anon/authenticated read access.
- Production `push_subscriptions`, `knowledge_chunks`, and `learning_progress` contained zero rows at the activation preflight.
- Adaptive Learning, Web Push, and knowledge-backed AI remain feature-gated; this marker does not enable any feature flag.
- The current source tree was previously green in Web Quality on the corresponding reviewed PR head; this change is documentation only.

Purpose of this commit: request one normal Production catch-up deployment of current `main` after earlier Vercel Hobby build-rate limiting, then verify deployed commit parity before any runtime feature activation.