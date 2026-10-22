-- Etapa 07C.4: identificação somente leitura das quatro divergências.
-- Execute cada bloco separadamente. Não retorna valores financeiros, nomes de
-- pessoas, owner_id, notas de revisão ou conteúdo extraído.

-- Bloco 1: documentos e linhas atingidos pelo predicado exato do Bloco F.
select
  d.id as document_id,
  f.id as extraction_row_id,
  d.file_name,
  d.company_id as document_company_id,
  f.company_id as row_company_id,
  case
    when d.company_id is null then 'document_company_missing'
    when f.company_id is null then 'row_company_missing'
    else 'different_company_ids'
  end as divergence_type,
  f.review_status,
  f.sheet_name,
  f.source_row,
  d.file_name = 'TESTE_FINANCEIRO_KAWANA_2026-10.csv' as is_target_test_file
from public.financial_extracted_rows f
join public.documents d on d.id = f.document_id
where d.company_id is distinct from f.company_id
order by d.file_name, d.id, f.sheet_name, f.source_row, f.id;

-- Bloco 2: confirmação agregada do arquivo fictício, sem retornar outros nomes.
select
  count(*) as total_divergent_rows,
  count(*) filter (
    where d.file_name = 'TESTE_FINANCEIRO_KAWANA_2026-10.csv'
  ) as target_test_file_rows,
  count(distinct d.id) as affected_documents,
  count(distinct d.id) filter (
    where d.file_name = 'TESTE_FINANCEIRO_KAWANA_2026-10.csv'
  ) as target_test_file_documents
from public.financial_extracted_rows f
join public.documents d on d.id = f.document_id
where d.company_id is distinct from f.company_id;

-- Bloco 3: evidência ainda necessária para avaliar o search_path de is_admin().
select
  'public_schema_access' as section,
  pg_catalog.pg_get_userbyid(n.nspowner) as owner_name,
  role.rolname as role_name,
  has_schema_privilege(role.oid, n.oid, 'USAGE') as can_use,
  has_schema_privilege(role.oid, n.oid, 'CREATE') as can_create
from pg_catalog.pg_namespace n
cross join pg_catalog.pg_roles role
where n.nspname = 'public'
  and role.rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by role.rolname;

-- Bloco 4: corpos e ACLs das RPCs financeiras usadas pela automação/n8n.
-- A ausência de uma assinatura produz zero linhas, sem falhar.
select
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
  and p.proname in (
    'finance_claim_next_document',
    'finance_complete_document'
  )
order by p.proname, identity_arguments;
