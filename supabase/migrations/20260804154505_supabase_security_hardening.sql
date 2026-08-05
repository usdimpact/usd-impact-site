begin;

-- Trigger functions are invoked by PostgreSQL through their attached trigger;
-- they are not application RPC endpoints. Remove the default PUBLIC execute
-- privilege so anon, authenticated, and service-role API calls cannot invoke
-- this SECURITY DEFINER helper directly.
revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated, service_role;

commit;
