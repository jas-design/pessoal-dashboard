-- Diagnostico somente leitura do contrato global de profiles.
-- O resultado deve ser revisado antes de alterar a migration de profiles.

begin transaction read only;

select
  'profile_role_column' as section,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'profiles'
  and c.column_name = 'role';

select
  'profile_role_constraints' as section,
  con.conname as constraint_name,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
where con.conrelid = to_regclass('public.profiles')
  and con.contype = 'c'
order by con.conname;

select
  'profile_foreign_key_consumers' as section,
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where con.contype = 'f'
  and con.confrelid = to_regclass('public.profiles')
order by n.nspname, c.relname, con.conname;

select
  'profile_authorization_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proconfig as runtime_settings,
  pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin', 'current_user_role', 'can_access_module')
order by p.proname, identity_arguments;

rollback;

