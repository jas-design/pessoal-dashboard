begin;

-- Version 2 is additive. The original RPC remains available for its existing
-- callers while new XLSX imports use the lossless canonical-fact contract.
do $block$
declare
  v_rls_enabled boolean;
begin
  if to_regclass('public.financial_extracted_rows') is null
     or to_regclass('public.financial_extraction_jobs') is null
     or to_regclass('public.documents') is null
     or to_regclass('public.companies') is null then
    raise exception 'Preflight failed: required financial extraction tables are missing';
  end if;

  if to_regprocedure(
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ) is null then
    raise exception 'Preflight failed: finance_complete_document v1 is missing';
  end if;

  select c.relrowsecurity
  into v_rls_enabled
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'financial_extracted_rows';

  if v_rls_enabled is distinct from true then
    raise exception 'Preflight failed: RLS must remain enabled on financial_extracted_rows';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_extracted_rows'
      and column_name in ('logical_key', 'source_cell', 'contract_version')
  ) then
    raise exception 'Preflight failed: persistence v2 columns already exist';
  end if;
end;
$block$;

alter table public.financial_extracted_rows
  add column logical_key text,
  add column source_cell text,
  add column contract_version smallint not null default 1;

alter table public.financial_extracted_rows
  drop constraint financial_extracted_rows_metric_check,
  drop constraint financial_extracted_rows_amount_check;

alter table public.financial_extracted_rows
  add constraint financial_extracted_rows_metric_check
    check (metric in (
      'receita',
      'despesa',
      'revenue',
      'expense',
      'net_result',
      'cash_available'
    )),
  add constraint financial_extracted_rows_amount_check
    check (
      metric = 'net_result'
      or amount >= 0
    ),
  add constraint financial_extracted_rows_logical_key_check
    check (
      logical_key is null
      or (
        length(logical_key) between 1 and 700
        and logical_key = btrim(logical_key)
        and logical_key !~ '[[:cntrl:]]'
      )
    ),
  add constraint financial_extracted_rows_source_cell_check
    check (
      source_cell is null
      or source_cell ~ '^[A-Z]{1,3}[1-9][0-9]*$'
    ),
  add constraint financial_extracted_rows_contract_version_check
    check (contract_version in (1, 2)),
  add constraint financial_extracted_rows_v2_provenance_check
    check (
      contract_version <> 2
      or (
        logical_key is not null
        and source_cell is not null
        and metric in ('revenue', 'expense', 'net_result', 'cash_available')
      )
    );

create unique index financial_extracted_rows_v2_logical_identity_uidx
  on public.financial_extracted_rows (document_id, source_etag, logical_key)
  where logical_key is not null;

