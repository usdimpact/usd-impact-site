-- USD Impact Research Stage L: synthetic first-activation lifecycle REVIEW ONLY.
-- Never install in connected Development or Production. Requires C,E,F overlays.
-- The initial paid-cycle and checkout-intent witness below is MOCKED, NOT
-- provider-authenticated settlement. No real entitlement authority is implied.
BEGIN;
CREATE SCHEMA research_ordering_stage_l;
REVOKE ALL ON SCHEMA research_ordering_stage_l FROM PUBLIC;

CREATE TABLE research_ordering_stage_l.verified_first_activation (
 event_key text PRIMARY KEY CHECK(length(event_key) BETWEEN 3 AND 200),
 subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 provider text NOT NULL,
 provider_subscription_id text NOT NULL,
 provider_customer_id text NOT NULL,
 store_id text NOT NULL,
 variant_id text NOT NULL,
 binding_fingerprint text NOT NULL CHECK(binding_fingerprint ~ '^[a-f0-9]{64}$'),
 provider_event_id text NOT NULL,
 event_fingerprint text NOT NULL CHECK(event_fingerprint ~ '^[a-f0-9]{64}$'),
 source_type text NOT NULL CHECK(source_type='subscriptions'),
 snapshot_object_at timestamptz NOT NULL,
 target_state public.subscription_state NOT NULL CHECK(target_state='active'),
 target_period_start timestamptz NOT NULL,
 target_period_end timestamptz NOT NULL,
 expected_subscription_version bigint NOT NULL CHECK(expected_subscription_version > 0),
 expected_entitlement_absent boolean NOT NULL CHECK(expected_entitlement_absent = true),
 checkout_intent_id text NOT NULL CHECK(length(checkout_intent_id) BETWEEN 6 AND 120),
 invoice_id text NOT NULL CHECK(invoice_id ~ '^[1-9][0-9]{0,17}$'),
 invoice_snapshot_digest text NOT NULL CHECK(invoice_snapshot_digest ~ '^[a-f0-9]{64}$'),
 issued_quote_digest text NOT NULL CHECK(issued_quote_digest ~ '^[a-f0-9]{64}$'),
 billing_reason text NOT NULL CHECK(billing_reason='initial'),
 provider_snapshot_version text NOT NULL CHECK(length(provider_snapshot_version) BETWEEN 1 AND 160),
 evidence_authority text NOT NULL CHECK(evidence_authority='synthetic_not_provider_authoritative'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(target_period_end > target_period_start)
);
ALTER TABLE research_ordering_stage_l.verified_first_activation ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER stage_l_first_witness_immutable
 BEFORE UPDATE OR DELETE ON research_ordering_stage_l.verified_first_activation
 FOR EACH ROW EXECUTE FUNCTION research_ordering_stage_e.forbid_witness_change();

GRANT USAGE ON SCHEMA research_ordering_stage_l TO research_e_owner,research_e_verifier,research_e_gateway;
GRANT SELECT ON research_ordering_stage_l.verified_first_activation TO research_e_owner;
GRANT INSERT ON research_ordering_stage_l.verified_first_activation TO research_e_verifier;
CREATE POLICY stage_l_witness_select ON research_ordering_stage_l.verified_first_activation
 FOR SELECT TO research_e_owner USING(true);
CREATE POLICY stage_l_witness_insert ON research_ordering_stage_l.verified_first_activation
 FOR INSERT TO research_e_verifier WITH CHECK(true);

-- Retain Stage F for EXISTING-entitlement renewals only. First activation
-- requires a separate zero-entitlement witness and a single lifecycle entry.
-- No second broad gateway: retire Stage F's caller permission in this SAME
-- disposable SQL transaction.
GRANT INSERT ON public.entitlements TO research_e_owner;
GRANT INSERT ON research_ordering_stage_c.applied_watermarks TO research_e_owner;

CREATE FUNCTION research_ordering_stage_l.apply_lifecycle_review(
 p_subscription_id uuid, p_account_id uuid, p_provider text,
 p_provider_subscription_id text, p_provider_customer_id text,
 p_store_id text, p_variant_id text, p_binding_fingerprint text,
 p_event_key text, p_provider_event_id text, p_fingerprint text,
 p_source_type text, p_occurred_at timestamptz,
 p_next_state public.subscription_state,
 p_next_period_start timestamptz, p_next_period_end timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_sub public.subscriptions%rowtype;
 v_ent public.entitlements%rowtype;
 v_first research_ordering_stage_l.verified_first_activation%rowtype;
 v_audit research_ordering_stage_c.delivery_audit%rowtype;
 v_wm research_ordering_stage_c.applied_watermarks%rowtype;
 v_entid uuid;
BEGIN
 -- The lock serializes every first activation and every renewal for one
 -- subscription. NEVER rely on a query-only prior-existence check.
 SELECT * INTO v_sub FROM public.subscriptions WHERE id=p_subscription_id FOR UPDATE;
 IF NOT FOUND OR v_sub.account_id IS DISTINCT FROM p_account_id
    OR v_sub.product_id <> 'research-membership'
    OR v_sub.provider IS DISTINCT FROM p_provider
    OR v_sub.provider_subscription_id IS DISTINCT FROM p_provider_subscription_id
    OR v_sub.provider_customer_id IS DISTINCT FROM p_provider_customer_id
    OR v_sub.metadata->>'review_store_id' IS DISTINCT FROM p_store_id
    OR v_sub.metadata->>'review_variant_id' IS DISTINCT FROM p_variant_id
    OR v_sub.metadata->>'review_binding_fingerprint' IS DISTINCT FROM p_binding_fingerprint
 THEN RAISE EXCEPTION 'review L: subscription/account/trusted checkout mismatch'
  USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_ent FROM public.entitlements
  WHERE account_id=p_account_id AND product_id='research-membership' FOR UPDATE;
 IF FOUND AND (v_ent.subscription_id IS DISTINCT FROM p_subscription_id
   OR v_ent.purchase_id IS NOT NULL) THEN
   RAISE EXCEPTION 'review L: Research entitlement belongs to different source'
    USING ERRCODE='42501';
 END IF;

 -- Require an independent full-effect synthetic witness of the intended
 -- pending->active first purchase. A pending Stage J receipt alone can NEVER
 -- grant access. Every input that can alter a lifecycle effect is matched.
 SELECT * INTO v_first
 FROM research_ordering_stage_l.verified_first_activation w
 WHERE w.event_key=p_event_key AND w.subscription_id=p_subscription_id
   AND w.account_id=p_account_id AND w.provider=p_provider
   AND w.provider_subscription_id=p_provider_subscription_id
   AND w.provider_customer_id=p_provider_customer_id
   AND w.store_id=p_store_id AND w.variant_id=p_variant_id
   AND w.binding_fingerprint=p_binding_fingerprint
   AND w.provider_event_id=p_provider_event_id
   AND w.event_fingerprint=p_fingerprint
   AND w.source_type=p_source_type
   AND w.snapshot_object_at=p_occurred_at
   AND w.target_state=p_next_state
   AND w.target_period_start=p_next_period_start
   AND w.target_period_end=p_next_period_end
   AND w.expected_entitlement_absent=true
   AND w.billing_reason='initial'
   AND w.evidence_authority='synthetic_not_provider_authoritative';

 IF v_first.event_key IS NOT NULL THEN
   SELECT * INTO v_audit FROM research_ordering_stage_c.delivery_audit
    WHERE event_key=p_event_key;
   IF v_audit.event_key IS NOT NULL THEN
     IF v_audit.subscription_id=p_subscription_id AND
        v_audit.fingerprint=p_fingerprint AND
        v_audit.disposition='applied' AND
        v_audit.from_state='pending' AND v_audit.to_state='active'
     THEN RETURN jsonb_build_object('action','synthetic_duplicate',
          'live_can_mutate',false,'provider_settlement_proven',false);
     END IF;
     RAISE EXCEPTION 'review L: first activation replay conflict'
       USING ERRCODE='42501';
   END IF;
 END IF;

 IF v_ent.id IS NOT NULL THEN
   -- Exactly ONE successor function for both first purchase and renewals.
   -- For existing-entitlement events Stage F still requires its own
   -- independently full-effect witnessed/DB-version-fenced event.
   RETURN research_ordering_stage_f.apply_strict_review(
    p_subscription_id,p_account_id,p_provider,p_provider_subscription_id,
    p_provider_customer_id,p_store_id,p_variant_id,p_binding_fingerprint,
    p_event_key,p_provider_event_id,p_fingerprint,p_source_type,p_occurred_at,
    p_next_state,p_next_period_start,p_next_period_end);
 END IF;

 IF v_sub.state <> 'pending' OR p_next_state <> 'active'
    OR p_source_type <> 'subscriptions'
    OR v_first.event_key IS NULL
    OR v_first.expected_subscription_version <> v_sub.version
    OR p_next_period_start IS NULL OR p_next_period_end IS NULL
    OR p_next_period_end <= p_next_period_start THEN
    RAISE EXCEPTION 'review L: first activation not witnessed or not eligible'
      USING ERRCODE='42501';
 END IF;
 -- A future real verifier must require a signed invoice, issued/consumed B5
 -- intent, authoritative period, quote, provider freshness and an owner policy.
 -- This synthetic test cannot supply that independently.
 SELECT * INTO v_wm FROM research_ordering_stage_c.applied_watermarks
  WHERE subscription_id=p_subscription_id FOR UPDATE;
 IF v_wm.subscription_id IS NOT NULL AND
    p_occurred_at <= v_wm.subscription_object_at THEN
    RAISE EXCEPTION 'review L: first activation snapshot is not newer'
       USING ERRCODE='42501';
 END IF;

 INSERT INTO public.entitlements(
    account_id,subscription_id,product_id,state,starts_at,ends_at)
 VALUES(p_account_id,p_subscription_id,'research-membership',
    'active',p_next_period_start,p_next_period_end)
 RETURNING id INTO v_entid;
 UPDATE public.subscriptions SET
   state='active',current_period_start=p_next_period_start,
   current_period_end=p_next_period_end,cancel_at_period_end=false,
   cancel_scheduled_at=null,last_provider_event_id=p_provider_event_id,
   version=version+1
 WHERE id=p_subscription_id;
 INSERT INTO research_ordering_stage_c.applied_watermarks(
    subscription_id,subscription_object_at,source_event_key,witness_digest)
 VALUES(p_subscription_id,p_occurred_at,p_event_key,p_fingerprint)
 ON CONFLICT(subscription_id) DO UPDATE SET
    subscription_object_at=EXCLUDED.subscription_object_at,
    source_event_key=EXCLUDED.source_event_key,
    witness_digest=EXCLUDED.witness_digest;
 INSERT INTO public.subscription_events(
   event_key,subscription_id,account_id,product_id,from_state,to_state,
   reason,actor_type,provider_event_id,occurred_at,metadata)
 VALUES(p_event_key,p_subscription_id,p_account_id,'research-membership',
    'pending','active','stage_l_synthetic_first_activation',
    'provider_webhook',p_provider_event_id,p_occurred_at,
    jsonb_build_object('source','DISPOSABLE-STAGE-L-ONLY'));
 INSERT INTO public.entitlement_events(
   event_key,entitlement_id,account_id,product_id,from_state,to_state,
   reason,actor_type,provider_event_id,occurred_at,metadata)
 VALUES(p_event_key||':entitlement',v_entid,p_account_id,'research-membership',
    NULL,'active','stage_l_synthetic_first_activation',
    'provider_webhook',p_provider_event_id,p_occurred_at,
    jsonb_build_object('source','DISPOSABLE-STAGE-L-ONLY'));
 INSERT INTO research_ordering_stage_c.delivery_audit(
   event_key,subscription_id,provider_event_id,signed_object_kind,
   occurred_at,fingerprint,disposition,reason,from_state,to_state)
 VALUES(p_event_key,p_subscription_id,p_provider_event_id,p_source_type,
   p_occurred_at,p_fingerprint,'applied','stage_l_synthetic_first_activation',
   'pending','active');
 RETURN jsonb_build_object('action','synthetic_first_activation_applied',
   'live_can_mutate',false,'provider_settlement_proven',false,
   'provider_paid_cycle_authoritative',false);
END;
$$;
ALTER FUNCTION research_ordering_stage_l.apply_lifecycle_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) OWNER TO research_e_owner;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_ordering_stage_l
 FROM PUBLIC,anon,authenticated,service_role,research_e_gateway,research_e_verifier;
REVOKE ALL ON ALL TABLES IN SCHEMA research_ordering_stage_l
 FROM PUBLIC,anon,authenticated,service_role,research_e_gateway;
GRANT EXECUTE ON FUNCTION research_ordering_stage_l.apply_lifecycle_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) TO research_e_gateway;
REVOKE EXECUTE ON FUNCTION research_ordering_stage_f.apply_strict_review(
 uuid,uuid,text,text,text,text,text,text,text,text,text,text,
 timestamptz,public.subscription_state,timestamptz,timestamptz
) FROM research_e_gateway;
COMMIT;
