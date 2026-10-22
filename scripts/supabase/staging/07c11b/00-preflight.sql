-- Inventario somente leitura anterior as migrations 07C.11B.

begin transaction read only;

select
  'target_table_privileges' as section,
  target.table_name,
  role_name,
  has_table_privilege(role_name, format('public.%I', target.table_name), 'SELECT') as can_select,
  has_table_privilege(role_name, format('public.%I', target.table_name), 'INSERT') as can_insert,
  has_table_privilege(role_name, format('public.%I', target.table_name), 'UPDATE') as can_update,
  has_table_privilege(role_name, format('public.%I', target.table_name), 'DELETE') as can_delete,
  has_table_privilege(role_name, format('public.%I', target.table_name), 'TRUNCATE') as can_truncate
from (values
  ('activities'), ('api_connections'), ('audit_logs'),
  ('automation_daily_stats'), ('automation_logs'), ('dashboard_metrics'),
  ('dashboard_widgets'), ('integrations'), ('notifications'),
  ('system_health'), ('user_preferences'), ('webhooks'),
  ('widget_preferences')
) target(table_name)
cross join (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
where to_regclass(format('public.%I', target.table_name)) is not null
order by target.table_name, role_name;

select
  'target_policies' as section,
  p.tablename,
  p.policyname,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('dashboard_metrics', 'dashboard_widgets', 'system_health')
order by p.tablename, p.policyname;

select
  'default_privileges' as section,
  pg_catalog.pg_get_userbyid(d.defaclrole) as owner_name,
  coalesce(n.nspname, '(all schemas)') as schema_name,
  case d.defaclobjtype
    when 'r' then 'tables'
    when 'S' then 'sequences'
    when 'f' then 'functions'
    else d.defaclobjtype::text
  end as object_type,
  case when privilege.grantee = 0
    then 'PUBLIC'
    else pg_catalog.pg_get_userbyid(privilege.grantee)
  end as grantee,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_default_acl d
left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
cross join lateral pg_catalog.aclexplode(d.defaclacl) privilege
where n.nspname = 'public'
order by owner_name, object_type, grantee, privilege.privilege_type;

select
  'security_definer_functions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
  p.proconfig as runtime_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'graphql_public', 'financial_private')
  and p.prosecdef
order by n.nspname, p.proname, identity_arguments;

select
  'postgrest_schema_setting' as section,
  current_setting('pgrst.db_schemas', true) as exposed_schemas;

rollback;
