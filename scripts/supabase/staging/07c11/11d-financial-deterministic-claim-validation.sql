-- Transactional validation for the deterministic v2 claim in local staging.
-- All synthetic fixtures and claim state are rolled back.
begin;

do $block$
declare
  v_company public.companies%rowtype;
  v_document_id uuid := gen_random_uuid();
  v_decoy_document_id uuid := gen_random_uuid();
  v_etag text := '11d-local-deterministic-claim-etag';
  v_result jsonb;
begin
  if to_regprocedure(
    'public.finance_claim_document_v2(uuid,uuid,text,date)'
  ) is null then
    raise exception 'Validation failed: deterministic claim v2 is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.finance_claim_document_v2(uuid,uuid,text,date)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finance_claim_document_v2(uuid,uuid,text,date)',
    'EXECUTE'
  ) then
    raise exception 'Validation failed: browser role can execute deterministic claim';
  end if;

  select *
  into v_company
  from public.companies
  where is_active = true
  order by created_at
  limit 1;

  if not found then
    raise exception 'Validation fixture missing: active company required';
  end if;

  insert into public.documents (
    id, owner_id, source, provider, category, file_name, mime_type, file_size,
    sensitivity, processing_status, indexed_for_ai, metadata, company_id,
    source_etag, external_drive_id, external_file_id, source_path,
    period_year, period_month, is_deleted
  ) values
  (
    v_document_id, v_company.owner_id, 'onedrive', 'onedrive', 'financeiro',
    'TESTE_FINANCEIRO_11D_ALVO.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    524760, 'standard', 'pending', false, '{"synthetic":true}'::jsonb,
    v_company.id, v_etag, 'drive-11d', 'file-11d-target',
    '/drive/root:/Deskboard KPIs/Financeiro/TESTE_FINANCEIRO_11D_ALVO.xlsx',
    2099, 9, false
  ),
  (
    v_decoy_document_id, v_company.owner_id, 'onedrive', 'onedrive', 'financeiro',
    'TESTE_FINANCEIRO_11D_ISCA.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    1000, 'standard', 'pending', false, '{"synthetic":true}'::jsonb,
    v_company.id, '11d-decoy-etag', 'drive-11d', 'file-11d-decoy',
    '/drive/root:/Deskboard KPIs/Financeiro/TESTE_FINANCEIRO_11D_ISCA.xlsx',
    2099, 9, false
  );

  begin
    perform public.finance_claim_document_v2(
      v_document_id, v_company.id, 'wrong-etag', '2099-09-01'::date
    );
    raise exception 'Validation failed: wrong ETag was accepted';
  exception
    when others then
      if sqlerrm not like 'Documento exato nao atende%' then raise; end if;
  end;

  begin
    perform public.finance_claim_document_v2(
      v_document_id, v_company.id, v_etag, '2099-10-01'::date
    );
    raise exception 'Validation failed: wrong period was accepted';
  exception
    when others then
      if sqlerrm not like 'Documento exato nao atende%' then raise; end if;
  end;

  select public.finance_claim_document_v2(
    v_document_id,
    v_company.id,
    v_etag,
    '2099-09-01'::date
  ) into v_result;

  if v_result->>'document_id' <> v_document_id::text
     or v_result->>'company_id' <> v_company.id::text
     or v_result->>'source_etag' <> v_etag
     or v_result->>'period_month' <> '2099-09'
     or v_result->>'extension' <> 'xlsx'
     or (v_result->>'contract_version')::integer <> 2 then
    raise exception 'Validation failed: deterministic claim response is invalid';
  end if;

  if not exists (
    select 1
    from public.financial_extraction_jobs
    where document_id = v_document_id
      and owner_id = v_company.owner_id
      and source_etag = v_etag
      and status = 'processing'
      and attempts = 1
  ) then
    raise exception 'Validation failed: target job was not created';
  end if;

  if exists (
    select 1
    from public.financial_extraction_jobs
    where document_id = v_decoy_document_id
  ) then
    raise exception 'Validation failed: decoy document was claimed';
  end if;

  begin
    perform public.finance_claim_document_v2(
      v_document_id, v_company.id, v_etag, '2099-09-01'::date
    );
    raise exception 'Validation failed: active claim was replaced';
  exception
    when others then
      if sqlerrm not like 'Documento exato possui claim ativo%' then raise; end if;
  end;
end;
$block$;

rollback;
