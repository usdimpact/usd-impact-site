-- USD Impact Research Stage N: B5 M1 strict + J/K + Stage L integrated
-- disposable PostgreSQL 17.6 design overlay ONLY; not a migration.
-- The actual B5 M1 source is pinned at upstream sha256 e936e18f1ed7... .
-- No provider settlement or authoritative paid period; NO live entitlement GO.
BEGIN;

CREATE SCHEMA research_ordering_stage_n;
REVOKE ALL ON SCHEMA research_ordering_stage_n FROM PUBLIC,anon,authenticated,service_role;

-- P2 L-2: Stage E had one broad FOR ALL policy on the lifecycle NOLOGIN
-- owner. Restrict BOTH OLD and NEW rows across all DML; the owner cannot
-- synthesize purchase-backed Library Pass INSERT/UPDATE or change product_id.
ALTER POLICY research_e_entitlements_owner ON public.entitlements
  USING(product_id='research-membership')
  WITH CHECK(product_id='research-membership');
ALTER POLICY research_e_subscriptions_owner ON public.subscriptions
  USING(product_id='research-membership')
  WITH CHECK(product_id='research-membership');
ALTER POLICY research_e_subscription_events_owner ON public.subscription_events
  WITH CHECK(product_id='research-membership');
ALTER POLICY research_e_entitlement_events_owner ON public.entitlement_events
  WITH CHECK(product_id='research-membership');

-- SELECT-only shared B5 D2-07 custody. The same DB transaction obtains
-- FOR SHARE locks so checkout, B5 signed observation, J invoice and K audit
-- cannot change during the synthetic first-activation transition.
GRANT USAGE ON SCHEMA research_checkout_guard,
 research_ordering_stage_j,research_ordering_stage_k,
 research_ordering_stage_l TO research_e_owner;
GRANT SELECT ON research_checkout_guard.checkout_intents,
 research_checkout_guard.signed_paid_observations,
 research_checkout_guard.signed_paid_deliveries,
 research_checkout_guard.conflict_evidence TO research_e_owner;
GRANT SELECT ON research_ordering_stage_j.invoice_receipts,
 research_ordering_stage_k.provider_observations,
 research_ordering_stage_l.verified_first_activation TO research_e_owner;
CREATE POLICY stage_n_j_invoice_reader ON research_ordering_stage_j.invoice_receipts
 FOR SELECT TO research_e_owner USING(true);
CREATE POLICY stage_n_k_observation_reader ON research_ordering_stage_k.provider_observations
 FOR SELECT TO research_e_owner USING(true);
-- Row-level locks require UPDATE privilege even for FOR SHARE. The owner
-- receives only narrow column grants with fail-closed SQL UPDATE guards;
-- it MUST NOT be able to edit custody or checkout state directly.
GRANT UPDATE(state) ON research_checkout_guard.checkout_intents TO research_e_owner;
GRANT UPDATE(id) ON research_checkout_guard.signed_paid_observations TO research_e_owner;
GRANT UPDATE(disposition) ON research_ordering_stage_j.invoice_receipts TO research_e_owner;
CREATE POLICY stage_n_j_owner_lock_only ON research_ordering_stage_j.invoice_receipts
 FOR UPDATE TO research_e_owner USING(true) WITH CHECK(false);

CREATE FUNCTION research_ordering_stage_n.reject_research_owner_checkout_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $
BEGIN
 IF current_user='research_e_owner' THEN
  RAISE EXCEPTION 'stage n: lifecycle owner cannot modify checkout custody'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$;
CREATE TRIGGER stage_n_checkout_owner_read_lock_only
 BEFORE UPDATE ON research_checkout_guard.checkout_intents
 FOR EACH ROW EXECUTE FUNCTION research_ordering_stage_n.reject_research_owner_checkout_edit();


