-- Etapa 07C: preflight somente leitura.
-- Execute no SQL Editor e preserve a saída em local restrito.
-- Este arquivo não cria, altera ou remove objetos e não retorna valores financeiros.
-- Cada SELECT é independente e pode ser exportado como CSV.
-- ATENÇÃO: defaults, policies, triggers, ACLs e corpos de funções podem conter
-- URLs, identificadores internos ou segredos legados. Revise e redija esses
-- campos antes de compartilhar qualquer CSV fora do ambiente autorizado.

-- Bloco 1: papéis esperados. Papéis ausentes são informados sem causar erro.
with target_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
)
select
  'required_roles' as section,
  target.role_name,
  role.oid is not null as role_exists
from target_roles target
left join pg_catalog.pg_roles role on role.rolname = target.role_name
order by target.role_name;

-- Bloco 2: schemas esperados. Schemas ausentes são informados sem causar erro.
with target_schemas(schema_name) as (
  values ('auth'), ('financial_private'), ('public')
)
select
  'required_schemas' as section,
  target.schema_name,
  schema.oid is not null as schema_exists,
  pg_catalog.pg_get_userbyid(schema.nspowner) as owner_name,
  schema.nspacl
from target_schemas target
left join pg_catalog.pg_namespace schema on schema.nspname = target.schema_name
order by target.schema_name;

-- Bloco 3: relações exigidas pelas migrations.
select
  'required_relations' as section,
  target.object_name,
  to_regclass(target.object_name) is not null as object_exists
from (values
  ('auth.users'),
  ('public.companies'),
  ('public.company_members'),
  ('public.documents'),
  ('public.financial_extracted_rows'),
  ('public.financial_extraction_jobs'),
  ('public.financial_review_audit'),
  ('public.financial_review_document_policy'),
  ('public.financial_transactions')
) as target(object_name)
order by target.object_name;

-- Bloco 4: colunas reais. Catálogo seguro mesmo quando uma tabela não existe.
select
  'required_columns' as section,
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where (
    c.table_schema = 'public'
    and c.table_name in (
      'companies',
      'documents',
      'financial_extracted_rows',
      'financial_extraction_jobs',
      'financial_review_audit',
      'financial_review_document_policy',
      'financial_transactions'
    )
  )
  or (
    c.table_schema = 'auth'
    and c.table_name = 'users'
    and c.column_name = 'id'
  )
order by c.table_schema, c.table_name, c.ordinal_position;

-- Bloco 5: todas as policies relevantes, inclusive tabelas internas sem policy.
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
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions'
  )
order by p.tablename, p.cmd, p.policyname;

-- Bloco 6: RLS, owner e ACL bruta das tabelas existentes.
select
  'target_table_security' as section,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_catalog.pg_get_userbyid(c.relowner) as owner_name,
  c.relacl
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions'
  )
order by c.relname;

-- Bloco 7: privilégios efetivos. Papéis ou tabelas ausentes geram zero linhas.
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

-- Bloco 8: constraints necessárias para FKs e ON CONFLICT.
select
  'target_constraints' as section,
  c.relname as table_name,
  con.conname,
  con.contype,
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
    'financial_transactions'
  )
order by c.relname, con.conname;

-- Bloco 9: índices reais.
select
  'target_indexes' as section,
  i.tablename,
  i.indexname,
  i.indexdef
from pg_catalog.pg_indexes i
where i.schemaname = 'public'
  and i.tablename in (
    'companies',
    'documents',
    'financial_extracted_rows',
    'financial_extraction_jobs',
    'financial_review_audit',
    'financial_review_document_policy',
    'financial_transactions'
  )
order by i.tablename, i.indexname;

-- Bloco 10: triggers reais. A definição deve ser revisada antes de compartilhar.
select
  'target_triggers' as section,
  c.relname as table_name,
  t.tgname,
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
    'financial_transactions'
  )
order by c.relname, t.tgname;

-- Bloco 11: privilégios efetivos do schema privado.
with target_roles as (
  select oid, rolname
  from pg_catalog.pg_roles
  where rolname in ('anon', 'authenticated', 'service_role')
)
select
  'financial_private_schema' as section,
  role.rolname as role_name,
  pg_catalog.pg_get_userbyid(n.nspowner) as owner_name,
  n.nspacl,
  has_schema_privilege(role.oid, n.oid, 'USAGE') as has_usage
from pg_catalog.pg_namespace n
cross join target_roles role
where n.nspname = 'financial_private';

-- Bloco 12: todas as funções do schema privado e seus privilégios efetivos.
with target_roles as (
  select oid, rolname
  from pg_catalog.pg_roles
  where rolname in ('anon', 'authenticated', 'service_role')
)
select
  'financial_private_contents' as section,
  role.rolname as role_name,
  p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as runtime_settings,
  p.proacl,
  has_function_privilege(role.oid, p.oid, 'EXECUTE') as can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join target_roles role
where n.nspname = 'financial_private'
order by p.proname, identity_arguments, role.rolname;

-- Bloco 13: assinaturas obrigatórias. Funções ausentes não causam erro.
select
  'required_functions' as section,
  target.function_signature,
  to_regprocedure(target.function_signature) is not null as function_exists
from (values
  ('auth.uid()'),
  ('public.company_access_role(uuid)'),
  ('public.company_can_view_financial_review(uuid)'),
  ('public.company_can_decide_financial_review(uuid)'),
  ('public.company_can_classify_financial_source(uuid)'),
  ('public.finance_review_list(text,integer,integer)'),
  ('public.finance_review_history(uuid,integer)'),
  ('public.finance_review_decide(uuid,text,text,integer)'),
  ('public.finance_review_set_document_role(uuid,text,text)'),
  ('financial_private.finance_review_list_impl(text,integer,integer)'),
  ('financial_private.finance_review_history_impl(uuid,integer)'),
  ('financial_private.finance_review_decide_impl(uuid,text,text,integer)'),
  ('financial_private.finance_review_set_document_role_impl(uuid,text,text)')
) as target(function_signature)
order by target.function_signature;

-- Bloco 14: DDL das funções alvo. Pode conter segredos legados; não compartilhe
-- o CSV sem revisar/redigir integralmente a coluna definition.
select
  'target_function_definitions' as section,
  n.nspname as schema_name,
  p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as runtime_settings,
  p.proacl,
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
    'company_can_view_financial_review',
    'company_can_decide_financial_review',
    'company_can_classify_financial_source'
  )
order by n.nspname, p.proname, identity_arguments;

-- Bloco 15: presença do histórico. Não referencia a tabela sabidamente ausente.
select
  'migration_history_check' as section,
  to_regclass('supabase_migrations.schema_migrations') is not null as table_exists;
