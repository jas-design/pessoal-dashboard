begin;

-- The real pilot must claim the approved document, never the next eligible one.
do $block$
declare
  v_missing_columns text;
begin
  if to_regprocedure(
    'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
  ) is null then
    raise exception 'Preflight failed: finance_complete_document_v2 is missing';
  end if;

  if to_regprocedure(
    'public.finance_claim_document_v2(uuid,uuid,text,date)'
  ) is not null then
    raise exception 'Preflight failed: finance_claim_document_v2 already exists';
  end if;

  select string_agg(expected.table_name || '.' || expected.column_name, ', ')
  into v_missing_columns
  from (values
    ('companies', 'id'),
    ('companies', 'owner_id'),
    ('companies', 'name'),
    ('companies', 'is_active'),
    ('documents', 'id'),
    ('documents', 'owner_id'),
    ('documents', 'company_id'),
    ('documents', 'provider'),
    ('documents', 'is_deleted'),
    ('documents', 'processing_status'),
    ('documents', 'file_name'),
    ('documents', 'file_size'),
    ('documents', 'source_etag'),
    ('documents', 'external_drive_id'),
    ('documents', 'external_file_id'),
    ('documents', 'source_path'),
    ('documents', 'period_year'),
    ('documents', 'period_month'),
    ('financial_extraction_jobs', 'document_id'),
    ('financial_extraction_jobs', 'owner_id'),
    ('financial_extraction_jobs', 'source_etag'),
    ('financial_extraction_jobs', 'claim_id'),
    ('financial_extraction_jobs', 'status'),
    ('financial_extraction_jobs', 'attempts'),
    ('financial_extracted_rows', 'document_id'),
    ('financial_extracted_rows', 'source_etag')
  ) as expected(table_name, column_name)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
  where actual.column_name is null;

  if v_missing_columns is not null then
    raise exception 'Preflight failed: missing columns: %', v_missing_columns;
  end if;
end;
$block$;

create function public.finance_claim_document_v2(
  p_document_id uuid,
  p_company_id uuid,
  p_source_etag text,
  p_period_month date
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public'
as $function$
declare
  v_doc public.documents%rowtype;
  v_company public.companies%rowtype;
  v_job public.financial_extraction_jobs%rowtype;
  v_claim_id uuid := gen_random_uuid();
  v_attempts integer := 1;
begin
  if p_document_id is null
     or p_company_id is null
     or p_source_etag is null
     or length(p_source_etag) not between 1 and 512
     or p_source_etag ~ '[[:cntrl:]]'
     or p_period_month is null
     or extract(day from p_period_month) <> 1 then
    raise exception 'Identidade do claim financeiro v2 invalida';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('finance-claim-v2:' || p_document_id::text, 0)
  );

  select *
  into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found
     or v_doc.company_id is distinct from p_company_id
     or v_doc.source_etag is distinct from p_source_etag
     or v_doc.period_year is distinct from extract(year from p_period_month)::integer
     or v_doc.period_month is distinct from extract(month from p_period_month)::integer
     or v_doc.provider is distinct from 'onedrive'
     or v_doc.is_deleted
     or v_doc.processing_status is distinct from 'pending'
     or v_doc.external_drive_id is null
     or v_doc.external_file_id is null
     or v_doc.file_size not between 1 and 8388608
     or v_doc.file_name !~* '\.xlsx$'
     or not (
       v_doc.source_path = '/drive/root:/Deskboard KPIs'
       or v_doc.source_path like '/drive/root:/Deskboard KPIs/%'
     ) then
    raise exception 'Documento exato nao atende ao contrato do claim financeiro v2';
  end if;

  select *
  into v_company
  from public.companies
  where id = p_company_id
    and owner_id = v_doc.owner_id
    and is_active = true;

  if not found then
    raise exception 'Empresa do claim v2 inexistente, inativa ou fora do proprietario';
  end if;

  if exists (
    select 1
    from public.financial_extracted_rows
    where document_id = p_document_id
      and source_etag = p_source_etag
  ) then
    raise exception 'Documento e ETag ja possuem fatos financeiros';
  end if;

  select *
  into v_job
  from public.financial_extraction_jobs
  where document_id = p_document_id
  for update;

  if found then
    if v_job.source_etag is distinct from p_source_etag then
      v_attempts := 1;
    elsif v_job.status = 'failed' and v_job.attempts < 3 then
      v_attempts := v_job.attempts + 1;
    elsif v_job.status = 'processing'
          and v_job.claimed_at < now() - interval '30 minutes'
          and v_job.attempts < 3 then
      v_attempts := v_job.attempts + 1;
    else
      raise exception 'Documento exato possui claim ativo ou estado terminal nao elegivel';
    end if;
  end if;

  insert into public.financial_extraction_jobs (
    document_id,
    owner_id,
    source_etag,
    claim_id,
    status,
    attempts,
    claimed_at,
    completed_at,
    records_extracted,
    note,
    text_excerpt,
    updated_at
  ) values (
    v_doc.id,
    v_doc.owner_id,
    p_source_etag,
    v_claim_id,
    'processing',
    v_attempts,
    now(),
    null,
    0,
    null,
    null,
    now()
  )
  on conflict (document_id) do update set
    owner_id = excluded.owner_id,
    source_etag = excluded.source_etag,
    claim_id = excluded.claim_id,
    status = 'processing',
    attempts = excluded.attempts,
    claimed_at = excluded.claimed_at,
    completed_at = null,
    records_extracted = 0,
    note = null,
    text_excerpt = null,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'has_document', true,
    'contract_version', 2,
    'document_id', v_doc.id,
    'owner_id', v_doc.owner_id,
    'company_id', v_company.id,
    'company_name', v_company.name,
    'source_etag', v_doc.source_etag,
    'external_drive_id', v_doc.external_drive_id,
    'external_file_id', v_doc.external_file_id,
    'source_path', v_doc.source_path,
    'file_name', v_doc.file_name,
    'file_size', v_doc.file_size,
    'extension', 'xlsx',
    'period_month', to_char(p_period_month, 'YYYY-MM'),
    'claim_id', v_claim_id
  );
end;
$function$;

alter function public.finance_claim_document_v2(uuid, uuid, text, date)
  owner to postgres;

revoke all on function public.finance_claim_document_v2(uuid, uuid, text, date)
  from public, anon, authenticated, service_role;

grant execute on function public.finance_claim_document_v2(uuid, uuid, text, date)
  to service_role;

commit;
