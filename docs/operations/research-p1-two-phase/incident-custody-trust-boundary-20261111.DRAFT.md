# #1103 P1 owner-incident custody: separate-role Draft feasibility (11 November 2026)

**DRAFT / DISPOSABLE ONLY.** This is a synthetic research artifact for the #1230 sole-author lane, not a production migration or independently approved R1/R2 design. PR #1237 remains separate. R3 pre-intent Auth recovery and all D1-D6 release approvals remain on HOLD.

## Verified root problem
Independent Claude PG17 on #1230 at 8be697ba reproduced: the operator/table owner disables USER triggers, deletes a paid financial incident, re-enables triggers, and can cause completion/privacy-email with no decision-ledger entry. This is an ownership DDL risk, not solved by another same-owner trigger. See https://github.com/usdimpact/usd-impact-site/issues/1103#issuecomment-6780634374

PostgreSQL docs: https://www.postgresql.org/docs/17/sql-altertable.html ; https://www.postgresql.org/docs/17/ddl-priv.html ; https://www.postgresql.org/docs/17/role-attributes.html

## Separate-boundary acceptance proposal
1. A *different privileged authority* (not the Research operator/migration postgres role) must provision and own immutable financial observations and D2/D4 case/generation owner decisions. Ordinary app table owners, service_role, anon and authenticated must not inherit, SET ROLE, have ADMIN OPTION, CREATE, direct DML, grant-control, or owner access to that boundary.
2. Ingress from separately authenticated provider HMAC and merchant-scope proof appends canonical event identifiers, account and full (last_observed_at, observation_count) generation. Owner/counsel decisions append case-specific records without mutating them. Full per-event-ID set digests and authenticated upstream inventory completeness are mandatory; matching counts alone are inadequate.
3. A trusted release gate must compare **every** immutable financial generation and owner decision against current incidents, auth outcome, rights, lease, merchant read, and delivery records, before both privacy completion and email queuing. A deleted incident or newer unadjudicated charge must produce HOLD. Do not allow SQL operators to choose or rewrite the evidence set.
4. The operator can still disable its own incident trigger; this should NOT disable the external independent release barrier. If the operator owns or can promote itself into the custody role, separation fails.
5. A sufficiently privileged database superuser/hosting administrator can still defeat another database-owned table. If the DBA is in the attacker model, require an **external** separately administered, signed append-only audit and independent release controller. No hosted Supabase role topology, Vault, IAM, D2/D4/D5 custody, real source event completeness or legal remedy has been approved.
6. P1-A ambiguous Supabase Admin DELETE request finality remains unproven (SU-547406 only automatic acknowledgments). Never retry a prior ambiguous Auth DELETE based solely on GET active or time elapsed.
7. R1/R2 are separately designed in Draft #1237; they do not yet include this trusted ownership boundary. Do not cherry-pick #1237, merge Drafts or relax R3 HOLD.

## Disposable PG17 role laboratory
The new test script test_incident_custody_owner_boundary.py creates synthetic no-login custody-owner, billing-attestor and decision-signer roles provisioned by the disposable CI superuser, never by the operator. It uses SET SESSION AUTHORIZATION for the postgres adversary (SET ROLE in a superuser session is not a genuine negative). The operator can disable an incident trigger and DELETE its own local source row; a separately owned journal remains and the LAB-only release check must return false. A second provider generation independently blocks release until a distinct owner decision exists.

This lab does NOT capture real invoices, establish hosted privilege feasibility, install a migration, authorize a production release, or protect against a true DBA/superuser. No credentials or customer content are used. The final complete status requires independent adversarial replay, real provider/merchant trust, hosted source parity and explicit owner/counsel approvals.

**Hard holds:** Issue #1103 open; Production NO-GO; existing paid Research and Library Pass rights preserved, new sales paused; no merge, deploy, hosted SQL/DDL, Auth DELETE, payment/merchant/customer changes, credentials or workflow dispatch.
