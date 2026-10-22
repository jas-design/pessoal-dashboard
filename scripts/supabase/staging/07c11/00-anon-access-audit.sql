-- Inventario somente leitura de acessos anonimos apos restaurar a baseline.
-- Nao le linhas de negocio: consulta apenas catalogos PostgreSQL.

begin transaction read only;

select
  'anon_schema_privileges' as section,
  n.nspname as schema_name,
  has_schema_privilege('anon', n.oid, 'USAGE') as can_use,
  has_schema_privilege('anon', n.oid, 'CREATE') as can_create
from pg_catalog.pg_namespace n
where n.nspname in ('public', 'financial_private')
order by n.nspname;

select
  'anon_table_privileges' as section,
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'f' then 'foreign_table'
    else c.relkind::text
  end as object_type,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as can_select,
  has_table_privilege('anon', c.oid, 'INSERT') as can_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as can_update,
  has_table_privilege('anon', c.oid, 'DELETE') as can_delete,
  has_table_privilege('anon', c.oid, 'TRUNCATE') as can_truncate,
  has_table_privilege('anon', c.oid, 'REFERENCES') as can_reference,
  has_table_privilege('anon', c.oid, 'TRIGGER') as can_trigger,
  has_table_privilege('anon', c.oid, 'MAINTAIN') as can_maintain
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and (
    has_table_privilege('anon', c.oid, 'SELECT')
    or has_table_privilege('anon', c.oid, 'INSERT')
    or has_table_privilege('anon', c.oid, 'UPDATE')
    or has_table_privilege('anon', c.oid, 'DELETE')
    or has_table_privilege('anon', c.oid, 'TRUNCATE')
    or has_table_privilege('anon', c.oid, 'REFERENCES')
    or has_table_privilege('anon', c.oid, 'TRIGGER')
    or has_table_privilege('anon', c.oid, 'MAINTAIN')
  )
order by c.relname;

select
  'anon_policies' as section,
  p.schemaname as schema_name,
  p.tablename as table_name,
  p.policyname as policy_name,
  p.cmd,
  p.permissive,
  p.roles,
  p.qual,
  p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and (
    'anon' = any(p.roles)
    or 'public' = any(p.roles)
  )
order by p.tablename, p.cmd, p.policyname;

select
  'anon_function_execute' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'financial_private')
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by n.nspname, p.proname, identity_arguments;

select
  'anon_default_privileges' as section,
  pg_catalog.pg_get_userbyid(d.defaclrole) as owner_name,
  n.nspname as schema_name,
  case d.defaclobjtype
    when 'r' then 'table'
    when 'S' then 'sequence'
    when 'f' then 'function'
    when 'T' then 'type'
    when 'n' then 'schema'
    else d.defaclobjtype::text
  end as object_type,
  privilege.privilege_type,
  privilege.is_grantable
from pg_catalog.pg_default_acl d
left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
cross join lateral pg_catalog.aclexplode(d.defaclacl) privilege
join pg_catalog.pg_roles grantee on grantee.oid = privilege.grantee
where grantee.rolname = 'anon'
order by owner_name, schema_name, object_type, privilege.privilege_type;

select
  'anon_sensitive_assertions' as section,
  target.table_name,
  to_regclass(format('public.%I', target.table_name)) is not null as table_exists,
  case
    when to_regclass(format('public.%I', target.table_name)) is null then null
    else has_table_privilege(
      'anon',
      to_regclass(format('public.%I', target.table_name)),
      'SELECT'
    )
  end as anon_can_select,
  case
    when to_regclass(format('public.%I', target.table_name)) is null then null
    else has_table_privilege(
      'anon',
      to_regclass(format('public.%I', target.table_name)),
      'TRUNCATE'
    )
  end as anon_can_truncate,
  exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = target.table_name
      and p.cmd in ('SELECT', 'ALL')
      and ('anon' = any(p.roles) or 'public' = any(p.roles))
  ) as anon_select_policy_exists
from (values
  ('api_connections'),
  ('activities'),
  ('audit_logs'),
  ('automation_daily_stats'),
  ('automation_logs'),
  ('dashboard_metrics'),
  ('dashboard_widgets'),
  ('integrations'),
  ('notifications'),
  ('system_health'),
  ('user_preferences'),
  ('webhooks'),
  ('widget_preferences'),
  ('profiles'),
  ('companies'),
  ('documents'),
  ('financial_extracted_rows'),
  ('financial_extraction_jobs'),
  ('financial_review_audit'),
  ('financial_review_document_policy')
) target(table_name)
order by target.table_name;

rollback;

