-- Etapa 07C.13A: auditoria futura, estritamente somente leitura.
-- NAO EXECUTADO em producao nesta etapa.
-- Execute no SQL Editor como um unico script e exporte cada result set.
-- Nao chama RPCs nem funcoes da aplicacao: consulta somente catalogos e
-- agregados sem dados pessoais ou valores financeiros.

begin transaction read only;

-- Bloco 1: contexto. O operador deve confirmar o projeto KAWANA antes de seguir.
select
  'database_context' as section,
  current_database() as database_name,
  current_user as execution_role,
  current_setting('server_version') as server_version,
  current_setting('transaction_read_only') as transaction_read_only;

-- Bloco 2: roles e schemas exigidos.
select
  'required_roles' as section,
  required.role_name,
  r.oid is not null as object_exists
from (values ('anon'), ('authenticated'), ('service_role'), ('postgres'))
  required(role_name)
left join pg_catalog.pg_roles r on r.rolname = required.role_name
order by required.role_name;

select
  'required_schemas' as section,
  required.schema_name,
  n.oid is not null as object_exists,
  pg_catalog.pg_get_userbyid(n.nspowner) as owner_name
from (values ('auth'), ('public'), ('financial_private'))
  required(schema_name)
left join pg_catalog.pg_namespace n on n.nspname = required.schema_name
order by required.schema_name;

-- Bloco 3: existencia, owner e RLS das relacoes usadas pelas sete migrations.
with required(object_name) as (values
  ('activities'), ('api_connections'), ('audit_logs'),
  ('automation_daily_stats'), ('automation_logs'), ('companies'),
  ('company_members'), ('dashboard_metrics'), ('dashboard_widgets'),
  ('documents'), ('financial_extracted_rows'), ('financial_extraction_jobs'),
  ('financial_review_audit'), ('financial_review_document_policy'),
  ('integrations'), ('notifications'), ('profiles'), ('system_health'),
  ('user_permissions'), ('user_preferences'), ('webhooks'),
  ('widget_preferences')
)
select
  'required_relations' as section,
  required.object_name,
  c.oid is not null as object_exists,
  case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table'
    when 'v' then 'view' when 'm' then 'materialized_view'
    else c.relkind::text end as object_type,
  pg_catalog.pg_get_userbyid(c.relowner) as owner_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from required
left join pg_catalog.pg_class c
  on c.relname = required.object_name
 and c.relnamespace = to_regnamespace('public')
order by required.object_name;

-- Bloco 4: contrato de profiles, sem IDs, nomes ou e-mails.
select
  'profiles_columns' as section,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'profiles'
  and c.column_name in ('id', 'email', 'full_name', 'avatar_url', 'role', 'status')
order by c.ordinal_position;

select
  'profiles_constraints' as section,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
where con.conrelid = to_regclass('public.profiles')
order by con.conname;

select
  'profiles_role_status_counts' as section,
  role,
  status,
  count(*) as profile_count
from public.profiles
group by role, status
order by role, status;

select
  'profiles_incompatible_values' as section,
  count(*) filter (where role not in ('admin', 'user')) as unsupported_roles,
  count(*) filter (where status not in ('active', 'inactive')) as unsupported_statuses,
  count(*) filter (where role = 'admin' and status = 'active') as active_admins
from public.profiles;

-- Bloco 5: constraints relevantes e a chave primaria da policy por documento.
select
  'target_constraints' as section,
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'companies', 'documents', 'financial_extracted_rows',
    'financial_extraction_jobs', 'financial_review_audit',
    'financial_review_document_policy', 'profiles'
  )
order by c.relname, con.conname;

-- Bloco 6: policies atuais, incluindo os bypasses via is_admin().
select
  'target_policies' as section,
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
    'activities', 'api_connections', 'audit_logs', 'automation_daily_stats',
    'automation_logs', 'companies', 'company_members', 'dashboard_metrics',
    'dashboard_widgets', 'documents', 'financial_extracted_rows',
    'financial_extraction_jobs', 'financial_review_audit',
    'financial_review_document_policy', 'integrations', 'notifications',
    'profiles', 'system_health', 'user_permissions', 'user_preferences',
    'webhooks', 'widget_preferences'
  )
order by p.tablename, p.cmd, p.policyname;

