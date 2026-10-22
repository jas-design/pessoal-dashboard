-- Etapa 07C.8: preflight somente leitura da baseline anterior às migrations.
-- Execute como administrador apenas em banco isolado, antes da primeira 07C.
-- O script falha fechado quando o contrato comprovado não está presente.

begin transaction read only;

do $block$
declare
  v_missing text;
begin
  select string_agg(required.name, ', ' order by required.name)
  into v_missing
  from (values ('anon'), ('authenticated'), ('service_role')) required(name)
  where not exists (
    select 1 from pg_catalog.pg_roles r where r.rolname = required.name
  );
  if v_missing is not null then
    raise exception '07C8 preflight: missing roles: %', v_missing;
  end if;

  select string_agg(required.name, ', ' order by required.name)
  into v_missing
  from (values ('auth'), ('public'), ('financial_private')) required(name)
  where to_regnamespace(required.name) is null;
  if v_missing is not null then
    raise exception '07C8 preflight: missing schemas: %', v_missing;
  end if;

  select string_agg(required.name, ', ' order by required.name)
  into v_missing
  from (values
    ('public.profiles'),
    ('public.companies'),
    ('public.documents'),
    ('public.financial_extracted_rows'),
    ('public.financial_extraction_jobs'),
    ('public.financial_review_audit'),
    ('public.financial_review_document_policy')
  ) required(name)
  where to_regclass(required.name) is null;
  if v_missing is not null then
    raise exception '07C8 preflight: missing base relations: %', v_missing;
  end if;

  if to_regclass('public.company_members') is not null then
    raise exception '07C8 preflight: company_members already exists; use 30-postflight.sql';
  end if;
end;
$block$;

do $block$
declare
  v_missing text;
begin
  with required(table_name, column_name, udt_name) as (values
    ('companies', 'id', 'uuid'),
    ('companies', 'owner_id', 'uuid'),
    ('companies', 'name', 'text'),
    ('companies', 'is_active', 'bool'),
    ('documents', 'id', 'uuid'),
    ('documents', 'owner_id', 'uuid'),
    ('documents', 'company_id', 'uuid'),
    ('documents', 'file_name', 'text'),
    ('documents', 'file_size', 'int8'),
    ('documents', 'source_etag', 'text'),
    ('documents', 'provider', 'text'),
    ('documents', 'external_file_id', 'text'),
    ('documents', 'external_drive_id', 'text'),
    ('documents', 'source_path', 'text'),
    ('documents', 'source_modified_at', 'timestamptz'),
    ('documents', 'is_deleted', 'bool'),
    ('financial_extracted_rows', 'id', 'uuid'),
    ('financial_extracted_rows', 'owner_id', 'uuid'),
    ('financial_extracted_rows', 'document_id', 'uuid'),
    ('financial_extracted_rows', 'source_etag', 'text'),
    ('financial_extracted_rows', 'company_id', 'uuid'),
    ('financial_extracted_rows', 'review_status', 'text'),
    ('financial_extracted_rows', 'review_revision', 'int4'),
    ('financial_review_document_policy', 'document_id', 'uuid'),
    ('financial_review_document_policy', 'owner_id', 'uuid'),
    ('financial_review_document_policy', 'usage_role', 'text')
  )
  select string_agg(r.table_name || '.' || r.column_name, ', ' order by 1)
  into v_missing
  from required r
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = r.table_name
      and c.column_name = r.column_name
      and c.udt_name = r.udt_name
  );

  if v_missing is not null then
    raise exception '07C8 preflight: missing or incompatible columns: %', v_missing;
  end if;
end;
$block$;

