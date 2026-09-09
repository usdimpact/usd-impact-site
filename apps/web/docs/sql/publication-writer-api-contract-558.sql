-- LOCAL-ONLY review/test candidate for issue 558. NOT a registered migration.
-- Apply only after the pinned baseline in a new disposable test database.
-- Replaces (does not layer over) the prior two-wrapper permission experiment.
-- Six private definer entry points; restricted NOLOGIN, non-table-owner owners.
-- Logical machine roles only. No browser/user/service-role grant or credential.
-- Every governed write locks history -> release -> admission before mutation.
-- Owner/superuser raw SQL is outside this runtime contract.
BEGIN;
CREATE ROLE fx558_reader_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_controller_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_controller NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_recorder_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_recorder NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_revoker_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE fx558_revoker NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE SCHEMA publication_guard_api;
REVOKE ALL ON SCHEMA publication_guard_api FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA publication_guard_api TO fx558_reader,fx558_controller,fx558_recorder,fx558_revoker,
 fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
GRANT USAGE ON SCHEMA publication_guard TO fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
GRANT SELECT ON publication_guard.history_state,publication_guard.release_authorizations,publication_guard.publication_admissions
 TO fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
GRANT UPDATE (revision) ON publication_guard.history_state TO fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
-- Some UPDATE privilege is necessary for SELECT FOR UPDATE. Lock-only policies
-- have false WITH CHECK, so these rights cannot perform a real release mutation.
GRANT UPDATE (revoked_at) ON publication_guard.release_authorizations TO fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
GRANT UPDATE (state) ON publication_guard.publication_admissions TO fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
GRANT UPDATE (response_receipt_sha256) ON publication_guard.publication_admissions TO fx558_recorder_owner;
GRANT INSERT (release_id,repository,project_id,team_id,deployment_id,commit_sha,artifact_sha256,approval_sha256,expires_at)
 ON publication_guard.release_authorizations TO fx558_controller_owner;
GRANT INSERT (path,source_sha256,release_id,event_mode,evidence_sha256,calendar_checked_at,calendar_valid_until,preview_deadline,not_before)
 ON publication_guard.publication_admissions TO fx558_controller_owner;
CREATE POLICY fx558_history_read ON publication_guard.history_state FOR SELECT
 TO fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner USING (true);
CREATE POLICY fx558_release_read ON publication_guard.release_authorizations FOR SELECT
 TO fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner USING (true);
CREATE POLICY fx558_admission_read ON publication_guard.publication_admissions FOR SELECT
 TO fx558_reader_owner,fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner USING (true);
CREATE POLICY fx558_history_advance ON publication_guard.history_state FOR UPDATE
 TO fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner USING (singleton) WITH CHECK (singleton AND revision>=0);
CREATE POLICY fx558_release_lock_only ON publication_guard.release_authorizations FOR UPDATE
 TO fx558_controller_owner,fx558_recorder_owner USING (true) WITH CHECK (false);
CREATE POLICY fx558_admission_lock_only ON publication_guard.publication_admissions FOR UPDATE
 TO fx558_controller_owner USING (true) WITH CHECK (false);
CREATE POLICY fx558_release_prepare ON publication_guard.release_authorizations FOR INSERT
 TO fx558_controller_owner WITH CHECK (revoked_at IS NULL);
CREATE POLICY fx558_admission_prepare ON publication_guard.publication_admissions FOR INSERT
 TO fx558_controller_owner WITH CHECK (state='pending' AND admitted_at IS NULL AND response_receipt_sha256 IS NULL);
CREATE POLICY fx558_admission_record ON publication_guard.publication_admissions FOR UPDATE
 TO fx558_recorder_owner USING (state IN ('pending','admitted','revoked')) WITH CHECK (state='admitted');
CREATE POLICY fx558_release_revoke ON publication_guard.release_authorizations FOR UPDATE
 TO fx558_revoker_owner USING (true) WITH CHECK (revoked_at IS NOT NULL);
CREATE POLICY fx558_admission_revoke ON publication_guard.publication_admissions FOR UPDATE
 TO fx558_revoker_owner USING (true) WITH CHECK (state='revoked');
GRANT EXECUTE ON FUNCTION publication_guard.read_history(text,jsonb),publication_guard.iso(timestamptz) TO fx558_reader_owner;
GRANT EXECUTE ON FUNCTION publication_guard.finalize_admission(uuid,text,text,text) TO fx558_recorder_owner;

-- Not callable by any runtime client. No mutation; holds the common row lock.
CREATE FUNCTION publication_guard_api.acquire_writer_gate() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' SET row_security=on AS $$
BEGIN
 IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION 'HOLD_ISOLATION_UNSUPPORTED';
 END IF;
 PERFORM 1 FROM publication_guard.history_state WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_HISTORY_UNAVAILABLE'; END IF;
END $$;

