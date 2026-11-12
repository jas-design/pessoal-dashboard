-- ETAPA 11E.5: postflight somente leitura do claim financeiro deterministico.
-- Nao chama RPCs e nao retorna ETag, valores financeiros ou dados pessoais.
begin transaction read only;

with
settings as (
  select
    '7aa10025-751f-4d8a-947d-5decf1e1dc2d'::uuid as pilot_document_id,
    '468978dd-6ffa-440e-9465-df966ba093ee'::uuid as pilot_company_id,
    date '2026-09-01' as pilot_period_month
),
function_state as (
  select p.*
  from (select 1) seed
  left join pg_catalog.pg_proc p on p.oid = to_regprocedure(
    'public.finance_claim_document_v2(uuid,uuid,text,date)'
  )
),
required_table_privileges(table_name, privilege_type, check_order) as (values
  ('companies', 'SELECT', 60),
  ('documents', 'SELECT', 61),
  ('financial_extraction_jobs', 'SELECT', 62),
  ('financial_extraction_jobs', 'INSERT', 63),
  ('financial_extraction_jobs', 'UPDATE', 64),
  ('financial_extracted_rows', 'SELECT', 65)
),
pilot_state as (
  select
    count(*) as document_count,
    count(*) filter (
      where d.company_id = s.pilot_company_id
        and d.source_etag is not null
        and length(d.source_etag) between 1 and 512
        and d.source_etag !~ '[[:cntrl:]]'
        and d.period_year = extract(year from s.pilot_period_month)::integer
        and d.period_month = extract(month from s.pilot_period_month)::integer
        and d.provider = 'onedrive'
        and d.is_deleted = false
        and d.processing_status = 'pending'
        and d.external_drive_id is not null
        and d.external_file_id is not null
        and d.file_size between 1 and 8388608
        and d.file_name ~* '\.xlsx$'
        and (
          d.source_path = '/drive/root:/Deskboard KPIs'
          or d.source_path like '/drive/root:/Deskboard KPIs/%'
        )
        and c.id = d.company_id
        and c.owner_id = d.owner_id
        and c.is_active = true
    ) as eligible_count
  from settings s
  left join public.documents d on d.id = s.pilot_document_id
  left join public.companies c on c.id = d.company_id
  group by s.pilot_company_id, s.pilot_period_month
),
pilot_job_state as (
  select count(j.document_id) as job_count
  from settings s
  left join public.financial_extraction_jobs j
    on j.document_id = s.pilot_document_id
),
pilot_fact_state as (
  select
    count(f.document_id) filter (where f.source_etag = d.source_etag)
      as current_etag_fact_count,
    count(f.document_id) as all_version_fact_count
  from settings s
  join public.documents d on d.id = s.pilot_document_id
  left join public.financial_extracted_rows f on f.document_id = d.id
),
preserved_data as (
  select
    (select count(*) from public.documents) as documents_count,
    (select count(*) from public.onedrive_folders) as folders_count,
    (select count(*) from public.financial_extracted_rows) as facts_count,
    (select count(*) from public.financial_extracted_rows
      where contract_version = 1
        and logical_key is null
        and source_cell is null) as preserved_v1_facts
),
checks as (
  select
    1 as check_order,
    'transaction.read_only'::text as check_name,
    case when current_setting('transaction_read_only') = 'on'
      then 'PASS' else 'FAIL' end as status,
    format('transaction_read_only=%s', current_setting('transaction_read_only'))
      as details

  union all

  select
    10,
    'rpc.finance_claim_document_v2.exists',
    case when p.oid is not null then 'PASS' else 'FAIL' end,
    case when p.oid is not null
      then 'assinatura exata presente' else 'RPC ausente' end
  from function_state p

  union all

  select
    11,
    'rpc.finance_claim_document_v2.owner',
    case when pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      then 'PASS' else 'FAIL' end,
    format('owner=%s', coalesce(pg_catalog.pg_get_userbyid(p.proowner), 'null'))
  from function_state p

  union all

  select
    12,
    'rpc.finance_claim_document_v2.security_invoker',
    case when p.oid is not null and p.prosecdef = false
      then 'PASS' else 'FAIL' end,
    format('security_invoker=%s', coalesce((not p.prosecdef)::text, 'null'))
  from function_state p

  union all

  select
    13,
    'rpc.finance_claim_document_v2.search_path',
    case when p.proconfig = array['search_path=public']
      then 'PASS' else 'FAIL' end,
    format('function_config=%s', coalesce(p.proconfig::text, 'null'))
  from function_state p

  union all

  select
    14,
    'rpc.finance_claim_document_v2.language_and_result',
    case
      when l.lanname = 'plpgsql'
       and pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
      then 'PASS' else 'FAIL'
    end,
    format(
      'language=%s; result=%s',
      coalesce(l.lanname, 'null'),
      coalesce(pg_catalog.pg_get_function_result(p.oid), 'null')
    )
  from function_state p
  left join pg_catalog.pg_language l on l.oid = p.prolang

  union all

  select
    15,
    'rpc.finance_claim_document_v2.arguments',
    case
      when p.pronargdefaults = 0
       and p.proargnames = array[
         'p_document_id', 'p_company_id', 'p_source_etag', 'p_period_month'
       ]::text[]
      then 'PASS' else 'FAIL'
    end,
    format(
      'default_argument_count=%s; arguments=%s',
      coalesce(p.pronargdefaults::text, 'null'),
      coalesce(pg_catalog.pg_get_function_arguments(p.oid), 'null')
    )
  from function_state p

  union all

  select
    16,
    'rpc.finance_claim_document_v2.execution_properties',
    case
      when p.provolatile = 'v'
       and p.proparallel = 'u'
       and p.proisstrict = false
      then 'PASS' else 'FAIL'
    end,
    format(
      'volatility=%s; parallel=%s; strict=%s',
      coalesce(p.provolatile::text, 'null'),
      coalesce(p.proparallel::text, 'null'),
      coalesce(p.proisstrict::text, 'null')
    )
  from function_state p

  union all

  select
    17,
    'rpc.finance_claim_document_v2.body_hash',
    case when md5(replace(p.prosrc, E'\r\n', E'\n')) =
      '80dd248b9912ccd126e43331bcae1117'
      then 'PASS' else 'FAIL' end,
    format(
      'body_md5_raw=%s; body_md5_lf=%s; expected_lf=80dd248b9912ccd126e43331bcae1117',
      md5(p.prosrc),
      md5(replace(p.prosrc, E'\r\n', E'\n'))
    )
  from function_state p

  union all

  select
    18,
    'rpc.finance_claim_document_v2.service_role_execute',
    case when coalesce(has_function_privilege(
      to_regrole('service_role'), p.oid, 'EXECUTE'
    ), false) then 'PASS' else 'FAIL' end,
    format(
      'service_role_execute=%s',
      coalesce(has_function_privilege(
        to_regrole('service_role'), p.oid, 'EXECUTE'
      )::text, 'false')
    )
  from function_state p

  union all

  select
    19,
    'rpc.finance_claim_document_v2.browser_execute_revoked',
    case
      when p.oid is not null
       and not has_function_privilege(to_regrole('anon'), p.oid, 'EXECUTE')
       and not has_function_privilege(
         to_regrole('authenticated'), p.oid, 'EXECUTE'
       )
       and not exists (
         select 1
         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
       )
      then 'PASS' else 'FAIL'
    end,
    format(
      'public=%s; anon=%s; authenticated=%s',
      case when p.oid is null then 'null' else exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      )::text end,
      coalesce(has_function_privilege(
        to_regrole('anon'), p.oid, 'EXECUTE'
      )::text, 'null'),
      coalesce(has_function_privilege(
        to_regrole('authenticated'), p.oid, 'EXECUTE'
      )::text, 'null')
    )
  from function_state p

  union all

  select
    20,
    'rpc.finance_claim_document_v2.acl_scope',
    case
      when p.oid is not null
       and not exists (
         select 1
         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where acl.privilege_type = 'EXECUTE'
           and acl.grantee not in (p.proowner, to_regrole('service_role'))
       )
       and not exists (
         select 1
         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where acl.privilege_type = 'EXECUTE'
           and acl.grantee = to_regrole('service_role')
           and acl.is_grantable
       )
      then 'PASS' else 'FAIL'
    end,
    'EXECUTE explicito limitado ao owner e service_role; sem grant option'
  from function_state p

  union all

  select
    30,
    'dependency.finance_complete_document_v2.exists',
    case when to_regprocedure(
      'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
    ) is not null then 'PASS' else 'FAIL' end,
    'persistence v2 deve permanecer instalada'

  union all

  select
    31,
    'dependency.gen_random_uuid.exists',
    case when to_regprocedure('gen_random_uuid()') is not null
      then 'PASS' else 'FAIL' end,
    'funcao necessaria para gerar claim_id'

  union all

  select
    32,
    'dependency.hashtextextended.exists',
    case when to_regprocedure('pg_catalog.hashtextextended(text,bigint)')
      is not null then 'PASS' else 'FAIL' end,
    'funcao necessaria para advisory lock deterministico'

  union all

  select
    33,
    'dependency.financial_extraction_jobs.document_id_unique',
    case when exists (
      select 1
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a
        on a.attrelid = i.indrelid and a.attname = 'document_id'
      where i.indrelid = to_regclass('public.financial_extraction_jobs')
        and i.indisunique and i.indisvalid
        and i.indpred is null and i.indexprs is null
        and i.indnkeyatts = 1 and i.indkey[0] = a.attnum
    ) then 'PASS' else 'FAIL' end,
    'chave unica valida para ON CONFLICT (document_id)'

  union all

  select
    40,
    'rls.financial_extraction_jobs.enabled',
    case when c.relrowsecurity then 'PASS' else 'FAIL' end,
    format(
      'enabled=%s; forced=%s',
      coalesce(c.relrowsecurity::text, 'null'),
      coalesce(c.relforcerowsecurity::text, 'null')
    )
  from (select 1) seed
  left join pg_catalog.pg_class c
    on c.oid = to_regclass('public.financial_extraction_jobs')

  union all

  select
    p.check_order,
    'grant.service_role.' || p.table_name || '.' || lower(p.privilege_type),
    case when has_table_privilege(
      to_regrole('service_role'),
      to_regclass(format('public.%I', p.table_name)),
      p.privilege_type
    ) then 'PASS' else 'FAIL' end,
    case when has_table_privilege(
      to_regrole('service_role'),
      to_regclass(format('public.%I', p.table_name)),
      p.privilege_type
    ) then 'privilegio efetivo presente'
      else 'privilegio ausente; RPC SECURITY INVOKER falhara' end
  from required_table_privileges p

  union all

  select
    80,
    'preservation.documents_count',
    case when documents_count = 5226 then 'PASS' else 'FAIL' end,
    format('documents_count=%s; expected=5226', documents_count)
  from preserved_data

  union all

  select
    81,
    'preservation.onedrive_folders_count',
    case when folders_count = 1188 then 'PASS' else 'FAIL' end,
    format('onedrive_folders_count=%s; expected=1188', folders_count)
  from preserved_data

  union all

  select
    82,
    'preservation.financial_facts',
    case when facts_count = 4 and preserved_v1_facts = 4
      then 'PASS' else 'FAIL' end,
    format(
      'facts_count=%s; preserved_v1_facts=%s; expected=4/4',
      facts_count, preserved_v1_facts
    )
  from preserved_data

  union all

  select
    90,
    'pilot.document.still_eligible',
    case when document_count = 1 and eligible_count = 1
      then 'PASS' else 'FAIL' end,
    format(
      'matching_documents=%s; eligible_documents=%s',
      document_count, eligible_count
    )
  from pilot_state

  union all

  select
    91,
    'pilot.claim_not_executed',
    case when job_count = 0 then 'PASS' else 'FAIL' end,
    format('pilot_job_count=%s; expected=0', job_count)
  from pilot_job_state

  union all

  select
    92,
    'pilot.facts.current_etag_still_absent',
    case when coalesce(current_etag_fact_count, 0) = 0
      then 'PASS' else 'FAIL' end,
    format(
      'target_current_etag_fact_count=%s',
      coalesce(current_etag_fact_count, 0)
    )
  from pilot_fact_state

  union all

  select
    93,
    'pilot.facts.all_versions_still_absent',
    case when coalesce(all_version_fact_count, 0) = 0
      then 'PASS' else 'FAIL' end,
    format(
      'target_all_version_fact_count=%s',
      coalesce(all_version_fact_count, 0)
    )
  from pilot_fact_state
)
select check_name, status, details
from checks
order by check_order, check_name;

rollback;
