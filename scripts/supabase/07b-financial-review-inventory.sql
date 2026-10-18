-- Etapa 07B: inventário somente leitura da revisão financeira.
-- Este arquivo consulta apenas catálogos PostgreSQL. Não lê linhas financeiras,
-- não altera objetos e pode ser executado no Supabase SQL Editor.

select
  'database_context' as section,
  current_database() as database_name,
  current_user as execution_role,
  current_setting('server_version') as server_version;

select
  'target_schemas' as section,
  n.nspname as schema_name,
  pg_get_userbyid(n.nspowner) as owner_name,
  has_schema_privilege('anon', n.oid, 'USAGE') as anon_has_usage,
  has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_has_usage,
  has_schema_privilege('service_role', n.oid, 'USAGE') as service_role_has_usage
from pg_catalog.pg_namespace n
where n.nspname in ('public', 'financial_private')
order by n.nspname;

select
  'target_roles' as section,
  r.rolname,
  r.rolsuper,
  r.rolinherit,
  r.rolcreaterole,
  r.rolcreatedb,
  r.rolcanlogin,
  r.rolbypassrls
from pg_catalog.pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname;

with target_relations(object_name) as (
  values
    ('companies'),
    ('documents'),
    ('financial_extracted_rows'),
    ('financial_extraction_jobs'),
    ('financial_review_audit'),
    ('financial_review_document_policy'),
    ('financial_transactions'),
    ('company_members'),
    ('profiles'),
    ('user_permissions')
), public_relations as (
  select
    c.oid,
    c.relname,
    c.relkind,
    c.relowner,
    c.relrowsecurity,
    c.relforcerowsecurity,
    n.nspname
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
)
select
  'target_relations' as section,
  t.object_name,
  r.oid is not null as object_exists,
  r.nspname as schema_name,
  case r.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'f' then 'foreign_table'
    else r.relkind::text
  end as object_type,
  pg_get_userbyid(r.relowner) as owner_name,
  r.relrowsecurity as rls_enabled,
  r.relforcerowsecurity as rls_forced
from target_relations t
left join public_relations r on r.relname = t.object_name
order by t.object_name;

select
  'target_columns' as section,
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.is_generated
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions',
    'company_members',
    'profiles',
    'user_permissions'
  )
order by c.table_name, c.ordinal_position;

select
  'target_constraints' as section,
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'primary_key'
    when 'f' then 'foreign_key'
    when 'u' then 'unique'
    when 'c' then 'check'
    when 'x' then 'exclusion'
    else con.contype::text
  end as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions',
    'company_members',
    'profiles',
    'user_permissions'
  )
order by c.relname, con.conname;

select
  'target_indexes' as section,
  i.schemaname as schema_name,
  i.tablename as table_name,
  i.indexname as index_name,
  i.indexdef as definition
from pg_catalog.pg_indexes i
where i.schemaname = 'public'
  and i.tablename in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions',
    'company_members',
    'profiles',
    'user_permissions'
  )
order by i.tablename, i.indexname;

select
  'target_rls_policies' as section,
  p.schemaname as schema_name,
  p.tablename as table_name,
  p.policyname as policy_name,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual as using_expression,
  p.with_check as with_check_expression
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions',
    'company_members',
    'profiles',
    'user_permissions'
  )
order by p.tablename, p.cmd, p.policyname;

with target_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and c.relname in (
      'companies',
      'documents',
      'financial_extracted_rows',
      'financial_extraction_jobs',
      'financial_review_audit',
      'financial_review_document_policy',
      'financial_transactions',
      'company_members',
      'profiles',
      'user_permissions'
    )
), target_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
)
select
  'effective_table_privileges' as section,
  t.schema_name,
  t.table_name,
  r.role_name,
  has_table_privilege(r.role_name, t.oid, 'SELECT') as can_select,
  has_table_privilege(r.role_name, t.oid, 'INSERT') as can_insert,
  has_table_privilege(r.role_name, t.oid, 'UPDATE') as can_update,
  has_table_privilege(r.role_name, t.oid, 'DELETE') as can_delete,
  has_table_privilege(r.role_name, t.oid, 'TRUNCATE') as can_truncate,
  has_table_privilege(r.role_name, t.oid, 'REFERENCES') as can_reference,
  has_table_privilege(r.role_name, t.oid, 'TRIGGER') as can_trigger
from target_tables t
cross join target_roles r
order by t.table_name, r.role_name;

select
  'column_privileges' as section,
  g.table_schema,
  g.table_name,
  g.column_name,
  g.grantee,
  g.privilege_type,
  g.is_grantable
from information_schema.role_column_grants g
where g.table_schema = 'public'
  and g.table_name in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions',
    'company_members',
    'profiles',
    'user_permissions'
  )
  and g.grantee in ('anon', 'authenticated', 'service_role')
order by g.table_name, g.column_name, g.grantee, g.privilege_type;

select
  'target_triggers' as section,
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_catalog.pg_get_triggerdef(t.oid, true) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions',
    'company_members',
    'profiles',
    'user_permissions'
  )
order by c.relname, t.tgname;

with target_functions as (
  select
    p.oid,
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_catalog.pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer,
    p.proleakproof as leakproof,
    p.provolatile as volatility,
    p.proparallel as parallel_safety,
    p.proconfig as runtime_settings,
    pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
    p.proacl
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'financial_private')
    and p.proname in (
      'finance_review_list',
      'finance_review_history',
      'finance_review_decide',
      'finance_review_set_document_role',
      'finance_review_list_impl',
      'finance_review_history_impl',
      'finance_review_decide_impl',
      'finance_review_set_document_role_impl',
      'company_access_role',
      'company_can_decide_financial_review',
      'company_can_classify_financial_source',
      'is_admin'
    )
)
select
  'target_functions' as section,
  f.schema_name,
  f.function_name,
  f.identity_arguments,
  f.result_type,
  f.security_definer,
  f.leakproof,
  f.volatility,
  f.parallel_safety,
  f.runtime_settings,
  f.owner_name,
  has_function_privilege('anon', f.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', f.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', f.oid, 'EXECUTE') as service_role_can_execute
from target_functions f
order by f.schema_name, f.function_name, f.identity_arguments;

select
  'target_function_definitions' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'financial_private')
  and p.proname in (
    'finance_review_list',
    'finance_review_history',
    'finance_review_decide',
    'finance_review_set_document_role',
    'finance_review_list_impl',
    'finance_review_history_impl',
    'finance_review_decide_impl',
    'finance_review_set_document_role_impl',
    'company_access_role',
    'company_can_decide_financial_review',
    'company_can_classify_financial_source',
    'is_admin'
  )
order by n.nspname, p.proname, identity_arguments;

select
  'association_table_candidates' as section,
  c.table_schema,
  c.table_name,
  array_agg(c.column_name order by c.ordinal_position) as relevant_columns
from information_schema.columns c
where c.table_schema not in ('pg_catalog', 'information_schema')
  and c.column_name in (
    'company_id',
    'user_id',
    'owner_id',
    'member_id',
    'role',
    'can_view',
    'can_decide',
    'can_classify'
  )
group by c.table_schema, c.table_name
having bool_or(c.column_name = 'company_id')
   and bool_or(c.column_name in ('user_id', 'owner_id', 'member_id'))
order by c.table_schema, c.table_name;

SELECT
  'migration_history_check' AS section,
  CASE
    WHEN to_regclass(
      'supabase_migrations.schema_migrations'
    ) IS NULL
    THEN 'table_not_found'
    ELSE 'table_exists'
  END AS status;