create or replace function public.finance_complete_document_v2(
  p_document_id uuid,
  p_claim_id uuid,
  p_source_etag text,
  p_status text,
  p_rows jsonb default '[]'::jsonb,
  p_note text default null,
  p_excerpt text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public'
as $function$
declare
  v_job public.financial_extraction_jobs%rowtype;
  v_doc public.documents%rowtype;
  v_company public.companies%rowtype;
  v_existing public.financial_extracted_rows%rowtype;
  v_legacy public.financial_extracted_rows%rowtype;
  v_line jsonb;
  v_company_id uuid;
  v_company_name text;
  v_period date;
  v_metric text;
  v_currency text;
  v_amount numeric;
  v_sheet text;
  v_source_row integer;
  v_source_cell text;
  v_logical_key text;
  v_expected_logical_key text;
  v_inserted integer := 0;
  v_unchanged integer := 0;
begin
  if p_document_id is null
     or p_claim_id is null
     or p_source_etag is null
     or length(p_source_etag) not between 1 and 512
     or p_source_etag ~ '[[:cntrl:]]'
     or p_status is null
     or p_status not in ('needs_review', 'needs_ocr', 'failed')
     or p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'Payload de extracao v2 invalido';
  end if;

  if p_status = 'needs_review' and jsonb_array_length(p_rows) = 0 then
    raise exception 'Extracao para revisao exige fatos canonicos';
  end if;

  if p_status <> 'needs_review' and jsonb_array_length(p_rows) <> 0 then
    raise exception 'Status sem revisao nao pode persistir fatos';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as row_item(value)
    group by row_item.value->>'logical_key'
    having count(*) > 1
  ) then
    raise exception 'Payload de extracao v2 contem chave logica duplicada';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_document_id::text || ':' || p_source_etag, 0)
  );

  select *
  into v_job
  from public.financial_extraction_jobs
  where document_id = p_document_id
  for update;

  if not found
     or v_job.claim_id is distinct from p_claim_id
     or v_job.source_etag is distinct from p_source_etag
     or v_job.status not in ('processing', p_status) then
    raise exception 'Claim v2 ausente, obsoleto ou finalizado por outro processamento';
  end if;

  select *
  into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found
     or v_doc.is_deleted
     or v_doc.owner_id is distinct from v_job.owner_id
     or v_doc.source_etag is distinct from p_source_etag
     or v_doc.company_id is null then
    raise exception 'Documento v2 indisponivel, alterado ou sem empresa';
  end if;

  select *
  into v_company
  from public.companies
  where id = v_doc.company_id
    and owner_id = v_doc.owner_id
    and is_active = true;

  if not found then
    raise exception 'Empresa v2 inexistente, inativa ou fora do proprietario';
  end if;

  if p_status <> 'needs_review' then
    update public.financial_extraction_jobs
    set status = p_status,
        completed_at = now(),
        records_extracted = 0,
        note = left(p_note, 500),
        text_excerpt = left(p_excerpt, 1500),
        updated_at = now()
    where document_id = p_document_id;

    return jsonb_build_object(
      'success', true,
      'contract_version', 2,
      'document_id', p_document_id,
      'status', p_status,
      'inserted_rows', 0,
      'unchanged_rows', 0,
      'requires_approval', false
    );
  end if;

  for v_line in
    select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'Fato financeiro v2 invalido';
    end if;

    v_company_id := nullif(v_line->>'company_id', '')::uuid;
    v_company_name := nullif(btrim(v_line->>'company_name'), '');
    v_period := nullif(v_line->>'month', '')::date;
    v_metric := v_line->>'metric_code';
    v_amount := nullif(v_line->>'amount', '')::numeric;
    v_currency := upper(coalesce(nullif(v_line->>'currency', ''), 'BRL'));
    v_sheet := nullif(btrim(v_line->>'sheet'), '');
    v_source_row := nullif(v_line->>'source_row', '')::integer;
    v_source_cell := v_line->>'source_cell';
    v_logical_key := v_line->>'logical_key';

    if v_line->>'review_status' is distinct from 'needs_review'
       or v_company_id is distinct from v_doc.company_id
       or v_company_name is distinct from btrim(v_company.name)
       or v_metric is null
       or v_metric not in ('revenue', 'expense', 'net_result', 'cash_available')
       or v_currency <> 'BRL'
       or v_period is null
       or extract(day from v_period) <> 1
       or v_amount is null
       or abs(v_amount) > 999999999999.99
       or (v_metric <> 'net_result' and v_amount < 0)
       or v_sheet is null
       or length(v_sheet) > 120
       or v_sheet ~ '[[:cntrl:]]'
       or v_source_row is null
       or v_source_row <= 0
       or v_source_cell is null
       or v_source_cell !~ '^[A-Z]{1,3}[1-9][0-9]*$'
       or substring(v_source_cell from '[0-9]+$')::integer <> v_source_row
       or v_logical_key is null
       or length(v_logical_key) not between 1 and 700
       or v_logical_key <> btrim(v_logical_key)
       or v_logical_key ~ '[[:cntrl:]]' then
      raise exception 'Fato financeiro v2 invalido ou fora da empresa autorizada';
    end if;

    v_expected_logical_key := concat_ws(
      ':',
      p_document_id::text,
      p_source_etag,
      v_sheet,
      v_source_cell,
      v_metric,
      to_char(v_period, 'YYYY-MM')
    );

    if v_logical_key is distinct from v_expected_logical_key then
      raise exception 'Chave logica v2 nao corresponde a proveniencia informada';
    end if;

    select *
    into v_existing
    from public.financial_extracted_rows
    where document_id = p_document_id
      and source_etag = p_source_etag
      and logical_key = v_logical_key
    for update;

    if found then
      if v_existing.owner_id is distinct from v_doc.owner_id
         or v_existing.company_id is distinct from v_company_id
         or v_existing.source_company_name is distinct from v_company_name
         or v_existing.period_month is distinct from v_period
         or v_existing.metric is distinct from v_metric
         or v_existing.amount is distinct from v_amount
         or v_existing.currency is distinct from v_currency
         or v_existing.sheet_name is distinct from v_sheet
         or v_existing.source_row is distinct from v_source_row
         or v_existing.source_cell is distinct from v_source_cell
         or v_existing.contract_version is distinct from 2 then
        raise exception 'Reimportacao conflitante para chave logica v2';
      end if;

      -- An identical retry is a no-op. In particular, an approved or rejected
      -- row is never reset to pending_review by a repeated extraction.
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    select *
    into v_legacy
    from public.financial_extracted_rows
    where document_id = p_document_id
      and source_etag = p_source_etag
      and sheet_name = v_sheet
      and source_row = v_source_row
      and metric = v_metric
      and logical_key is null
    for update;

    if found then
      raise exception 'Linha legada ocupa a identidade natural v2; revisao manual obrigatoria';
    end if;

    insert into public.financial_extracted_rows (
      owner_id,
      document_id,
      source_etag,
      company_id,
      source_company_name,
      period_month,
      metric,
      amount,
      currency,
      sheet_name,
      source_row,
      source_cell,
      logical_key,
      contract_version,
      review_status
    ) values (
      v_doc.owner_id,
      v_doc.id,
      p_source_etag,
      v_company_id,
      v_company_name,
      v_period,
      v_metric,
      v_amount,
      v_currency,
      v_sheet,
      v_source_row,
      v_source_cell,
      v_logical_key,
      2,
      'pending_review'
    );

    v_inserted := v_inserted + 1;
  end loop;

  update public.financial_extraction_jobs
  set status = 'needs_review',
      completed_at = now(),
      records_extracted = v_inserted + v_unchanged,
      note = left(p_note, 500),
      text_excerpt = left(p_excerpt, 1500),
      updated_at = now()
  where document_id = p_document_id;

  return jsonb_build_object(
    'success', true,
    'contract_version', 2,
    'document_id', p_document_id,
    'status', 'needs_review',
    'inserted_rows', v_inserted,
    'unchanged_rows', v_unchanged,
    'requires_approval', true
  );
end;
$function$;

alter function public.finance_complete_document_v2(
  uuid, uuid, text, text, jsonb, text, text
) owner to postgres;

revoke all on function public.finance_complete_document_v2(
  uuid, uuid, text, text, jsonb, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.finance_complete_document_v2(
  uuid, uuid, text, text, jsonb, text, text
) to service_role;

commit;
