begin;

-- The Research Membership persistence RPC is SECURITY INVOKER. Grant only the
-- table privileges its service_role caller needs for the existing atomic
-- transition path; keep anonymous/authenticated access unchanged.
grant select, update on table public.subscriptions to service_role;
grant select, insert on table public.subscription_events to service_role;
grant select, insert, update on table public.entitlements to service_role;
grant insert on table public.entitlement_events to service_role;

commit;
