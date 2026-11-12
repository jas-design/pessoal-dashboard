-- ETAPA 11E.4: postflight consolidado e somente leitura depois de aplicar
-- exclusivamente 20261028120000_financial_extraction_persistence_v2.sql.
-- Nao chama RPCs e nao retorna ETag, valores financeiros ou dados pessoais.
begin transaction read only;

with
expected_columns(column_name, expected_udt, expected_nullable, expected_default, check_order) as (values
  ('logical_key', 'text', 'YES', null::text, 10),
  ('source_cell', 'text', 'YES', null::text, 11),
  ('contract_version', 'int2', 'NO', '1', 12)
),
expected_constraints(constraint_name, expected_definition, check_order) as (values
  (
    'financial_extracted_rows_metric_check',
    'CHECK (metric = ANY (ARRAY[''receita''::text, ''despesa''::text, ''revenue''::text, ''expense''::text, ''net_result''::text, ''cash_available''::text]))',
    20
  ),
  (
    'financial_extracted_rows_amount_check',
    'CHECK (metric = ''net_result''::text OR amount >= 0::numeric)',
    21
  ),
  (
    'financial_extracted_rows_logical_key_check',
    'CHECK (logical_key IS NULL OR length(logical_key) >= 1 AND length(logical_key) <= 700 AND logical_key = btrim(logical_key) AND logical_key !~ ''[[:cntrl:]]''::text)',
    22
  ),
  (
    'financial_extracted_rows_source_cell_check',
    'CHECK (source_cell IS NULL OR source_cell ~ ''^[A-Z]{1,3}[1-9][0-9]*$''::text)',
    23
  ),
  (
    'financial_extracted_rows_contract_version_check',
    'CHECK (contract_version = ANY (ARRAY[1, 2]))',
    24
  ),
  (
    'financial_extracted_rows_v2_provenance_check',
    'CHECK (contract_version <> 2 OR logical_key IS NOT NULL AND source_cell IS NOT NULL AND (metric = ANY (ARRAY[''revenue''::text, ''expense''::text, ''net_result''::text, ''cash_available''::text])))',
    25
  )
),
expected_rls(table_name, check_order) as (values
  ('companies', 60),
  ('documents', 61),
  ('onedrive_folders', 62),
  ('financial_extraction_jobs', 63),
  ('financial_extracted_rows', 64)
),
required_table_privileges(table_name, privilege_type, check_order) as (values
  ('companies', 'SELECT', 80),
  ('documents', 'SELECT', 81),
  ('financial_extraction_jobs', 'SELECT', 82),
  ('financial_extraction_jobs', 'INSERT', 83),
  ('financial_extraction_jobs', 'UPDATE', 84),
  ('financial_extracted_rows', 'SELECT', 85),
  ('financial_extracted_rows', 'INSERT', 86)
),
function_state as (
  select p.*
  from pg_catalog.pg_proc p
  where p.oid = to_regprocedure(
    'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
  )
),
legacy_state as (
  select
    count(*) as all_financial_rows,
    count(*) filter (where contract_version = 1) as legacy_v1_rows,
    count(*) filter (where contract_version = 2) as v2_rows,
    count(*) filter (
      where contract_version = 1
        and (logical_key is not null or source_cell is not null)
    ) as legacy_rows_unexpectedly_changed
  from public.financial_extracted_rows
),
catalog_state as (
  select
    (select count(*) from public.documents) as documents_count,
    (select count(*) from public.onedrive_folders) as onedrive_folder_count
),
pilot_fact_state as (
  select
    count(f.document_id) filter (where f.source_etag = d.source_etag)
      as current_etag_fact_count,
    count(f.document_id) as all_version_fact_count
  from public.documents d
  left join public.financial_extracted_rows f on f.document_id = d.id
  where d.id = '7aa10025-751f-4d8a-947d-5decf1e1dc2d'::uuid
),
pilot_document_state as (
  select count(*) as pilot_document_count
  from public.documents
  where id = '7aa10025-751f-4d8a-947d-5decf1e1dc2d'::uuid
),
policy_inventory as (
  select
    r.table_name,
    r.check_order,
    count(p.policyname) as policy_count,
    count(p.policyname) filter (where p.cmd = 'SELECT') as select_count,
    count(p.policyname) filter (where p.cmd = 'INSERT') as insert_count,
    count(p.policyname) filter (where p.cmd = 'UPDATE') as update_count,
    count(p.policyname) filter (where p.cmd = 'DELETE') as delete_count
  from expected_rls r
  left join pg_catalog.pg_policies p
    on p.schemaname = 'public'
   and p.tablename = r.table_name
  group by r.table_name, r.check_order
),
grant_inventory as (
  select
    r.table_name,
    r.check_order,
    count(g.privilege_type) filter (where g.grantee = 'anon') as anon_grants,
    count(g.privilege_type) filter (where g.grantee = 'authenticated')
      as authenticated_grants,
    count(g.privilege_type) filter (where g.grantee = 'service_role')
      as service_role_grants
  from expected_rls r
  left join information_schema.role_table_grants g
    on g.table_schema = 'public'
   and g.table_name = r.table_name
   and g.grantee in ('anon', 'authenticated', 'service_role')
  group by r.table_name, r.check_order
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
    e.check_order,
    'column.financial_extracted_rows.' || e.column_name,
    case
      when c.column_name is null then 'FAIL'
      when c.udt_name <> e.expected_udt then 'FAIL'
      when c.is_nullable <> e.expected_nullable then 'FAIL'
      when c.column_default is distinct from e.expected_default then 'FAIL'
      else 'PASS'
    end,
    case
      when c.column_name is null
        then 'coluna ausente'
      else format(
        'type=%s; nullable=%s; default=%s',
        c.udt_name,
        c.is_nullable,
        coalesce(c.column_default, 'null')
      )
    end
  from expected_columns e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'financial_extracted_rows'
   and c.column_name = e.column_name

  union all

  select
    e.check_order,
    'constraint.' || e.constraint_name,
    case
      when c.oid is null then 'FAIL'
      when regexp_replace(
        pg_catalog.pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'
      ) = e.expected_definition then 'PASS'
      else 'FAIL'
    end,
    case
      when c.oid is null then 'constraint ausente'
      else pg_catalog.pg_get_constraintdef(c.oid, true)
    end
  from expected_constraints e
  left join pg_catalog.pg_constraint c
    on c.conrelid = to_regclass('public.financial_extracted_rows')
   and c.conname = e.constraint_name
   and c.contype = 'c'

  union all

  select
    30,
    'index.financial_extracted_rows_v2_logical_identity_uidx',
    case when regexp_replace(i.indexdef, '\s+', ' ', 'g') =
      'CREATE UNIQUE INDEX financial_extracted_rows_v2_logical_identity_uidx ON public.financial_extracted_rows USING btree (document_id, source_etag, logical_key) WHERE (logical_key IS NOT NULL)'
      then 'PASS' else 'FAIL' end,
    coalesce(i.indexdef, 'indice ausente')
  from (select 1) seed
  left join pg_catalog.pg_indexes i
    on i.schemaname = 'public'
   and i.tablename = 'financial_extracted_rows'
   and i.indexname = 'financial_extracted_rows_v2_logical_identity_uidx'

  union all

  select
    40,
    'rpc.finance_complete_document_v2.exists',
    case when exists (select 1 from function_state) then 'PASS' else 'FAIL' end,
    case when exists (select 1 from function_state)
      then 'assinatura exata presente' else 'RPC ausente' end

  union all

  select
    41,
    'rpc.finance_complete_document_v2.owner',
    case when pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      then 'PASS' else 'FAIL' end,
    format('owner=%s', pg_catalog.pg_get_userbyid(p.proowner))
  from function_state p

  union all

  select
    42,
    'rpc.finance_complete_document_v2.security_invoker',
    case when p.prosecdef = false then 'PASS' else 'FAIL' end,
    format('security_invoker=%s', (not p.prosecdef)::text)
  from function_state p

  union all

  select
    43,
    'rpc.finance_complete_document_v2.search_path',
    case when p.proconfig = array['search_path=public']
      then 'PASS' else 'FAIL' end,
    format('function_config=%s', coalesce(p.proconfig::text, 'null'))
  from function_state p

  union all

  select
    44,
    'rpc.finance_complete_document_v2.language_and_result',
    case
      when l.lanname = 'plpgsql'
       and pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
      then 'PASS' else 'FAIL'
    end,
    format(
      'language=%s; result=%s',
      l.lanname,
      pg_catalog.pg_get_function_result(p.oid)
    )
  from function_state p
  join pg_catalog.pg_language l on l.oid = p.prolang

  union all

  select
    45,
    'rpc.finance_complete_document_v2.arguments_and_defaults',
    case when p.pronargdefaults = 3 then 'PASS' else 'FAIL' end,
    format(
      'default_argument_count=%s; arguments=%s',
      p.pronargdefaults,
      pg_catalog.pg_get_function_arguments(p.oid)
    )
  from function_state p

  union all

  select
    46,
    'rpc.finance_complete_document_v2.body_hash',
    case when md5(replace(p.prosrc, E'\r\n', E'\n')) =
      '311c29c2e770eb83ed1fd330b7a92bcf'
      then 'PASS' else 'FAIL' end,
    format(
      'body_md5_raw=%s; body_md5_lf=%s; expected_lf=311c29c2e770eb83ed1fd330b7a92bcf',
      md5(p.prosrc),
      md5(replace(p.prosrc, E'\r\n', E'\n'))
    )
  from function_state p

  union all

  select
    47,
    'rpc.finance_complete_document_v2.service_role_execute',
    case when has_function_privilege(
      to_regrole('service_role'), p.oid, 'EXECUTE'
    ) then 'PASS' else 'FAIL' end,
    format(
      'service_role_execute=%s',
      has_function_privilege(
        to_regrole('service_role'), p.oid, 'EXECUTE'
      )::text
    )
  from function_state p

  union all

  select
    48,
    'rpc.finance_complete_document_v2.browser_execute_revoked',
    case
      when not has_function_privilege(to_regrole('anon'), p.oid, 'EXECUTE')
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
      exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      )::text,
      has_function_privilege(to_regrole('anon'), p.oid, 'EXECUTE')::text,
      has_function_privilege(
        to_regrole('authenticated'), p.oid, 'EXECUTE'
      )::text
    )
  from function_state p

  union all

  select
    50,
    'rpc.finance_complete_document_v1.preserved',
    case when to_regprocedure(
      'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
    ) is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure(
      'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
    ) is not null then 'RPC v1 presente' else 'RPC v1 ausente' end

  union all

  select
    51,
    'rpc.finance_claim_document_v2.still_absent',
    case when to_regprocedure(
      'public.finance_claim_document_v2(uuid,uuid,text,date)'
    ) is null then 'PASS' else 'FAIL' end,
    case when to_regprocedure(
      'public.finance_claim_document_v2(uuid,uuid,text,date)'
    ) is null then 'claim v2 nao aplicado' else 'claim v2 presente indevidamente' end

  union all

  select
    r.check_order,
    'rls.public.' || r.table_name,
    case when c.relrowsecurity then 'PASS' else 'FAIL' end,
    format(
      'enabled=%s; forced=%s',
      coalesce(c.relrowsecurity::text, 'null'),
      coalesce(c.relforcerowsecurity::text, 'null')
    )
  from expected_rls r
  left join pg_catalog.pg_class c
    on c.oid = to_regclass(format('public.%I', r.table_name))

  union all

  select
    70 + p.check_order - 60,
    'policies.inventory.' || p.table_name,
    'INFO',
    format(
      'total=%s; select=%s; insert=%s; update=%s; delete=%s',
      p.policy_count, p.select_count, p.insert_count, p.update_count,
      p.delete_count
    )
  from policy_inventory p

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
    90 + g.check_order - 60,
    'grants.inventory.' || g.table_name,
    'INFO',
    format(
      'anon=%s; authenticated=%s; service_role=%s',
      g.anon_grants, g.authenticated_grants, g.service_role_grants
    )
  from grant_inventory g

  union all

  select
    110,
    'legacy_facts.total_preserved',
    case when all_financial_rows = 4 then 'PASS' else 'FAIL' end,
    format('all_financial_rows=%s; expected=4', all_financial_rows)
  from legacy_state

  union all

  select
    111,
    'legacy_facts.versioned_as_v1',
    case when legacy_v1_rows = 4 and v2_rows = 0
      then 'PASS' else 'FAIL' end,
    format(
      'legacy_v1_rows=%s; v2_rows=%s; expected=4/0',
      legacy_v1_rows, v2_rows
    )
  from legacy_state

  union all

  select
    112,
    'legacy_facts.provenance_unchanged',
    case when legacy_rows_unexpectedly_changed = 0
      then 'PASS' else 'FAIL' end,
    format(
      'legacy_rows_with_v2_provenance=%s; expected=0',
      legacy_rows_unexpectedly_changed
    )
  from legacy_state

  union all

  select
    120,
    'baseline.documents_count',
    case when documents_count = 5226 then 'PASS' else 'FAIL' end,
    format('documents_count=%s; expected=5226', documents_count)
  from catalog_state

  union all

  select
    121,
    'baseline.onedrive_folder_count',
    case when onedrive_folder_count = 1188 then 'PASS' else 'FAIL' end,
    format('onedrive_folder_count=%s; expected=1188', onedrive_folder_count)
  from catalog_state

  union all

  select
    122,
    'pilot.document.preserved',
    case when pilot_document_count = 1 then 'PASS' else 'FAIL' end,
    format('pilot_document_count=%s; expected=1', pilot_document_count)
  from pilot_document_state

  union all

  select
    130,
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
    131,
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
