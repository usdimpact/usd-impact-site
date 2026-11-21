-- ISSUE #950 - REVIEW ONLY scoped S3 JWT transfer policy rollback.
-- No Storage object bytes or SQL rows are deleted. Auth sign-out/session
-- revocation and any synthetic user cleanup require a separately approved
-- and logged operation, never a customer identity.
-- Use only on the isolated restore movnekagnxgcyenczfoc.
-- NEVER Production gjzetjugmnwanvjkchux. Verification is mandatory.
begin;
drop policy if exists issue950_restore_session_objects_select on storage.objects;
drop policy if exists issue950_restore_session_objects_insert on storage.objects;
drop policy if exists issue950_restore_session_objects_update on storage.objects;
drop policy if exists issue950_restore_session_buckets_select on storage.buckets;
commit;
