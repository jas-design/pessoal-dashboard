-- Transactional validation for the local-only 10E.1 authorization.
-- The staging authorization script must already be applied manually.
-- Every fact, policy, audit event and publication created here is rolled back.
begin;

do $block$
declare
  v_company public.companies%rowtype;
  v_document public.documents%rowtype;
  v_other_company_id uuid := gen_random_uuid();
  v_other_document_id uuid := gen_random_uuid();
  v_revenue_id uuid := gen_random_uuid();
  v_expense_id uuid := gen_random_uuid();
  v_result_id uuid := gen_random_uuid();
  v_cash_id uuid := gen_random_uuid();
  v_cross_company_id uuid := gen_random_uuid();
  v_fact_ids uuid[];
  v_result jsonb;
  v_legacy_count integer;
  v_legacy_fingerprint text;
begin
  if to_regprocedure(
    'financial_test.authorize_primary_source(uuid,uuid,text)'
  ) is null or to_regprocedure(
    'financial_test.approve_extracted_row(uuid,uuid,text,integer)'
  ) is null then
    raise exception 'Validation failed: local staging authorization is missing';
  end if;

  if has_function_privilege(
    'anon',
    'financial_test.authorize_primary_source(uuid,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'financial_test.authorize_primary_source(uuid,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'financial_test.approve_extracted_row(uuid,uuid,text,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'financial_test.approve_extracted_row(uuid,uuid,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'Validation failed: browser roles can execute the staging exception';
  end if;

  if position(
    'Arquivos de teste nao podem ser fontes primarias'
    in pg_get_functiondef(
      'financial_private.finance_review_set_document_role_impl(uuid,text,text)'::regprocedure
    )
  ) = 0 or position(
    'Arquivos de teste nao podem ser aprovados'
    in pg_get_functiondef(
      'financial_private.finance_review_decide_impl(uuid,text,text,integer)'::regprocedure
    )
  ) = 0 then
    raise exception 'Validation failed: operational TESTE_ protections changed';
  end if;

  select * into v_company
  from public.companies
  where id = '6faa0c8b-733f-4406-91c9-638a4e93ee11'
    and owner_id = '08e9abae-db9c-46b4-81be-c90bf7ea04e5'
    and is_active;

  if not found then
    raise exception 'Validation failed: allowlisted company is unavailable';
  end if;

  select * into v_document
  from public.documents
  where id = '00000000-0000-4000-8000-0000000009e2'
    and owner_id = v_company.owner_id
    and company_id = v_company.id
    and file_name = 'TESTE_FINANCEIRO_09B_SINTETICO.xlsx'
    and source_etag = 'synthetic-local-sha256-2a5a4be80c428acf5c14c21bfc214d8020215ddbc95eb1f74c7161493de9e39a'
    and not is_deleted;

  if not found then
    raise exception 'Validation failed: allowlisted document is unavailable';
  end if;

  select
    count(*),
    md5(coalesce(
      string_agg(md5(row_to_json(metric)::text), '' order by metric.id::text),
      ''
    ))
  into v_legacy_count, v_legacy_fingerprint
  from public.financial_monthly_metrics metric;

  insert into public.companies (id, owner_id, name, is_active)
  values (
    v_other_company_id,
    v_company.owner_id,
    'Empresa Sintetica 10E1 Divergente',
    true
  );

  insert into public.documents (
    id, owner_id, source, category, file_name, sensitivity,
    processing_status, indexed_for_ai, metadata, company_id,
    source_etag, is_deleted
  ) values (
    v_other_document_id,
    v_company.owner_id,
    'supabase',
    'financeiro',
    'TESTE_FINANCEIRO_10E1_NAO_AUTORIZADO.xlsx',
    'standard',
    'completed',
    false,
    '{"synthetic":true,"validation":"10e1-non-allowlisted"}'::jsonb,
    v_company.id,
    'synthetic-local-10e1-not-allowlisted',
    false
  );

  insert into public.financial_extracted_rows (
    id, owner_id, document_id, source_etag, company_id,
    source_company_name, period_month, metric, amount, currency,
    sheet_name, source_row, source_cell, logical_key, contract_version,
    review_status, review_revision
  ) values
    (
      v_revenue_id, v_company.owner_id, v_document.id, v_document.source_etag,
      v_company.id, v_company.name, '2099-01-01', 'revenue', 125000, 'BRL',
      'SINTETICO_10E1', 2, 'B2',
      concat_ws(':', v_document.id, v_document.source_etag, 'SINTETICO_10E1', 'B2', 'revenue', '2099-01'),
      2, 'pending_review', 0
    ),
    (
      v_expense_id, v_company.owner_id, v_document.id, v_document.source_etag,
      v_company.id, v_company.name, '2099-01-01', 'expense', 0, 'BRL',
      'SINTETICO_10E1', 3, 'B3',
      concat_ws(':', v_document.id, v_document.source_etag, 'SINTETICO_10E1', 'B3', 'expense', '2099-01'),
      2, 'pending_review', 0
    ),
    (
      v_result_id, v_company.owner_id, v_document.id, v_document.source_etag,
      v_company.id, v_company.name, '2099-01-01', 'net_result', -7500, 'BRL',
      'SINTETICO_10E1', 4, 'B4',
      concat_ws(':', v_document.id, v_document.source_etag, 'SINTETICO_10E1', 'B4', 'net_result', '2099-01'),
      2, 'pending_review', 0
    ),
    (
      v_cash_id, v_company.owner_id, v_document.id, v_document.source_etag,
      v_company.id, v_company.name, '2099-01-01', 'cash_available', 34250, 'BRL',
      'SINTETICO_10E1', 5, 'B5',
      concat_ws(':', v_document.id, v_document.source_etag, 'SINTETICO_10E1', 'B5', 'cash_available', '2099-01'),
      2, 'pending_review', 0
    );

  v_fact_ids := array[v_revenue_id, v_expense_id, v_result_id, v_cash_id];

  -- The normal production contract must continue rejecting TESTE_ documents.
  perform set_config('request.jwt.claim.sub', v_company.owner_id::text, true);
  begin
    perform public.finance_review_set_document_role(
      v_document.id,
      'primary',
      'Validacao do bloqueio operacional TESTE_'
    );
    raise exception 'Validation failed: operational source classification accepted TESTE_';
  exception when others then
    if sqlerrm not like 'Arquivos de teste nao podem ser fontes primarias%' then raise; end if;
  end;

  begin
    perform financial_test.authorize_primary_source(
      v_other_document_id,
      v_company.owner_id,
      'Documento TESTE_ fora da allowlist deve permanecer bloqueado'
    );
    raise exception 'Validation failed: non-allowlisted TESTE_ document was authorized';
  exception when others then
    if sqlerrm not like 'Documento sintetico nao autorizado%' then raise; end if;
  end;

  perform financial_test.authorize_primary_source(
    v_document.id,
    v_company.owner_id,
    'Autorizacao local controlada para validacao sintetica 10E1'
  );

  insert into public.financial_extracted_rows (
    id, owner_id, document_id, source_etag, company_id,
    source_company_name, period_month, metric, amount, currency,
    sheet_name, source_row, source_cell, logical_key, contract_version,
    review_status, review_revision
  ) values (
    v_cross_company_id, v_company.owner_id, v_document.id, v_document.source_etag,
    v_other_company_id, 'Empresa Sintetica 10E1 Divergente',
    '2099-02-01', 'revenue', 1, 'BRL',
    'SINTETICO_10E1', 6, 'B6',
    concat_ws(':', v_document.id, v_document.source_etag, 'SINTETICO_10E1', 'B6', 'revenue', '2099-02'),
    2, 'pending_review', 0
  );

  begin
    perform public.finance_publish_monthly_metrics(
      v_company.id,
      '2099-01-01',
      v_fact_ids,
      v_company.owner_id
    );
    raise exception 'Validation failed: pending facts were published';
  exception when others then
    if sqlerrm not like 'Publicacao exige fatos canonicos v2 aprovados%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_company.owner_id::text, true);
  begin
    perform public.finance_review_decide(
      v_revenue_id,
      'approve',
      'Validacao do bloqueio operacional de aprovacao TESTE_',
      0
    );
    raise exception 'Validation failed: operational review accepted TESTE_';
  exception when others then
    if sqlerrm not like 'Arquivos de teste nao podem ser aprovados%' then raise; end if;
  end;

  perform financial_test.approve_extracted_row(
    v_revenue_id, v_company.owner_id, 'Aprovacao sintetica local 10E1 receita', 0
  );
  perform financial_test.approve_extracted_row(
    v_expense_id, v_company.owner_id, 'Aprovacao sintetica local 10E1 despesa zero', 0
  );
  perform financial_test.approve_extracted_row(
    v_result_id, v_company.owner_id, 'Aprovacao sintetica local 10E1 resultado negativo', 0
  );
  perform financial_test.approve_extracted_row(
    v_cash_id, v_company.owner_id, 'Aprovacao sintetica local 10E1 saldo caixa', 0
  );

  begin
    perform financial_test.approve_extracted_row(
      v_cross_company_id,
      v_company.owner_id,
      'Empresa divergente deve continuar bloqueada na revisao',
      0
    );
    raise exception 'Validation failed: cross-company row was approved';
  exception when others then
    if sqlerrm not like 'Empresa, proprietario, documento ou ETag divergente%' then raise; end if;
  end;

  select public.finance_publish_monthly_metrics(
    v_company.id,
    '2099-01-01',
    v_fact_ids,
    v_company.owner_id
  ) into v_result;

  if v_result->>'status' <> 'published' then
    raise exception 'Validation failed: allowlisted synthetic publication failed';
  end if;

  if not exists (
    select 1
    from public.financial_monthly_metrics_published publication
    where publication.company_id = v_company.id
      and publication.period_month = '2099-01-01'
      and publication.revenue = 125000
      and publication.expenses = 0
      and publication.net_profit = -7500
      and publication.net_margin is null
      and publication.cash_balance = 34250
      and publication.source_document_id = v_document.id
      and publication.source_etag = v_document.source_etag
  ) then
    raise exception 'Validation failed: published values or provenance diverged';
  end if;

  if v_legacy_count <> (select count(*) from public.financial_monthly_metrics)
     or v_legacy_fingerprint <> (
       select md5(coalesce(
         string_agg(md5(row_to_json(metric)::text), '' order by metric.id::text),
         ''
       ))
       from public.financial_monthly_metrics metric
     ) then
    raise exception 'Validation failed: legacy financial metrics changed';
  end if;
end;
$block$;

rollback;