do $block$
declare
  v_rls_missing text;
  v_broad_company_policies integer;
  v_policy_pk text;
  v_missing_constraints text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
  into v_rls_missing
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'companies', 'documents', 'financial_extracted_rows',
      'financial_extraction_jobs', 'financial_review_audit',
      'financial_review_document_policy'
    )
    and not c.relrowsecurity;
  if v_rls_missing is not null then
    raise exception '07C8 preflight: RLS disabled on: %', v_rls_missing;
  end if;

  select count(*) into v_broad_company_policies
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'companies'
    and p.polcmd = 'r'
    and trim(both '()' from pg_catalog.pg_get_expr(p.polqual, p.polrelid)) = 'true';
  if v_broad_company_policies <> 1 then
    raise exception '07C8 preflight: expected one broad companies SELECT policy, found %',
      v_broad_company_policies;
  end if;

  select pg_catalog.pg_get_constraintdef(con.oid, true)
  into v_policy_pk
  from pg_catalog.pg_constraint con
  where con.conrelid = 'public.financial_review_document_policy'::regclass
    and con.contype = 'p';
  if v_policy_pk is distinct from 'PRIMARY KEY (document_id)' then
    raise exception '07C8 preflight: unexpected document policy primary key: %', v_policy_pk;
  end if;

  with required(table_name, constraint_name) as (values
    ('companies', 'companies_owner_id_fkey'),
    ('companies', 'companies_pkey'),
    ('documents', 'documents_company_id_fkey'),
    ('documents', 'documents_owner_id_fkey'),
    ('documents', 'documents_pkey'),
    ('documents', 'documents_processing_status_check'),
    ('documents', 'documents_sensitivity_check'),
    ('documents', 'documents_source_check'),
    ('financial_extracted_rows', 'financial_extracted_rows_amount_check'),
    ('financial_extracted_rows', 'financial_extracted_rows_company_id_fkey'),
    ('financial_extracted_rows', 'financial_extracted_rows_currency_check'),
    ('financial_extracted_rows', 'financial_extracted_rows_document_id_fkey'),
    ('financial_extracted_rows', 'financial_extracted_rows_document_id_source_etag_sheet_name_key'),
    ('financial_extracted_rows', 'financial_extracted_rows_metric_check'),
    ('financial_extracted_rows', 'financial_extracted_rows_pkey'),
    ('financial_extracted_rows', 'financial_extracted_rows_review_status_check'),
    ('financial_extracted_rows', 'financial_extracted_rows_source_row_check'),
    ('financial_extraction_jobs', 'financial_extraction_jobs_document_id_fkey'),
    ('financial_extraction_jobs', 'financial_extraction_jobs_pkey'),
    ('financial_extraction_jobs', 'financial_extraction_jobs_status_check'),
    ('financial_review_audit', 'financial_review_audit_event_type_check'),
    ('financial_review_audit', 'financial_review_audit_pkey'),
    ('financial_review_document_policy', 'financial_review_document_policy_document_id_fkey'),
    ('financial_review_document_policy', 'financial_review_document_policy_pkey'),
    ('financial_review_document_policy', 'financial_review_document_policy_usage_role_check')
  )
  select string_agg(r.constraint_name, ', ' order by r.constraint_name)
  into v_missing_constraints
  from required r
  where not exists (
    select 1
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = r.table_name
      and con.conname = r.constraint_name
  );
  if v_missing_constraints is not null then
    raise exception '07C8 preflight: missing confirmed constraints: %',
      v_missing_constraints;
  end if;

  if (
    select pg_catalog.pg_get_constraintdef(con.oid, true)
    from pg_catalog.pg_constraint con
    where con.conname = 'financial_extracted_rows_document_id_source_etag_sheet_name_key'
      and con.conrelid = 'public.financial_extracted_rows'::regclass
  ) is distinct from 'UNIQUE (document_id, source_etag, sheet_name, source_row, metric)'
  then
    raise exception '07C8 preflight: extracted-row idempotency key differs';
  end if;

  if (
    select pg_catalog.pg_get_constraintdef(con.oid, true)
    from pg_catalog.pg_constraint con
    where con.conname = 'financial_extraction_jobs_pkey'
      and con.conrelid = 'public.financial_extraction_jobs'::regclass
  ) is distinct from 'PRIMARY KEY (document_id)'
  then
    raise exception '07C8 preflight: extraction job primary key differs';
  end if;
