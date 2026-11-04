# Research D1 isolated two-session real PostgreSQL — Draft-only

Date 2026-11-04. Standalone pinned child of Draft #1114 exact source commit 987a504e2d8920db7b2a2cde3776138c38cdb761. No changes to #1114, current #1111, or Production main. The only new files are a synthetic test harness, this note, and one CI-entrypoint test guard. No workflow YAML is changed.

GitHub-hosted CI for this exact child alone launches Docker postgres:17 --network none with no exposed ports and inert data. Two independent psql processes hold different database backend PIDs. The actual review-only SQL prototype under docs/operations is executed against a disposable isolated database. The finalizer removes the Docker container. No connected Supabase project, Render service, provider key, payment, account record, migration, user database or merchant activity is involved. Existing GitHub CI runner minutes may still count toward account usage.

Scope: T17 two-session unique event claim race on COMMIT and ROLLBACK; T18 lease-expired current-vs-stale FINISH race and idempotent retry; T19 failed-paid conflict observation retention after retry, journal mutation rejection; V1 durable version and hash conflicts even for terminal status. Record actual PostgreSQL version, Docker image ID and distinct backend PIDs from CI logs.

Not proved: T13 atomic concurrent paid subscription binding, full T19 killed-worker/restricted-role proof, T20 real signed provider delivery, T21/T22 real Library Pass integration and all D2 non-escalatable writer-role/grants. Image tag is 17; digest is recorded after image resolution but not pre-pinned. Further independent approval is required for pinned-image reproducibility and D2 privileged security tests.

No merge, deploy, flags, Production SQL, pricing, customer recovery, privileges or release authorization is implied. Research #1103 LIVE P1 and all owner D2-D7 holds remain. A failure must be documented without bypass or falsely claiming concurrency success.
