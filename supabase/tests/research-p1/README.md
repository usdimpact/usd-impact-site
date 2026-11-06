# Research P1 integrated candidate — PG17 lifecycle matrix

Disposable, synthetic-only regression fixture for Draft PR #1164.

* `owner_model_replay.py <repo>` replays every file in `supabase/migrations/`
  as a non-superuser `postgres` role (Supabase-like ownership model; the real
  Supabase role attributes are **not verified**).
* `test_research_p1_lifecycle.py <label>` runs the grants, immutability,
  checkout-custody, two-connection race, quarantine, forged-cancellation,
  escalation, clearance, D33 and Library Pass/Paddle cases.

Never point these scripts at a connected Development or Production database.
They create roles and stub `auth`/`storage` schemas.
