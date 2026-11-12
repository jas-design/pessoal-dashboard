-- ETAPA 11E.3B: preflight consolidado e somente leitura para o Supabase KAWANA.
-- Retorna um unico result set exportavel como CSV. Nao chama RPCs e nao
-- retorna ETag, valores financeiros, credenciais ou dados pessoais.
begin transaction read only;

with
settings as (
  select
    '7aa10025-751f-4d8a-947d-5decf1e1dc2d'::uuid as pilot_document_id,
    '468978dd-6ffa-440e-9465-df966ba093ee'::uuid as pilot_company_id,
    date '2026-09-01' as pilot_period_month
),
required_roles(role_name, check_order) as (values
  ('anon', 10), ('authenticated', 11), ('service_role', 12)
),
required_tables(table_name, check_order) as (values
  ('companies', 20), ('documents', 21), ('onedrive_folders', 22),
  ('financial_extraction_jobs', 23), ('financial_extracted_rows', 24)
),
required_columns(table_name, column_name, expected_udt, check_order) as (values
  ('companies', 'id', 'uuid', 100),
  ('companies', 'owner_id', 'uuid', 101),
  ('companies', 'name', 'text', 102),
  ('companies', 'is_active', 'bool', 103),
  ('documents', 'id', 'uuid', 110),
  ('documents', 'owner_id', 'uuid', 111),
  ('documents', 'company_id', 'uuid', 112),
  ('documents', 'provider', 'text', 113),
  ('documents', 'is_deleted', 'bool', 114),
  ('documents', 'processing_status', 'text', 115),
  ('documents', 'file_name', 'text', 116),
  ('documents', 'file_size', 'int8', 117),
  ('documents', 'source_etag', 'text', 118),
  ('documents', 'external_drive_id', 'text', 119),
  ('documents', 'external_file_id', 'text', 120),
  ('documents', 'source_path', 'text', 121),
  ('documents', 'period_year', 'int4', 122),
  ('documents', 'period_month', 'int4', 123),
  ('financial_extraction_jobs', 'document_id', 'uuid', 130),
  ('financial_extraction_jobs', 'owner_id', 'uuid', 131),
  ('financial_extraction_jobs', 'source_etag', 'text', 132),
  ('financial_extraction_jobs', 'claim_id', 'uuid', 133),
  ('financial_extraction_jobs', 'status', 'text', 134),
  ('financial_extraction_jobs', 'attempts', 'int4', 135),
  ('financial_extraction_jobs', 'claimed_at', 'timestamptz', 136),
  ('financial_extraction_jobs', 'completed_at', 'timestamptz', 137),
  ('financial_extraction_jobs', 'records_extracted', 'int4', 138),
  ('financial_extraction_jobs', 'note', 'text', 139),
  ('financial_extraction_jobs', 'text_excerpt', 'text', 140),
  ('financial_extraction_jobs', 'updated_at', 'timestamptz', 141),
  ('financial_extracted_rows', 'owner_id', 'uuid', 150),
  ('financial_extracted_rows', 'document_id', 'uuid', 151),
  ('financial_extracted_rows', 'source_etag', 'text', 152),
  ('financial_extracted_rows', 'company_id', 'uuid', 153),
  ('financial_extracted_rows', 'source_company_name', 'text', 154),
  ('financial_extracted_rows', 'period_month', 'date', 155),
  ('financial_extracted_rows', 'metric', 'text', 156),
  ('financial_extracted_rows', 'amount', 'numeric', 157),
  ('financial_extracted_rows', 'currency', 'text', 158),
  ('financial_extracted_rows', 'sheet_name', 'text', 159),
  ('financial_extracted_rows', 'source_row', 'int4', 160),
  ('financial_extracted_rows', 'review_status', 'text', 161)
),
required_table_privileges(table_name, privilege_type, check_order) as (values
  ('companies', 'SELECT', 300),
  ('documents', 'SELECT', 301),
  ('financial_extraction_jobs', 'SELECT', 302),
  ('financial_extraction_jobs', 'INSERT', 303),
  ('financial_extraction_jobs', 'UPDATE', 304),
  ('financial_extracted_rows', 'SELECT', 305),
  ('financial_extracted_rows', 'INSERT', 306)
),
table_security as (
  select
    t.table_name, t.check_order, c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    count(p.policyname) as policy_count,
    count(p.policyname) filter (where p.cmd = 'SELECT') as select_policy_count,
    count(p.policyname) filter (where p.cmd = 'INSERT') as insert_policy_count,
    count(p.policyname) filter (where p.cmd = 'UPDATE') as update_policy_count
  from required_tables t
  left join pg_catalog.pg_namespace n on n.nspname = 'public'
  left join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = t.table_name
   and c.relkind in ('r', 'p')
  left join pg_catalog.pg_policies p
    on p.schemaname = 'public' and p.tablename = t.table_name
  group by t.table_name, t.check_order, c.relrowsecurity, c.relforcerowsecurity
),
constraint_inventory as (
  select
    t.table_name, t.check_order, count(c.oid) as constraint_count,
    count(c.oid) filter (where c.contype = 'p') as primary_key_count,
    count(c.oid) filter (where c.contype = 'u') as unique_count,
    count(c.oid) filter (where c.contype = 'f') as foreign_key_count,
    count(c.oid) filter (where c.contype = 'c') as check_count
  from required_tables t
  left join pg_catalog.pg_constraint c
    on c.conrelid = to_regclass(format('public.%I', t.table_name))
  group by t.table_name, t.check_order
),
trigger_inventory as (
  select t.table_name, t.check_order, count(tr.trigger_name) as trigger_count
  from required_tables t
  left join information_schema.triggers tr
    on tr.trigger_schema = 'public' and tr.event_object_table = t.table_name
  group by t.table_name, t.check_order
),
grant_inventory as (
  select
    t.table_name,
    count(g.privilege_type) filter (where g.grantee = 'anon') as anon_grants,
    count(g.privilege_type) filter (where g.grantee = 'authenticated')
      as authenticated_grants,
    count(g.privilege_type) filter (where g.grantee = 'service_role')
      as service_role_grants
  from required_tables t
  left join information_schema.role_table_grants g
    on g.table_schema = 'public'
   and g.table_name = t.table_name
   and g.grantee in ('anon', 'authenticated', 'service_role')
  group by t.table_name
),
pilot as (
  select
    count(*) filter (where d.id is not null) as document_count,
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
),
pilot_job as (
  select
    count(j.document_id) as job_count,
    count(j.document_id) filter (
      where j.source_etag is distinct from d.source_etag
         or (j.status = 'failed' and j.attempts < 3)
         or (
           j.status = 'processing'
           and j.claimed_at < now() - interval '30 minutes'
           and j.attempts < 3
         )
    ) as retryable_job_count
  from settings s
  join public.documents d on d.id = s.pilot_document_id
  left join public.financial_extraction_jobs j on j.document_id = d.id
),
pilot_fact_counts as (
  select
    count(f.document_id) filter (where f.source_etag = d.source_etag)
      as current_etag_fact_count,
    count(f.document_id) as all_version_fact_count
  from settings s
  join public.documents d on d.id = s.pilot_document_id
  left join public.financial_extracted_rows f on f.document_id = d.id
),
catalog_counts as (
  select
    (select count(*) from public.documents) as documents_count,
    (select count(*) from public.onedrive_folders) as onedrive_folder_count
),
legacy_facts as (
  select
    count(*) as existing_financial_rows,
    count(*) filter (
      where metric not in (
        'receita', 'despesa', 'revenue', 'expense', 'net_result', 'cash_available'
      )
    ) as unsupported_metric_rows,
    count(*) filter (where metric <> 'net_result' and amount < 0)
      as negative_non_net_result_rows
  from public.financial_extracted_rows
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
    r.check_order, 'role.' || r.role_name || '.exists',
    case when to_regrole(r.role_name) is not null then 'PASS' else 'FAIL' end,
    case when to_regrole(r.role_name) is not null
      then 'role presente' else 'role ausente' end
  from required_roles r

  union all

  select
    t.check_order, 'table.public.' || t.table_name || '.exists',
    case when to_regclass(format('public.%I', t.table_name)) is not null
      then 'PASS' else 'FAIL' end,
    case when to_regclass(format('public.%I', t.table_name)) is not null
      then 'tabela presente'
      else 'tabela ausente; migration v2 incompativel' end
  from required_tables t

  union all

  select
    c.check_order, 'column.public.' || c.table_name || '.' || c.column_name,
    case
      when a.column_name is null then 'FAIL'
      when a.udt_name <> c.expected_udt then 'FAIL'
      else 'PASS'
    end,
    case
      when a.column_name is null
        then format('ausente; tipo esperado=%s', c.expected_udt)
      else format(
        'tipo esperado=%s; tipo atual=%s; nullable=%s',
        c.expected_udt, a.udt_name, a.is_nullable
      )
    end
  from required_columns c
  left join information_schema.columns a
    on a.table_schema = 'public'
   and a.table_name = c.table_name
   and a.column_name = c.column_name

  union all

  select
    200 + row_number() over (order by v.column_name),
    'migration.persistence_v2.column_' || v.column_name || '_absent',
    case when a.column_name is null then 'PASS' else 'FAIL' end,
    case when a.column_name is null
      then 'ausente como esperado antes da migration v2'
      else format(
        'presente com tipo=%s; estado parcial ou migration ja aplicada',
        a.udt_name
      )
    end
  from (values ('logical_key'), ('source_cell'), ('contract_version')) v(column_name)
  left join information_schema.columns a
    on a.table_schema = 'public'
   and a.table_name = 'financial_extracted_rows'
   and a.column_name = v.column_name

  union all

  select
    210, 'migration.persistence_v2.index_absent',
    case when to_regclass(
      'public.financial_extracted_rows_v2_logical_identity_uidx'
    ) is null then 'PASS' else 'FAIL' end,
    case when to_regclass(
      'public.financial_extracted_rows_v2_logical_identity_uidx'
    ) is null then 'indice v2 ausente como esperado'
      else 'indice v2 presente; estado parcial ou migration ja aplicada' end

  union all

  select
    220, 'constraint.financial_extracted_rows_metric_check',
    case when c.oid is not null and c.contype = 'c' then 'PASS' else 'FAIL' end,
    coalesce(
      'check presente: ' || pg_catalog.pg_get_constraintdef(c.oid, true),
      'check ausente; DROP CONSTRAINT da migration falhara'
    )
  from (select 1) seed
  left join pg_catalog.pg_constraint c
    on c.conrelid = to_regclass('public.financial_extracted_rows')
   and c.conname = 'financial_extracted_rows_metric_check'

  union all

  select
    221, 'constraint.financial_extracted_rows_amount_check',
    case when c.oid is not null and c.contype = 'c' then 'PASS' else 'FAIL' end,
    coalesce(
      'check presente: ' || pg_catalog.pg_get_constraintdef(c.oid, true),
      'check ausente; DROP CONSTRAINT da migration falhara'
    )
  from (select 1) seed
  left join pg_catalog.pg_constraint c
    on c.conrelid = to_regclass('public.financial_extracted_rows')
   and c.conname = 'financial_extracted_rows_amount_check'

  union all

  select
    222, 'constraint.financial_extraction_jobs_document_id_unique',
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
    case when exists (
      select 1
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a
        on a.attrelid = i.indrelid and a.attname = 'document_id'
      where i.indrelid = to_regclass('public.financial_extraction_jobs')
        and i.indisunique and i.indisvalid
        and i.indpred is null and i.indexprs is null
        and i.indnkeyatts = 1 and i.indkey[0] = a.attnum
    ) then 'chave unica valida para ON CONFLICT (document_id)'
      else 'chave unica ausente; claim v2 incompativel' end

  union all

  select
    230 + i.check_order - 20, 'constraints.inventory.' || i.table_name,
    'INFO',
    format(
      'total=%s; pk=%s; unique=%s; fk=%s; checks=%s',
      i.constraint_count, i.primary_key_count, i.unique_count,
      i.foreign_key_count, i.check_count
    )
  from constraint_inventory i

  union all

  select
    250 + s.check_order - 20, 'rls.public.' || s.table_name,
    case when s.rls_enabled then 'PASS' else 'FAIL' end,
    format(
      'enabled=%s; forced=%s',
      coalesce(s.rls_enabled::text, 'null'),
      coalesce(s.rls_forced::text, 'null')
    )
  from table_security s

  union all

  select
    260 + s.check_order - 20, 'policies.inventory.' || s.table_name, 'INFO',
    format(
      'total=%s; select=%s; insert=%s; update=%s',
      s.policy_count, s.select_policy_count, s.insert_policy_count,
      s.update_policy_count
    )
  from table_security s

  union all

  select
    270 + t.check_order - 20, 'triggers.inventory.' || t.table_name, 'INFO',
    format('total=%s', t.trigger_count)
  from trigger_inventory t

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
      else 'privilegio efetivo ausente; RPC SECURITY INVOKER falhara' end
  from required_table_privileges p

  union all

  select
    320 + t.check_order - 20, 'grants.inventory.' || t.table_name, 'INFO',
    format(
      'anon=%s; authenticated=%s; service_role=%s',
      g.anon_grants, g.authenticated_grants, g.service_role_grants
    )
  from required_tables t
  join grant_inventory g on g.table_name = t.table_name

  union all

  select
    400, 'dependency.function.gen_random_uuid',
    case when to_regprocedure('gen_random_uuid()') is not null
      then 'PASS' else 'FAIL' end,
    case when to_regprocedure('gen_random_uuid()') is not null
      then 'dependencia presente' else 'dependencia ausente' end

  union all

  select
    401, 'dependency.function.hashtextextended',
    case when to_regprocedure(
      'pg_catalog.hashtextextended(text,bigint)'
    ) is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure(
      'pg_catalog.hashtextextended(text,bigint)'
    ) is not null then 'dependencia presente' else 'dependencia ausente' end

  union all

  select
    410, 'rpc.finance_complete_document_v1.exists',
    case when p.oid is not null then 'PASS' else 'FAIL' end,
    case when p.oid is null
      then 'RPC v1 ausente; persistence v2 incompativel'
      else format(
        'presente; security_invoker=%s; owner=%s; public_execute=%s; anon_execute=%s; authenticated_execute=%s; service_role_execute=%s',
        (not p.prosecdef)::text,
        pg_catalog.pg_get_userbyid(p.proowner),
        exists (
          select 1
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        )::text,
        has_function_privilege(to_regrole('anon'), p.oid, 'EXECUTE')::text,
        has_function_privilege(
          to_regrole('authenticated'), p.oid, 'EXECUTE'
        )::text,
        has_function_privilege(
          to_regrole('service_role'), p.oid, 'EXECUTE'
        )::text
      )
    end
  from (select to_regprocedure(
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ) as oid) wanted
  left join pg_catalog.pg_proc p on p.oid = wanted.oid

  union all

  select
    411, 'rpc.finance_complete_document_v2.absent',
    case when to_regprocedure(
      'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
    ) is null then 'PASS' else 'FAIL' end,
    case when to_regprocedure(
      'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
    ) is null then 'ausente como esperado antes da migration'
      else 'presente; estado parcial ou migration ja aplicada' end

  union all

  select
    412, 'rpc.finance_claim_document_v2.absent',
    case when to_regprocedure(
      'public.finance_claim_document_v2(uuid,uuid,text,date)'
    ) is null then 'PASS' else 'FAIL' end,
    case when to_regprocedure(
      'public.finance_claim_document_v2(uuid,uuid,text,date)'
    ) is null then 'ausente como esperado antes da migration'
      else 'presente; estado parcial ou migration ja aplicada' end

  union all

  select
    500, 'legacy_facts.unsupported_metrics',
    case when unsupported_metric_rows = 0 then 'PASS' else 'FAIL' end,
    format('incompatible_rows=%s', unsupported_metric_rows)
  from legacy_facts

  union all

  select
    501, 'legacy_facts.negative_non_net_result',
    case when negative_non_net_result_rows = 0 then 'PASS' else 'FAIL' end,
    format('incompatible_rows=%s', negative_non_net_result_rows)
  from legacy_facts

  union all

  select
    502, 'legacy_facts.total', 'INFO',
    format('existing_financial_rows=%s', existing_financial_rows)
  from legacy_facts

  union all

  select
    600, 'pilot.document.exists_once',
    case when document_count = 1 then 'PASS' else 'FAIL' end,
    format('matching_documents=%s', document_count)
  from pilot

  union all

  select
    601, 'pilot.document.claim_v2_eligible',
    case when document_count = 1 and eligible_count = 1
      then 'PASS' else 'FAIL' end,
    format(
      'eligible_documents=%s; criteria=company,owner,active,etag,period,onedrive,pending,not_deleted,external_ids,xlsx,size,path',
      eligible_count
    )
  from pilot

  union all

  select
    602, 'pilot.job.claim_state_eligible',
    case when job_count = 0 or retryable_job_count = job_count
      then 'PASS' else 'FAIL' end,
    format(
      'existing_jobs=%s; retryable_jobs=%s', job_count, retryable_job_count
    )
  from pilot_job

  union all

  select
    603, 'pilot.facts.current_etag_absent',
    case when current_etag_fact_count = 0 then 'PASS' else 'FAIL' end,
    format('target_current_etag_fact_count=%s', current_etag_fact_count)
  from pilot_fact_counts

  union all

  select
    604, 'pilot.facts.all_versions_absent',
    case when all_version_fact_count = 0 then 'PASS' else 'FAIL' end,
    format('target_all_version_fact_count=%s', all_version_fact_count)
  from pilot_fact_counts

  union all

  select
    700, 'baseline.documents_count', 'INFO',
    format('documents_count=%s', documents_count)
  from catalog_counts

  union all

  select
    701, 'baseline.onedrive_folder_count', 'INFO',
    format('onedrive_folder_count=%s', onedrive_folder_count)
  from catalog_counts
)
select check_name, status, details
from checks
order by check_order, check_name;

rollback;