end;
$block$;

do $block$
declare
  v_signature text;
  v_oid oid;
begin
  foreach v_signature in array array[
    'public.is_admin()',
    'public.finance_review_list(text,integer,integer)',
    'public.finance_review_history(uuid,integer)',
    'public.finance_review_decide(uuid,text,text,integer)',
    'public.finance_review_set_document_role(uuid,text,text)',
    'financial_private.finance_review_list_impl(text,integer,integer)',
    'financial_private.finance_review_history_impl(uuid,integer)',
    'financial_private.finance_review_decide_impl(uuid,text,text,integer)',
    'financial_private.finance_review_set_document_role_impl(uuid,text,text)',
    'public.finance_claim_next_document(uuid,boolean)',
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception '07C8 preflight: missing function %', v_signature;
    end if;
    if pg_catalog.pg_get_userbyid((select proowner from pg_catalog.pg_proc where oid = v_oid)) <> 'postgres' then
      raise exception '07C8 preflight: unexpected owner for %', v_signature;
    end if;
  end loop;

  if not (select prosecdef from pg_catalog.pg_proc where oid = to_regprocedure('public.is_admin()')) then
    raise exception '07C8 preflight: is_admin() is not SECURITY DEFINER';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.finance_review_list(text,integer,integer)',
      'public.finance_review_history(uuid,integer)',
      'public.finance_review_decide(uuid,text,text,integer)',
      'public.finance_review_set_document_role(uuid,text,text)',
      'public.finance_claim_next_document(uuid,boolean)',
      'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
    ]) as signatures(signature)
    join pg_catalog.pg_proc p on p.oid = to_regprocedure(signatures.signature)
    where p.prosecdef
  ) then
    raise exception '07C8 preflight: an expected SECURITY INVOKER public RPC is definer';
  end if;
end;
$block$;

do $block$
declare
  v_document_policy_count integer;
begin
  select count(*) into v_document_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'documents'
    and policyname in (
      'Users view own documents',
      'Users create own documents',
      'Users update own documents',
      'Users delete own documents'
    );
  if v_document_policy_count <> 4 then
    raise exception '07C8 preflight: expected four confirmed documents policies, found %',
      v_document_policy_count;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Users view own documents'
      and position('is_admin()' in qual) > 0
  ) then
    raise exception '07C8 preflight: documents admin visibility contract differs';
  end if;
end;
$block$;

do $block$
declare
  v_signature text;
  v_oid oid;
begin
  if not has_schema_privilege('authenticated', 'financial_private', 'USAGE')
    or has_schema_privilege('anon', 'financial_private', 'USAGE')
    or has_schema_privilege('service_role', 'financial_private', 'USAGE')
  then
    raise exception '07C8 preflight: private schema ACL differs from confirmed baseline';
  end if;

  foreach v_signature in array array[
    'financial_private.finance_review_list_impl(text,integer,integer)',
    'financial_private.finance_review_history_impl(uuid,integer)',
    'financial_private.finance_review_decide_impl(uuid,text,text,integer)',
    'financial_private.finance_review_set_document_role_impl(uuid,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if not has_function_privilege('authenticated', v_oid, 'EXECUTE')
      or has_function_privilege('anon', v_oid, 'EXECUTE')
      or has_function_privilege('service_role', v_oid, 'EXECUTE')
    then
      raise exception '07C8 preflight: private function ACL differs for %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.finance_claim_next_document(uuid,boolean)',
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if not has_function_privilege('service_role', v_oid, 'EXECUTE')
      or has_function_privilege('anon', v_oid, 'EXECUTE')
      or has_function_privilege('authenticated', v_oid, 'EXECUTE')
    then
      raise exception '07C8 preflight: extraction RPC ACL differs for %', v_signature;
    end if;
  end loop;
end;
$block$;

select
  '07c8_preflight' as check_name,
  'ready_for_current_07c_migrations' as result,
  current_database() as database_name,
  current_setting('server_version') as server_version;

rollback;
