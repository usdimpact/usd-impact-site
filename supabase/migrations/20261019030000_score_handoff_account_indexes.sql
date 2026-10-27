-- DRAFT ONLY. Development/Preview database validation before Production review.
-- Foreign-key supporting indexes for account deletion and session/ticket cleanup.
-- Additive indexes only; no DML, policies or permissions change.
begin;
create index if not exists score_handoff_tickets_account_id_idx
  on public.score_handoff_tickets(account_id);
create index if not exists score_member_sessions_account_id_idx
  on public.score_member_sessions(account_id);
commit;
