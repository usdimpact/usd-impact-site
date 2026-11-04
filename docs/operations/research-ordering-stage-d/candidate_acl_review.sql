-- DISPOSABLE CI REVIEW ONLY. DO NOT RUN AGAINST PRODUCTION OR DEVELOPMENT.
-- This is deliberately incomplete and NOT a deployable migration.
-- A real release requires an independently authenticated replacement caller,
-- coordinated webhook routing, other-commerce dependency inventory and rollback.
-- Tests execute these statements inside a transaction and ROLLBACK all effects.

revoke execute on function public.apply_research_membership_transition(
  uuid, text, text, text, text, public.subscription_state,
  public.subscription_state, timestamptz, timestamptz, boolean,
  public.entitlement_state, timestamptz, timestamptz, text, timestamptz, jsonb
) from service_role;
revoke update on public.subscriptions from service_role;
revoke insert, update, delete on public.entitlements from service_role;
revoke insert, update, delete on public.subscription_events from service_role;
revoke insert, update, delete on public.entitlement_events from service_role;