CREATE FUNCTION publication_guard_api.read_snapshot(p_revision text,p_keys jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' SET row_security=on AS $$
 SELECT publication_guard.read_history(p_revision,p_keys)
$$;

CREATE FUNCTION publication_guard_api.authorize_release(p_release uuid,p_deployment text,p_commit text,
 p_artifact text,p_approval text,p_expires timestamptz) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE r publication_guard.release_authorizations;
BEGIN
 IF p_release IS NULL OR (p_deployment ~ '^dpl_[A-Za-z0-9]{8,80}$') IS NOT TRUE
  OR (p_commit ~ '^[a-f0-9]{40}$') IS NOT TRUE OR (p_artifact ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR (p_approval ~ '^[a-f0-9]{64}$') IS NOT TRUE OR p_expires IS NULL OR NOT pg_catalog.isfinite(p_expires)
 THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=p_release FOR UPDATE;
 IF FOUND THEN
  IF ROW(r.deployment_id,r.commit_sha,r.artifact_sha256,r.approval_sha256,r.expires_at)
   IS DISTINCT FROM ROW(p_deployment,p_commit,p_artifact,p_approval,p_expires)
   THEN RAISE EXCEPTION 'HOLD_AUTHORIZATION_CONFLICT'; END IF;
  IF r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
  IF pg_catalog.clock_timestamp()>=r.expires_at THEN RAISE EXCEPTION 'HOLD_APPROVAL_EXPIRED'; END IF;
  RETURN 'ALREADY_AUTHORIZED';
 END IF;
 INSERT INTO publication_guard.release_authorizations
  (release_id,repository,project_id,team_id,deployment_id,commit_sha,artifact_sha256,approval_sha256,expires_at)
 VALUES (p_release,'usdimpact/usd-impact-site','prj_ZoLLM35ksI6wk17PcfS2xYknaVl7','team_1LuMlacGuM198mRjoID4O3Ct',
  p_deployment,p_commit,p_artifact,p_approval,p_expires);
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_WRITE_NOT_APPLIED'; END IF;
 RETURN 'AUTHORIZED_PENDING_ONLY';
END $$;

CREATE FUNCTION publication_guard_api.prepare_admission(p_release uuid,p_path text,p_source text,p_mode text,
 p_evidence text,p_checked timestamptz,p_until timestamptz,p_deadline timestamptz,p_not_before timestamptz)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE r publication_guard.release_authorizations; a publication_guard.publication_admissions; t timestamptz;
BEGIN
 IF p_release IS NULL OR pg_catalog.octet_length(p_path)>300
  OR (p_path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') IS NOT TRUE
  OR (p_source ~ '^[a-f0-9]{64}$') IS NOT TRUE OR (p_evidence ~ '^[a-f0-9]{64}$') IS NOT TRUE
  OR (p_mode IN ('preview','outcome','none')) IS NOT TRUE OR p_checked IS NULL OR p_until IS NULL
  OR NOT pg_catalog.isfinite(p_checked) OR NOT pg_catalog.isfinite(p_until)
  THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=p_release FOR UPDATE;
 IF NOT FOUND OR r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 SELECT * INTO a FROM publication_guard.publication_admissions WHERE path=p_path AND source_sha256=p_source FOR UPDATE;
 IF FOUND THEN
  IF ROW(a.release_id,a.event_mode,a.evidence_sha256,a.calendar_checked_at,a.calendar_valid_until,a.preview_deadline,a.not_before)
   IS DISTINCT FROM ROW(p_release,p_mode,p_evidence,p_checked,p_until,p_deadline,p_not_before)
   THEN RAISE EXCEPTION 'HOLD_PREPARATION_CONFLICT'; END IF;
  IF a.state='revoked' THEN RAISE EXCEPTION 'HOLD_REVOKED'; END IF;
  -- Freshness is checked AFTER all possible row waits, including exact retries.
  t:=pg_catalog.clock_timestamp();
  IF t>=r.expires_at THEN RAISE EXCEPTION 'HOLD_APPROVAL_EXPIRED'; END IF;
  IF t<p_checked OR t>=p_until THEN RAISE EXCEPTION 'HOLD_EVIDENCE_EXPIRED'; END IF;
  IF p_deadline IS NOT NULL AND t>=p_deadline THEN RAISE EXCEPTION 'HOLD_PREVIEW_EXPIRED'; END IF;
  IF p_not_before IS NOT NULL AND t<p_not_before THEN RAISE EXCEPTION 'HOLD_OUTCOME_NOT_RELEASED'; END IF;
  RETURN CASE WHEN a.state='admitted' THEN 'ALREADY_ADMITTED' ELSE 'ALREADY_PREPARED' END;
 END IF;
 PERFORM 1 FROM publication_guard.publication_admissions WHERE release_id=p_release AND path=p_path FOR UPDATE;
 IF FOUND THEN RAISE EXCEPTION 'HOLD_PREPARATION_CONFLICT'; END IF;
 -- The original trigger checks database time after locks and rejects invalid modes,
 -- phase/deadline combinations, backdating and overlong evidence. No timestamps
 -- controlled by the caller are written into prepared_at/admitted_at.
 INSERT INTO publication_guard.publication_admissions
  (path,source_sha256,release_id,event_mode,evidence_sha256,calendar_checked_at,calendar_valid_until,preview_deadline,not_before)
 VALUES (p_path,p_source,p_release,p_mode,p_evidence,p_checked,p_until,p_deadline,p_not_before);
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_WRITE_NOT_APPLIED'; END IF;
 RETURN 'PREPARED_NOT_ADMITTED';
END $$;

CREATE FUNCTION publication_guard_api.record_verified_receipt(p_release uuid,p_path text,p_source text,p_receipt text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
BEGIN
 IF p_release IS NULL OR pg_catalog.octet_length(p_path)>300
  OR (p_path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') IS NOT TRUE
  OR (p_source ~ '^[a-f0-9]{64}$') IS NOT TRUE OR (p_receipt ~ '^[a-f0-9]{64}$') IS NOT TRUE
  THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 -- The pinned invoker finalizer then obtains release and admission locks and
 -- performs the post-wait database-clock check. It cannot be called by clients.
 RETURN publication_guard.finalize_admission(p_release,p_path,p_source,p_receipt);
END $$;

CREATE FUNCTION publication_guard_api.revoke_release(p_release uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE r publication_guard.release_authorizations;
BEGIN
 IF p_release IS NULL THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=p_release FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 IF r.revoked_at IS NOT NULL THEN RETURN 'ALREADY_REVOKED'; END IF;
 -- Revocation remains possible after approval expiry; no evidence is refreshed.
 UPDATE publication_guard.release_authorizations SET revoked_at=pg_catalog.clock_timestamp() WHERE release_id=p_release;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_WRITE_NOT_APPLIED'; END IF;
 RETURN 'REVOKED';
END $$;

CREATE FUNCTION publication_guard_api.revoke_admission(p_release uuid,p_path text,p_source text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=on SET lock_timeout='2s' AS $$
DECLARE r publication_guard.release_authorizations; a publication_guard.publication_admissions;
BEGIN
 IF p_release IS NULL OR pg_catalog.octet_length(p_path)>300
  OR (p_path ~ '^/news/([0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts/[a-z0-9]+(-[a-z0-9]+)*)$') IS NOT TRUE
  OR (p_source ~ '^[a-f0-9]{64}$') IS NOT TRUE THEN RAISE EXCEPTION 'HOLD_INVALID_REQUEST'; END IF;
 PERFORM publication_guard_api.acquire_writer_gate();
 SELECT * INTO r FROM publication_guard.release_authorizations WHERE release_id=p_release FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_RELEASE_UNAUTHORIZED'; END IF;
 SELECT * INTO a FROM publication_guard.publication_admissions WHERE path=p_path AND source_sha256=p_source FOR UPDATE;
 IF NOT FOUND OR a.release_id<>p_release THEN RAISE EXCEPTION 'HOLD_ADMISSION_NOT_PREPARED'; END IF;
 IF a.state='revoked' THEN RETURN 'ALREADY_REVOKED'; END IF;
 UPDATE publication_guard.publication_admissions SET state='revoked' WHERE path=p_path AND source_sha256=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'HOLD_WRITE_NOT_APPLIED'; END IF;
 RETURN 'REVOKED';
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA publication_guard_api FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION publication_guard_api.acquire_writer_gate()
 TO fx558_controller_owner,fx558_recorder_owner,fx558_revoker_owner;
ALTER FUNCTION publication_guard_api.read_snapshot(text,jsonb) OWNER TO fx558_reader_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.read_snapshot(text,jsonb) TO fx558_reader;
ALTER FUNCTION publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz) OWNER TO fx558_controller_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.authorize_release(uuid,text,text,text,text,timestamptz) TO fx558_controller;
ALTER FUNCTION publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz) OWNER TO fx558_controller_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.prepare_admission(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz) TO fx558_controller;
ALTER FUNCTION publication_guard_api.record_verified_receipt(uuid,text,text,text) OWNER TO fx558_recorder_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.record_verified_receipt(uuid,text,text,text) TO fx558_recorder;
ALTER FUNCTION publication_guard_api.revoke_release(uuid) OWNER TO fx558_revoker_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.revoke_release(uuid) TO fx558_revoker;
ALTER FUNCTION publication_guard_api.revoke_admission(uuid,text,text) OWNER TO fx558_revoker_owner;
GRANT EXECUTE ON FUNCTION publication_guard_api.revoke_admission(uuid,text,text) TO fx558_revoker;
-- No runtime role has raw relation rights, owner membership, schema CREATE,
-- or direct access to the gate or original finalizer. No LOGIN is created.
-- Do not adopt alongside a legacy raw writer; administrative maintenance must
-- quiesce runtime or honor this same lock order. No automatic retry or COMMIT.
COMMIT;
