# USD Impact AI Control Center

## Purpose

This directory is the GitHub-native operating layer for USD Impact project control. It does not replace product code, publishing workflows, deployment configuration, or canonical governance. It reconciles them into one auditable project view.

## Canonical operating boundaries

- Website repository: `usdimpact/usd-impact-site`
- Website production branch: `main`
- Website application root: `apps/web`
- Website production provider: Vercel
- Website production domain: `https://www.usd-impact.com/`
- Publishing pipeline repository: `usdimpact/usd-impact-pipeline`
- Weekly Score dashboard: separate Cloudflare Pages application owned by the pipeline repository
- `usdimpact/usd-impact`: supporting weekly-commentary framework; not the website deployment source of truth

Cloudflare must never be treated as a second deployment target for `usd-impact-site` unless the canonical production-deployment document is explicitly changed through review.

## Command contract

The control workflow recognizes commands entered as a standalone GitHub issue or pull-request comment:

- `/status` — refresh live project state and return a compact health summary.
- `/next` — refresh state, score actionable work, and return the highest-value next task.
- `/daily` — run control-center preflight and, only if the preflight is not RED, dispatch the existing `daily-news.yml` publication workflow.
- `/sync` — refresh project inventory/state and publish the result as a comment without starting publication.

The same commands are available through manual `workflow_dispatch`.

Commands are orchestration shortcuts. They do not bypass repository validation, protected review, deployment gates, or existing daily-publication safeguards.

## Source-of-truth hierarchy

1. Latest explicit owner instruction.
2. Canonical governance and deployment documentation.
3. Live repository and deployment state.
4. `main` branch configuration and workflows.
5. Pipeline/research repositories.
6. Generated control-center state.

Generated files are snapshots, never authorities over live GitHub/Vercel state.

## Generated state

`PROJECT_STATE.json` is the machine-readable control snapshot.

`INVENTORY.json` is the stable inventory/hierarchy definition used to interpret project assets.

The workflow refreshes live state at execution time. It can also update `PROJECT_STATE.json` through a dedicated automation branch/PR; the generated file must never be used to silently overwrite canonical configuration.

## Priority model

Tasks are scored from evidence using:

`score = severity + urgency + risk_reduction + dependency_unlock + user_value - effort`

Priority bands:

- P0: production/security/compliance/customer-access critical
- P1: release blocker or failed validation/automation
- P2: high-value core product/publishing work
- P3: growth/quality/parity/performance work
- P4: maintenance/refactor/documentation
- P5: backlog/idea

Explicit P0/P1 issue titles or labels take precedence over lower-priority inferred work. A task blocked by an unresolved prerequisite is not selected over an unblocked task of equal or near-equal severity.

## Daily publication rule

`/daily` does not generate an alternate publication path. It dispatches the existing `Daily USD Impact publication` workflow after preflight.

That workflow remains authoritative for generation, import, validation, build, publication PR creation, exact-head quality validation, and protected merge readiness.

The control center must report `RELEASE BLOCKED` instead of bypassing a failed gate.

## Status colors

- GREEN — no P0/P1 blocker detected; core workflows are healthy enough to proceed.
- AMBER — material risk, stale/unknown state, or important P2 work requires attention but production is not known broken.
- RED — P0, release-blocking P1, failed critical workflow, or known production failure.

Unknown state is never silently converted to GREEN.

## Release discipline

Every production release continues to follow `docs/production-deployment.md` plus `PRODUCTION_RELEASE_CHECKLIST.md` in this directory.

A successful GitHub build alone is not a verified production release.
