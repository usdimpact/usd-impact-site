begin;

-- Paddle webhook receipts are written only by trusted server-side code using
-- the Supabase secret key. RLS bypass does not replace table privileges, so
-- grant the service role only the operations required for durable receipt
-- storage and later processing.
grant usage on schema public to service_role;
grant select, insert, update on table public.webhook_receipts to service_role;

commit;
