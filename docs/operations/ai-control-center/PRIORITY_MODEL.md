# USD Impact Priority Model

The control center uses a deterministic score to prevent the AI/operator from choosing work by novelty or convenience.

## Priority bands

| Band | Base score | Meaning |
|---|---:|---|
| P0 | 1000 | Production, security, compliance, customer-access critical |
| P1 | 800 | Release blocker, failed critical validation, broken automation |
| P2 | 600 | High-value core product, publishing, launch or content work |
| P3 | 400 | Growth, quality, parity, performance, accessibility |
| P4 | 200 | Maintenance, refactor, documentation, cleanup |
| P5 | 100 | Backlog or idea |

## Evidence bonuses

The live scoring script may add bounded bonuses for explicit title/body evidence:

- production/security/compliance/customer-access risk: +90
- launch/release/deployment/auth/payment/email dependency: +60
- daily/weekly publishing or automation health: +50
- dependency-unlock wording (`required before`, `blocks`, `prerequisite`): +40
- recent owner activity/update: +20

## Effort/risk adjustment

- Explicitly blocked or awaiting an owner/external decision: -120
- Phase 2 / explicitly non-blocking: -80
- Enhancement-only with no release dependency: -30

The priority band remains dominant. A P3 bonus cannot outrank a genuine unblocked P0.

## Selection rules

1. Prefer the highest-scoring unblocked issue.
2. If the highest issue is blocked, choose the highest-scoring task that reduces that blocker.
3. Never select cosmetic or maintenance work while a confirmed P0/P1 release blocker is actionable.
4. Generated scores guide execution; explicit owner instructions always override them.
5. Unknown production/validation state lowers confidence and prevents a GREEN status.
