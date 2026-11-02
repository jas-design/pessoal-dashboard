-- Transactional validation for an already applied 09C migration.
-- Run only in authorized local staging after the isolation guard succeeds.
-- Every fixture and state change in this file is rolled back.
begin;

do $block$
declare
  v_owner_id uuid;
  v_company public.companies%rowtype;
  v_other_company_id uuid := gen_random_uuid();
  v_document_id uuid := gen_random_uuid();
  v_claim_id uuid := gen_random_uuid();
  v_etag text := '09c-local-validation-etag-v1';
  v_rows jsonb;
  v_conflicting_rows jsonb;
  v_cross_company_rows jsonb;
  v_result jsonb;
  v_net_result_id uuid;
begin
  if to_regprocedure(
    'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
  ) is null then
    raise exception 'Validation failed: finance_complete_document_v2 is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Validation failed: browser role can execute persistence v2';
  end if;

  select *
  into v_company
  from public.companies
  where is_active = true
  order by created_at
  limit 1;

  if not found then
    raise exception 'Validation fixture missing: an active local company is required';
  end if;

  v_owner_id := v_company.owner_id;

  insert into public.companies (id, owner_id, name, is_active)
  values (v_other_company_id, v_owner_id, 'Empresa Sintetica 09C Isolada', true);

  insert into public.documents (
    id,
    owner_id,
    source,
    category,
    file_name,
    sensitivity,
    processing_status,
    indexed_for_ai,
    metadata,
    company_id,
    source_etag,
    is_deleted
  ) values (
    v_document_id,
    v_owner_id,
    'supabase',
    'financeiro',
    'TESTE_FINANCEIRO_09C_LOCAL.xlsx',
    'standard',
    'processing',
    false,
    '{"synthetic":true,"validation":"09c"}'::jsonb,
    v_company.id,
    v_etag,
    false
  );

  insert into public.financial_extraction_jobs (
    document_id,
    owner_id,
    source_etag,
    claim_id,
    status,
    attempts,
    claimed_at
  ) values (
    v_document_id,
    v_owner_id,
    v_etag,
    v_claim_id,
    'processing',
    1,
    now()
  );

  v_rows := jsonb_build_array(
    jsonb_build_object(
      'logical_key', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K85', 'revenue', '2026-09'),
      'company_id', v_company.id,
      'company_name', v_company.name,
      'month', '2026-09-01',
      'metric_code', 'revenue',
      'amount', '120.25',
      'currency', 'BRL',
      'sheet', 'Resumo',
      'source_row', 85,
      'source_cell', 'K85',
      'review_status', 'needs_review'
    ),
    jsonb_build_object(
      'logical_key', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K68', 'expense', '2026-09'),
      'company_id', v_company.id,
      'company_name', v_company.name,
      'month', '2026-09-01',
      'metric_code', 'expense',
      'amount', '45.10',
      'currency', 'BRL',
      'sheet', 'Resumo',
      'source_row', 68,
      'source_cell', 'K68',
      'review_status', 'needs_review'
    ),
    jsonb_build_object(
      'logical_key', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K66', 'net_result', '2026-09'),
      'company_id', v_company.id,
      'company_name', v_company.name,
      'month', '2026-09-01',
      'metric_code', 'net_result',
      'amount', '-75.15',
      'currency', 'BRL',
      'sheet', 'Resumo',
      'source_row', 66,
      'source_cell', 'K66',
      'review_status', 'needs_review'
    ),
    jsonb_build_object(
      'logical_key', concat_ws(':', v_document_id, v_etag, 'Resumo', 'B4', 'cash_available', '2026-09'),
      'company_id', v_company.id,
      'company_name', v_company.name,
      'month', '2026-09-01',
      'metric_code', 'cash_available',
      'amount', '350.80',
      'currency', 'BRL',
      'sheet', 'Resumo',
      'source_row', 4,
      'source_cell', 'B4',
      'review_status', 'needs_review'
    )
  );

  select public.finance_complete_document_v2(
    v_document_id,
    v_claim_id,
    v_etag,
    'needs_review',
    v_rows,
    '09C local transactional validation',
    null
  ) into v_result;

  if (v_result->>'inserted_rows')::integer <> 4
     or (v_result->>'unchanged_rows')::integer <> 0
     or v_result->>'status' <> 'needs_review' then
    raise exception 'Validation failed: initial v2 insert result is unexpected';
  end if;

  select public.finance_complete_document_v2(
    v_document_id,
    v_claim_id,
    v_etag,
    'needs_review',
    v_rows,
    '09C identical retry',
    null
  ) into v_result;

  if (v_result->>'inserted_rows')::integer <> 0
     or (v_result->>'unchanged_rows')::integer <> 4 then
    raise exception 'Validation failed: identical retry is not idempotent';
  end if;

  select id
  into v_net_result_id
  from public.financial_extracted_rows
  where document_id = v_document_id
    and metric = 'net_result';

  update public.financial_extracted_rows
  set review_status = 'approved',
      review_revision = review_revision + 1
  where id = v_net_result_id;

  perform public.finance_complete_document_v2(
    v_document_id,
    v_claim_id,
    v_etag,
    'needs_review',
    v_rows,
    '09C reviewed-row retry',
    null
  );

  if not exists (
    select 1
    from public.financial_extracted_rows
    where id = v_net_result_id
      and review_status = 'approved'
  ) then
    raise exception 'Validation failed: identical retry reset reviewed state';
  end if;

  v_conflicting_rows := jsonb_set(v_rows, '{0,amount}', '"121.25"'::jsonb);
  begin
    perform public.finance_complete_document_v2(
      v_document_id,
      v_claim_id,
      v_etag,
      'needs_review',
      v_conflicting_rows,
      '09C conflicting retry',
      null
    );
    raise exception 'Validation failed: conflicting retry was accepted';
  exception
    when others then
      if sqlerrm not like 'Reimportacao conflitante%' then
        raise;
      end if;
  end;

  v_cross_company_rows := jsonb_set(
    v_rows,
    '{0,company_id}',
    to_jsonb(v_other_company_id::text)
  );
  begin
    perform public.finance_complete_document_v2(
      v_document_id,
      v_claim_id,
      v_etag,
      'needs_review',
      v_cross_company_rows,
      '09C cross-company retry',
      null
    );
    raise exception 'Validation failed: cross-company fact was accepted';
  exception
    when others then
      if sqlerrm not like 'Fato financeiro v2 invalido%' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.financial_extracted_rows
    where document_id = v_document_id
      and company_id is distinct from v_company.id
  ) then
    raise exception 'Validation failed: company isolation was violated';
  end if;
end;
$block$;

set local role authenticated;
do $block$
begin
  if exists (
    select 1
    from public.financial_extracted_rows
    where contract_version = 2
  ) then
    raise exception 'Validation failed: authenticated bypassed extracted-row RLS';
  end if;
end;
$block$;
reset role;

set local role anon;
do $block$
begin
  if exists (
    select 1
    from public.financial_extracted_rows
    where contract_version = 2
  ) then
    raise exception 'Validation failed: anon bypassed extracted-row RLS';
  end if;
end;
$block$;
reset role;

rollback;