CREATE FUNCTION research_ordering_stage_n.apply_b5_bound_lifecycle_review(
 p_subscription_id uuid,p_account_id uuid,p_provider text,
 p_provider_subscription_id text,p_provider_customer_id text,
 p_store_id text,p_variant_id text,p_binding_fingerprint text,
 p_event_key text,p_provider_event_id text,p_fingerprint text,
 p_source_type text,p_occurred_at timestamptz,
 p_next_state public.subscription_state,
 p_next_period_start timestamptz,p_next_period_end timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_sub public.subscriptions%rowtype;
 v_ent public.entitlements%rowtype;
 v_first research_ordering_stage_l.verified_first_activation%rowtype;
 v_intent research_checkout_guard.checkout_intents%rowtype;
 v_paid research_checkout_guard.signed_paid_observations%rowtype;
 v_invoice research_ordering_stage_j.invoice_receipts%rowtype;
 v_journal research_ordering_stage_k.provider_observations%rowtype;
 v_result jsonb;
BEGIN
 -- This is not a trust boundary. Trusted caller identity, HMAC provider
 -- settlement and invoice-to-cycle start are still intentionally missing.
 SELECT * INTO v_sub FROM public.subscriptions
  WHERE id=p_subscription_id AND account_id=p_account_id FOR UPDATE;
 IF NOT FOUND OR v_sub.product_id<>'research-membership' THEN
   RAISE EXCEPTION 'stage n: unbound Research subscription' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_ent FROM public.entitlements
  WHERE account_id=p_account_id AND product_id='research-membership' FOR SHARE;
 IF v_ent.id IS NULL THEN
   -- Do NOT let a fabricated verifier-witness checkout ID become payment
   -- authority. Look it up in the *actual pinned B5 M1 strict* table.
   SELECT * INTO v_first FROM research_ordering_stage_l.verified_first_activation
    WHERE event_key=p_event_key AND subscription_id=p_subscription_id
      AND account_id=p_account_id AND provider_subscription_id=p_provider_subscription_id
      AND event_fingerprint=p_fingerprint AND expected_entitlement_absent
      AND billing_reason='initial'; -- immutable witness; no row lock needed
   IF NOT FOUND OR v_first.checkout_intent_id IS NULL OR
      v_first.checkout_intent_id !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   THEN RAISE EXCEPTION 'stage n: exact first activation witness missing'
      USING ERRCODE='42501'; END IF;
   SELECT * INTO v_intent FROM research_checkout_guard.checkout_intents
    WHERE id=v_first.checkout_intent_id::uuid FOR SHARE;
   IF NOT FOUND OR v_intent.state<>'consumed'
      OR v_intent.consumed_at IS NULL
      OR v_intent.provider_checkout_id IS NULL
      OR v_intent.provider_subscription_id IS DISTINCT FROM p_provider_subscription_id
      OR v_intent.account_id IS DISTINCT FROM p_account_id
      OR v_intent.product_id<>'research-membership'
      OR v_intent.store_id IS DISTINCT FROM p_store_id
      OR v_intent.variant_id IS DISTINCT FROM p_variant_id
      OR v_intent.test_mode IS DISTINCT FROM true
      OR v_sub.state<>'pending'
      OR v_sub.provider IS DISTINCT FROM p_provider
      OR v_sub.provider_price_id IS DISTINCT FROM p_variant_id
      OR v_sub.provider_subscription_id IS DISTINCT FROM p_provider_subscription_id
      OR v_sub.provider_customer_id IS DISTINCT FROM p_provider_customer_id
      OR v_sub.version IS DISTINCT FROM v_first.expected_subscription_version
   THEN RAISE EXCEPTION 'stage n: B5 consumed intent/subscription mismatch'
      USING ERRCODE='42501'; END IF;

   SELECT * INTO v_paid FROM research_checkout_guard.signed_paid_observations
    WHERE provider=p_provider AND provider_subscription_id=p_provider_subscription_id
    FOR UPDATE; -- FK conflict inserts require key-share; block until commit
   IF NOT FOUND OR v_paid.catalog_quarantined
      OR v_paid.provider_customer_id IS DISTINCT FROM p_provider_customer_id
      OR v_paid.store_id IS DISTINCT FROM p_store_id
      OR v_paid.provider_price_id IS DISTINCT FROM p_variant_id
      OR v_paid.test_mode IS DISTINCT FROM v_intent.test_mode
      OR v_paid.product_id<>'research-membership'
      OR v_paid.claimed_account_id IS DISTINCT FROM p_account_id
      OR v_paid.claimed_checkout_proof_sha256
        IS DISTINCT FROM v_intent.checkout_proof_sha256
      OR v_paid.business_fingerprint_sha256 IS DISTINCT FROM p_binding_fingerprint
      OR v_paid.occurred_at > v_intent.expires_at + interval '2 minutes'
      OR v_paid.occurred_at < v_intent.created_at - interval '5 minutes'
   THEN RAISE EXCEPTION 'stage n: B5 signed paid observation mismatch'
      USING ERRCODE='42501'; END IF;

   IF NOT EXISTS(SELECT 1 FROM research_checkout_guard.signed_paid_deliveries
      WHERE paid_observation_id=v_paid.id)
   OR EXISTS(SELECT 1 FROM research_checkout_guard.conflict_evidence
      WHERE paid_observation_id=v_paid.id)
   THEN RAISE EXCEPTION 'stage n: missing signed delivery or B5 conflict'
      USING ERRCODE='42501'; END IF;

   SELECT * INTO v_invoice FROM research_ordering_stage_j.invoice_receipts
    WHERE provider='lemon-squeezy' AND store_id=p_store_id
     AND test_mode=v_intent.test_mode AND invoice_id=v_first.invoice_id
    FOR SHARE;
   IF NOT FOUND OR v_invoice.disposition<>'pending_reconciliation'
      OR v_invoice.subscription_id IS DISTINCT FROM p_provider_subscription_id
      OR v_invoice.invoice_snapshot_digest IS DISTINCT FROM v_first.invoice_snapshot_digest
   THEN RAISE EXCEPTION 'stage n: canonical invoice absent/conflicted'
      USING ERRCODE='42501'; END IF;

   SELECT * INTO v_journal FROM research_ordering_stage_k.provider_observations
    WHERE provider='lemon-squeezy' AND store_id=p_store_id
      AND test_mode=v_intent.test_mode AND invoice_id=v_first.invoice_id
      AND subscription_id=p_provider_subscription_id
      AND invoice_snapshot_digest=v_first.invoice_snapshot_digest
      AND quote_evidence_digest=v_first.issued_quote_digest
      AND event_name='subscription_payment_success'
      AND action='first_invoice_held'
      AND disposition='pending_reconciliation'
    ORDER BY id LIMIT 1; -- append-only audit; J parent receipt remains locked
   IF NOT FOUND OR EXISTS(
     SELECT 1 FROM research_ordering_stage_k.provider_observations k
     WHERE k.provider='lemon-squeezy' AND k.store_id=p_store_id
       AND k.test_mode=v_intent.test_mode AND k.invoice_id=v_first.invoice_id
       AND k.disposition='quarantined_conflict'
   ) THEN RAISE EXCEPTION 'stage n: canonical signed invoice observation not clean'
       USING ERRCODE='42501'; END IF;
 END IF;

 -- The ONLY synthetic transition gateway in this overlay. The B5/J/K
 -- locks are held until the same local DB transaction completes.
 v_result:=research_ordering_stage_l.apply_lifecycle_review(
  p_subscription_id,p_account_id,p_provider,p_provider_subscription_id,
  p_provider_customer_id,p_store_id,p_variant_id,p_binding_fingerprint,
  p_event_key,p_provider_event_id,p_fingerprint,p_source_type,p_occurred_at,
  p_next_state,p_next_period_start,p_next_period_end);
 RETURN jsonb_build_object('action',v_result->>'action',
  'synthetic_effect_occurred',v_result->>'action' IN
   ('synthetic_first_activation_applied','applied'),
  'can_mutate',false,'live_can_mutate',false,
  'provider_paid_cycle_authoritative',false,
  'provider_settlement_proven',false,
  'remote_atomicity_proven',false,
  'source','DISPOSABLE_STAGE_N_ONLY');
END;
$$;

ALTER FUNCTION research_ordering_stage_n.apply_b5_bound_lifecycle_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) OWNER TO research_e_owner;
GRANT USAGE ON SCHEMA research_ordering_stage_n TO research_e_gateway;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_ordering_stage_n
 FROM PUBLIC,anon,authenticated,service_role,research_e_verifier,research_e_gateway;
GRANT EXECUTE ON FUNCTION research_ordering_stage_n.apply_b5_bound_lifecycle_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) TO research_e_gateway;
REVOKE EXECUTE ON FUNCTION research_ordering_stage_l.apply_lifecycle_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) FROM research_e_gateway;
COMMIT;
