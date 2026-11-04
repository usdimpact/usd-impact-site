-- S1a PRODUCTION-LIKE (owner-reported): restrictive function defaults for objects created by postgres, INCLUDING PUBLIC; no table defaults
alter default privileges for role postgres in schema public revoke execute on functions from public;
