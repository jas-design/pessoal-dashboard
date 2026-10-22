-- Etapa 07C.2: consultas pendentes, estritamente somente leitura.
-- Execute cada bloco separadamente e mantenha os CSVs fora do Git.

-- Bloco A: resultado pendente do Bloco 7 do preflight 07C.
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
      'financial_transactions'
    )
), target_roles as (
  select oid, rolname
  from pg_catalog.pg_roles
  where rolname in ('anon', 'authenticated', 'service_role')
)
select
  'effective_table_privileges' as section,
  table_object.schema_name,
  table_object.table_name,
  role.rolname as role_name,
  has_table_privilege(role.oid, table_object.oid, 'SELECT') as can_select,
  has_table_privilege(role.oid, table_object.oid, 'INSERT') as can_insert,
  has_table_privilege(role.oid, table_object.oid, 'UPDATE') as can_update,
  has_table_privilege(role.oid, table_object.oid, 'DELETE') as can_delete
from target_tables table_object
cross join target_roles role
order by table_object.table_name, role.rolname;

-- Bloco B: policies que podem manter acesso transversal.
select
  'cross_access_policies' as section,
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check,
  coalesce(p.qual, '') ilike '%is_admin%' as uses_is_admin,
  coalesce(p.with_check, '') ilike '%is_admin%' as check_uses_is_admin
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions'
  )
order by p.tablename, p.cmd, p.policyname;

-- Bloco C: funções que referenciam objetos financeiros ou is_admin().
-- Retorna indicadores, não os corpos completos das funções.
with function_sources as (
  select
    p.oid,
    n.nspname as schema_name,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef as security_definer,
    p.proconfig as runtime_settings,
    pg_catalog.pg_get_functiondef(p.oid) as definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'financial_private')
    and p.prokind in ('f', 'p')
)
select
  'cross_access_functions' as section,
  f.schema_name,
  f.proname,
  f.identity_arguments,
  f.owner_name,
  f.security_definer,
  f.runtime_settings,
  f.definition ilike '%is_admin(%' as references_is_admin,
  f.definition ilike '%public.companies%' as references_companies,
  f.definition ilike '%public.documents%' as references_documents,
  f.definition ilike '%public.financial_%' as references_financial_objects
from function_sources f
where f.definition ilike '%is_admin(%'
   or f.definition ilike '%public.companies%'
   or f.definition ilike '%public.documents%'
   or f.definition ilike '%public.financial_%'
order by f.schema_name, f.proname, f.identity_arguments;

-- Bloco D: colunas disponíveis para definir coerência empresa-documento-linha.
select
  'company_link_columns' as section,
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs'
  )
  and c.column_name in (
    'id',
    'owner_id',
    'company_id',
    'document_id',
    'job_id'
  )
order by c.table_name, c.ordinal_position;

-- Bloco E: constraints que já protegem esses vínculos.
select
  'company_link_constraints' as section,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs'
  )
order by c.relname, con.conname;

-- Bloco F: contagens de divergência, sem retornar identificadores ou valores.
select
  'company_link_readiness' as section,
  (
    select count(*)
    from public.financial_extracted_rows f
    join public.documents d on d.id = f.document_id
    where d.owner_id is distinct from f.owner_id
  ) as document_owner_mismatches,
  (
    select count(*)
    from public.financial_extracted_rows f
    join public.documents d on d.id = f.document_id
    where d.company_id is distinct from f.company_id
  ) as document_company_mismatches,
  (
    select count(*)
    from public.financial_extracted_rows f
    join public.companies c on c.id = f.company_id
    where c.owner_id is distinct from f.owner_id
  ) as company_owner_mismatches,
  (
    select count(*)
    from public.financial_extraction_jobs j
    join public.documents d on d.id = j.document_id
    where d.owner_id is distinct from j.owner_id
  ) as job_owner_mismatches;

-- Bloco G: owner e privilégios efetivos do schema privado.
select
  'financial_private_schema_access' as section,
  n.nspname as schema_name,
  pg_catalog.pg_get_userbyid(n.nspowner) as owner_name,
  role.rolname as role_name,
  has_schema_privilege(role.oid, n.oid, 'USAGE') as can_use,
  has_schema_privilege(role.oid, n.oid, 'CREATE') as can_create
from pg_catalog.pg_namespace n
cross join pg_catalog.pg_roles role
where n.nspname = 'financial_private'
  and role.rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by role.rolname;

-- Bloco H: definição e ACL efetiva de public.is_admin(), se existir.
-- A ausência da função produz zero linhas, sem falhar.
select
  'is_admin_definition' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as runtime_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_admin'
order by identity_arguments;
