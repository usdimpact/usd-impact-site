-- S1c restrictive GLOBAL function default for postgres (no IN SCHEMA): removes built-in PUBLIC EXECUTE
alter default privileges for role postgres revoke execute on functions from public;
