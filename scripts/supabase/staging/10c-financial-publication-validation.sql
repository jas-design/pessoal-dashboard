-- Transactional validation for an already applied 10C migration.
-- Run only in the isolated local staging after its isolation guard succeeds.
-- Every fixture and publication created here is rolled back.
begin;

do $block$
declare
  v_company public.companies%rowtype;
  v_other_company_id uuid := gen_random_uuid();
  v_document_id uuid := gen_random_uuid();
  v_conflict_document_id uuid := gen_random_uuid();
  v_etag text := '10c-local-publication-etag-v1';
  v_revenue_id uuid := gen_random_uuid();
  v_expense_id uuid := gen_random_uuid();
  v_result_id uuid := gen_random_uuid();
  v_cash_id uuid := gen_random_uuid();
  v_missing_revenue_id uuid := gen_random_uuid();
  v_missing_result_id uuid := gen_random_uuid();
  v_pending_id uuid := gen_random_uuid();
  v_rejected_id uuid := gen_random_uuid();
  v_conflict_id uuid := gen_random_uuid();
  v_result jsonb;
  v_publication public.financial_monthly_metrics_published%rowtype;
begin
  if to_regprocedure(
    'public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)'
  ) is null then
    raise exception 'Validation failed: publication RPC is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)',
    'EXECUTE'
  ) then
    raise exception 'Validation failed: browser role can execute publication';
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

  insert into public.companies (id, owner_id, name, is_active)
  values (v_other_company_id, v_company.owner_id, 'Empresa Sintetica 10C Isolada', true);

  insert into public.documents (
    id, owner_id, source, category, file_name, sensitivity,
    processing_status, indexed_for_ai, metadata, company_id,
    source_etag, is_deleted
  ) values
  (
    v_document_id, v_company.owner_id, 'supabase', 'financeiro',
    'VALIDACAO_FINANCEIRA_10C_LOCAL.xlsx', 'standard', 'completed', false,
    '{"synthetic":true,"validation":"10c"}'::jsonb,
    v_company.id, v_etag, false
  ),
  (
    v_conflict_document_id, v_company.owner_id, 'supabase', 'financeiro',
    'VALIDACAO_FINANCEIRA_10C_CONFLITO.xlsx', 'standard', 'completed', false,
    '{"synthetic":true,"validation":"10c-conflict"}'::jsonb,
    v_company.id, '10c-conflict-etag-v1', false
  );

  insert into public.financial_review_document_policy (
    document_id, owner_id, usage_role, changed_by, changed_at
  ) values
    (v_document_id, v_company.owner_id, 'primary', v_company.owner_id, now()),
    (v_conflict_document_id, v_company.owner_id, 'primary', v_company.owner_id, now());

  insert into public.financial_extracted_rows (
    id, owner_id, document_id, source_etag, company_id,
    source_company_name, period_month, metric, amount, currency,
    sheet_name, source_row, source_cell, logical_key, contract_version,
    review_status, review_revision, reviewed_at, reviewed_by
  ) values
    (
      v_revenue_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-09-01', 'revenue', 120.25, 'BRL',
      'Resumo', 85, 'K85', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K85', 'revenue', '2026-09'),
      2, 'approved', 1, now(), v_company.owner_id
    ),
    (
      v_expense_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-09-01', 'expense', 0, 'BRL',
      'Resumo', 68, 'K68', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K68', 'expense', '2026-09'),
      2, 'approved', 1, now(), v_company.owner_id
    ),
    (
      v_result_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-09-01', 'net_result', -75.15, 'BRL',
      'Resumo', 66, 'K66', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K66', 'net_result', '2026-09'),
      2, 'approved', 1, now(), v_company.owner_id
    ),
    (
      v_cash_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-09-01', 'cash_available', 350.80, 'BRL',
      'Resumo', 4, 'B4', concat_ws(':', v_document_id, v_etag, 'Resumo', 'B4', 'cash_available', '2026-09'),
      2, 'approved', 1, now(), v_company.owner_id
    ),
    (
      v_missing_revenue_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-10-01', 'revenue', 0, 'BRL',
      'Resumo', 86, 'K86', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K86', 'revenue', '2026-10'),
      2, 'approved', 1, now(), v_company.owner_id
    ),
    (
      v_missing_result_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-10-01', 'net_result', 0, 'BRL',
      'Resumo', 67, 'K67', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K67', 'net_result', '2026-10'),
      2, 'approved', 1, now(), v_company.owner_id
    ),
    (
      v_pending_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-11-01', 'revenue', 10, 'BRL',
      'Resumo', 87, 'K87', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K87', 'revenue', '2026-11'),
      2, 'pending_review', 0, null, null
    ),
    (
      v_rejected_id, v_company.owner_id, v_document_id, v_etag, v_company.id,
      v_company.name, '2026-12-01', 'revenue', 10, 'BRL',
      'Resumo', 88, 'K88', concat_ws(':', v_document_id, v_etag, 'Resumo', 'K88', 'revenue', '2026-12'),
      2, 'rejected', 1, now(), v_company.owner_id
    ),
    (
      v_conflict_id, v_company.owner_id, v_conflict_document_id, '10c-conflict-etag-v1', v_company.id,
      v_company.name, '2026-09-01', 'revenue', 999, 'BRL',
      'Resumo', 85, 'K85', concat_ws(':', v_conflict_document_id, '10c-conflict-etag-v1', 'Resumo', 'K85', 'revenue', '2026-09'),
      2, 'approved', 1, now(), v_company.owner_id
    );

  select public.finance_publish_monthly_metrics(
    v_company.id,
    '2026-09-01',
    array[v_revenue_id, v_expense_id, v_result_id, v_cash_id],
    v_company.owner_id
  ) into v_result;

  if v_result->>'status' <> 'published' then
    raise exception 'Validation failed: initial publication did not publish';
  end if;

  select * into v_publication
  from public.financial_monthly_metrics_published
  where company_id = v_company.id and period_month = '2026-09-01';

  if v_publication.revenue <> 120.25
     or v_publication.expenses <> 0
     or v_publication.net_profit <> -75.15
     or v_publication.net_margin is not null
     or v_publication.cash_balance <> 350.80 then
    raise exception 'Validation failed: canonical values, negative result or approved zero changed';
  end if;

  select public.finance_publish_monthly_metrics(
    v_company.id,
    '2026-09-01',
    array[v_cash_id, v_result_id, v_expense_id, v_revenue_id],
    v_company.owner_id
  ) into v_result;

  if v_result->>'status' <> 'unchanged' then
    raise exception 'Validation failed: identical retry is not idempotent';
  end if;

  select public.finance_publish_monthly_metrics(
    v_company.id,
    '2026-10-01',
    array[v_missing_revenue_id, v_missing_result_id],
    v_company.owner_id
  ) into v_result;

  select * into v_publication
  from public.financial_monthly_metrics_published
  where company_id = v_company.id and period_month = '2026-10-01';

  if v_publication.revenue <> 0
     or v_publication.net_profit <> 0
     or v_publication.expenses is not null
     or v_publication.cash_balance is not null then
    raise exception 'Validation failed: missing metrics were not preserved as NULL';
  end if;

  begin
    perform public.finance_publish_monthly_metrics(
      v_company.id, '2026-11-01', array[v_pending_id], v_company.owner_id
    );
    raise exception 'Validation failed: pending fact was published';
  exception when others then
    if sqlerrm not like 'Publicacao exige fatos canonicos v2 aprovados%' then raise; end if;
  end;

  begin
    perform public.finance_publish_monthly_metrics(
      v_company.id, '2026-12-01', array[v_rejected_id], v_company.owner_id
    );
    raise exception 'Validation failed: rejected fact was published';
  exception when others then
    if sqlerrm not like 'Publicacao exige fatos canonicos v2 aprovados%' then raise; end if;
  end;

  update public.documents set source_etag = '10c-local-publication-etag-v2'
  where id = v_document_id;

  begin
    perform public.finance_publish_monthly_metrics(
      v_company.id, '2026-10-01', array[v_missing_revenue_id, v_missing_result_id], v_company.owner_id
    );
    raise exception 'Validation failed: changed ETag was accepted';
  exception when others then
    if sqlerrm not like 'Documento primario indisponivel%' then raise; end if;
  end;

  update public.documents set source_etag = v_etag where id = v_document_id;

  begin
    perform public.finance_publish_monthly_metrics(
      v_company.id, '2026-09-01', array[v_conflict_id], v_company.owner_id
    );
    raise exception 'Validation failed: conflicting publication was accepted';
  exception when others then
    if sqlerrm not like 'Conflito de publicacao%' then raise; end if;
  end;

  begin
    perform public.finance_publish_monthly_metrics(
      v_other_company_id, '2026-09-01', array[v_revenue_id], v_company.owner_id
    );
    raise exception 'Validation failed: cross-company facts were accepted';
  exception when others then
    if sqlerrm not like 'Publicacao exige fatos canonicos v2 aprovados%' then raise; end if;
  end;

  begin
    perform public.finance_publish_monthly_metrics(
      v_company.id, '2026-11-01', array[v_pending_id], gen_random_uuid()
    );
    raise exception 'Validation failed: unauthorized publisher was accepted';
  exception when others then
    if sqlerrm not like 'Publicador nao autorizado%' then raise; end if;
  end;
end;
$block$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000010cc';
do $block$
begin
  if exists (select 1 from public.financial_monthly_metrics_published) then
    raise exception 'Validation failed: unrelated authenticated user bypassed publication RLS';
  end if;
end;
$block$;
reset role;

set local role anon;
do $block$
begin
  begin
    perform 1 from public.financial_monthly_metrics_published limit 1;
    raise exception 'Validation failed: anon can read published metrics';
  exception
    when insufficient_privilege then null;
  end;
end;
$block$;
reset role;

rollback;
