# Render hardening baseline — 2026-10-23

Status: **READ-ONLY EVIDENCE / NO RENDER MUTATIONS**

This record captures the Render services associated with the USD Impact shadow/rehearsal workstream. It does not authorize suspension, deletion, redeployment, environment changes, network restrictions, or Production integration.

## Scope and bounded interpretation

Observed workspace services are all in Frankfurt and all have automatic deploy disabled. They are hosted from the separate `usdimpact/usd-impact-daily-shadow-lab` repository, not from the public website repository.

No service listed here is established by this audit as a dependency of `www.usd-impact.com`. Repository search of `usdimpact/usd-impact-site` found no references to these Render service names or public Render hostnames.

Absence of HTTP metrics is not treated as proof of zero historical use. It is only evidence that the queried Render metric series did not report application HTTP traffic during the bounded 2026-10-16 through 2026-10-23 observation window.

## 1. impact-control-malware-scanner

Render service: `srv-davs9jm0tbcc73f72hvg`

Observed configuration:
- branch: `impact-control-malware-scanner-20261002`
- runtime: Docker
- region: Frankfurt
- plan: `2c-4g`
- auto-deploy: disabled
- PR previews: disabled
- one instance
- health-check path: `/health`
- public Render hostname enabled
- network allow list includes `0.0.0.0/0`
- open TCP port: 10000
- not suspended

Repository contract:
- rehearsal-only malware scanner;
- `POST /scan` requires bearer authorization plus expected SHA-256, expected size, attachment ID and idempotency key;
- 25 MiB maximum request body;
- uploaded bytes are ephemeral and deleted after scanning;
- no Supabase/Lovable connection is authorized;
- later integration requires separate approval.

Live read-only health observation on 2026-10-23:
- `ok=true`
- engine: ClamAV
- engine version: `1.5.4`
- contract: `icc-scan-v2`
- signature version: `28162`
- signature DB build: 2026-10-23 06:24:08 UTC
- maximum bytes: 26,214,400
- persistent storage: false

This supersedes the earlier operational observation of ClamAV 1.4.3. The old engine-version STOP reason is no longer current. It does **not** by itself authorize integration: the scanner remains rehearsal-only by contract.

Seven-day Render HTTP metric series returned no application request/latency points. A bounded live log sample showed repeated successful internal `GET /health` probes only. This is consistent with an idle isolated scanner, but it is not a complete traffic audit.

HOLD:
- do not connect it to Production, Supabase, Lovable, upload flows or customer data;
- do not submit production/customer files as part of this hardening audit;
- before any later integration, independently validate engine/signature lifecycle, authorization failure cases, size/hash/idempotency enforcement, network exposure, timeout behavior, and fail-closed handling.

## 2. usd-daily-private-runtime

Render service: `srv-dasroeh7lnhs73ahchb0`

Observed configuration:
- branch: `capture-host-20260928-v1`
- runtime: Node
- region: Frankfurt
- plan: `0.5c-512mb`
- 1 GB persistent disk mounted at `/var/data`
- auto-deploy: disabled
- PR previews: disabled
- one instance
- no Render health-check path configured
- public Render hostname enabled
- network allow list includes `0.0.0.0/0`
- open TCP port: 10000
- not suspended

Repository contract:
- separate persistent private storage/review runtime;
- does not itself install the public Daily scheduler, connect a live model, send email or publish content;
- public `/health` returns storage status and `active:false`;
- `GET /review/YYYY-MM-DD` requires a long bearer review token;
- review responses are private/read-only;
- public routes cannot initialize storage, write drafts, dispatch work or activate publishing;
- no query-string authentication;
- responses are non-cacheable.

Live read-only observation:
- `/health` returned HTTP success with `{"status":"STORAGE_READY","active":false}`;
- root returned 404, matching the narrow route surface;
- no application logs were returned for the bounded 2026-10-23 12:00–15:45 UTC query;
- seven-day HTTP request/latency metric series returned no points;
- one instance and background resource usage remained observable.

Historical Render events show several non-zero-exit server/deploy failures on 2026-10-05 followed by later successful deploys; the latest observed deploy on 2026-10-07 succeeded and reported the server available.

HOLD:
- do not classify `active:false` as a failure; that is the documented safe state;
- do not activate scheduling/publishing as part of this hardening PR;
- do not remove the persistent disk or service without a separate retention/ownership review;
- before any future activation, require explicit health-check design, private-route authorization regression tests, checkpoint/backup verification, and network-exposure review.

## 3. usd-source-capture-20260928

Render service: `srv-dasovd60tbcc738d0mb0`

Observed configuration:
- branch: `capture-host-20260928-v1`
- runtime: Node
- region: Frankfurt
- free plan
- auto-deploy: disabled
- PR previews: disabled
- no disk/database
- no configured Render health-check path
- public Render hostname enabled
- network allow list includes `0.0.0.0/0`
- not suspended

Repository contract explicitly describes this service as a fixed-window diagnostic capture host, **not a durable automation host**. Runtime restarts are intended to serve health only and must not recapture.

Current read-only observations:
- seven-day HTTP, CPU, memory and instance metric series returned no points;
- live requests to both root and `/health` returned HTTP 503;
- last observed deployment activity was on 2026-09-27 and completed successfully.

This is consistent with a stale/free diagnostic service, but deletion is **not** authorized by this evidence alone.

HOLD:
- confirm retention/evidence ownership and whether any audit record still points to the service before retirement;
- do not redeploy it to create a green health response; that could re-run an expired diagnostic capture path;
- if retirement is approved later, preserve required hashes/evidence first and retire it as its own reversible cleanup change.

## Hardening conclusions

1. None of the three Render services should be silently promoted into the website's operational path.
2. The scanner engine is currently newer than the earlier 1.4.3 observation, but remains integration-gated.
3. The private runtime is intentionally inactive and storage-ready; broad service-layer ingress should be reviewed before any future activation.
4. The source-capture host appears stale/non-operational and should enter a retention/retirement review, not an automatic redeploy.
5. Render state changes are outside this PR. Any future change needs a dedicated plan, exact service ID, pre-change evidence, acceptance test and rollback/retention procedure.