-- Bloco 7: privilegios efetivos das tabelas endurecidas manualmente/versionadas.
with target_tables as (
  select c.oid, c.relname
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and c.relname in (
      'activities', 'api_connections', 'audit_logs', 'automation_daily_stats',
      'automation_logs', 'dashboard_metrics', 'dashboard_widgets',
      'integrations', 'notifications', 'profiles', 'system_health',
      'user_preferences', 'webhooks', 'widget_preferences'
    )
), target_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
)
select
  'effective_table_privileges' as section,
  t.relname as table_name,
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
order by t.relname, r.role_name;

-- Bloco 8: funcoes esperadas. O hash permite comparar corpos sem exporta-los.
with target_functions as (
  select p.oid, n.nspname, p.proname, p.proowner, p.prosecdef, p.proconfig
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'financial_private')
    and p.proname in (
      'can_access_module', 'company_access_role',
      'company_can_view_financial_review',
      'company_can_decide_financial_review',
      'company_can_classify_financial_source', 'current_user_role',
      'finance_claim_next_document', 'finance_complete_document',
      'finance_review_list', 'finance_review_history',
      'finance_review_decide', 'finance_review_set_document_role',
      'finance_review_list_impl', 'finance_review_history_impl',
      'finance_review_decide_impl', 'finance_review_set_document_role_impl',
      'is_admin'
    )
)
select
  'target_functions' as section,
  f.nspname as schema_name,
  f.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(f.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(f.proowner) as owner_name,
  f.prosecdef as security_definer,
  f.proconfig as runtime_settings,
  md5(pg_catalog.pg_get_functiondef(f.oid)) as definition_md5,
  has_function_privilege('anon', f.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', f.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', f.oid, 'EXECUTE') as service_role_can_execute
from target_functions f
order by f.nspname, f.proname, identity_arguments;

-- Bloco 9: schema privado e ownership de objetos da aplicacao.
select
  'financial_private_access' as section,
  pg_catalog.pg_get_userbyid(n.nspowner) as owner_name,
  r.rolname as role_name,
  has_schema_privilege(r.oid, n.oid, 'USAGE') as can_use,
  has_schema_privilege(r.oid, n.oid, 'CREATE') as can_create
from pg_catalog.pg_namespace n
cross join pg_catalog.pg_roles r
where n.nspname = 'financial_private'
  and r.rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by r.rolname;

select
  'supabase_admin_owned_application_objects' as section,
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind as object_kind
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'financial_private')
  and pg_catalog.pg_get_userbyid(c.relowner) = 'supabase_admin'
order by n.nspname, c.relname;

-- Bloco 10: defaults. PUBLIC aparece como grantee_oid = 0.
select
  'default_privileges' as section,
  pg_catalog.pg_get_userbyid(d.defaclrole) as owner_name,
  coalesce(n.nspname, '<global>') as schema_name,
  d.defaclobjtype as object_type,
  coalesce(grantee.rolname, 'PUBLIC') as grantee_name,
  acl.privilege_type,
  acl.is_grantable
from pg_catalog.pg_default_acl d
left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
where pg_catalog.pg_get_userbyid(d.defaclrole) in ('postgres', 'supabase_admin')
order by owner_name, schema_name, object_type, grantee_name, acl.privilege_type;

-- Bloco 11: readiness dos dados, sem IDs ou valores financeiros.
select
  'financial_company_readiness' as section,
  (select count(*) from public.financial_extracted_rows f
    join public.documents d on d.id = f.document_id
    where d.owner_id is distinct from f.owner_id) as document_owner_mismatches,
  (select count(*) from public.financial_extracted_rows f
    join public.documents d on d.id = f.document_id
    where d.company_id is distinct from f.company_id) as document_company_mismatches,
  (select count(*) from public.financial_extracted_rows f
    join public.companies c on c.id = f.company_id
    where c.owner_id is distinct from f.owner_id) as company_owner_mismatches,
  (select count(*) from public.financial_extraction_jobs j
    join public.documents d on d.id = j.document_id
    where d.owner_id is distinct from j.owner_id) as job_owner_mismatches;

-- Bloco 12: historico local do Supabase CLI. A ausencia e resultado valido.
select
  'migration_history' as section,
  to_regclass('supabase_migrations.schema_migrations') is not null as history_exists;

rollback;
