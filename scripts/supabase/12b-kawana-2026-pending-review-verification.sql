-- ETAPA 12B - verificacao somente leitura do lote Kawana janeiro-agosto/2026.
-- Nao exibe valores financeiros e encerra a transacao com rollback.

begin transaction read only;

with
expected_documents(document_id, period_month, expected_file_name) as (
  values
    ('3c96d0f6-0131-400d-a725-df734fdf74b0'::uuid, date '2026-01-01', '01.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('0f42768b-4874-432e-ad1a-be9d17742fb3'::uuid, date '2026-02-01', '02.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('8d8941fd-a8e6-4ac3-a4f3-8db955e2f8b8'::uuid, date '2026-03-01', '03.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('e8f068b1-b783-4ac2-aabb-59edced1cec7'::uuid, date '2026-04-01', '04.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('14697a01-9c0a-4fb2-80de-aa74ed3a75d4'::uuid, date '2026-05-01', '05.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('52099517-2fd8-44cd-b7dd-8b4eb5d6c072'::uuid, date '2026-06-01', '06.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('12b33d82-d37a-4ca2-bef7-b86bc0748e12'::uuid, date '2026-07-01', '07.2026 Relatório Gerencial Kawana.xlsx'::text),
    ('70873b2c-9059-4a07-b6e5-5b1e566f815b'::uuid, date '2026-08-01', '08.2026 Relatório Gerencial Kawana.xlsx'::text)
),
document_state as (
  select
    expected.document_id,
    expected.period_month,
    expected.expected_file_name,
    document.company_id,
    document.file_name,
    document.source_etag,
    document.provider,
    document.is_deleted
  from expected_documents expected
  left join public.documents document on document.id = expected.document_id
),
fact_state as (
  select
    expected.document_id,
    count(row.id)::integer as fact_count,
    count(distinct row.metric)::integer as metric_count,
    bool_and(row.review_status = 'pending_review') as pending_review_only,
    bool_and(row.contract_version = 2) as contract_v2_only,
    bool_and(row.company_id = '468978dd-6ffa-440e-9465-df966ba093ee'::uuid) as company_matches,
    bool_and(row.period_month = expected.period_month) as period_matches,
    bool_and(row.source_etag = document.source_etag) as etag_matches,
    bool_and(row.currency = 'BRL') as currency_matches,
    array_agg(distinct row.metric order by row.metric)
      filter (where row.metric is not null) as metrics
  from expected_documents expected
  join public.documents document on document.id = expected.document_id
  left join public.financial_extracted_rows row
    on row.document_id = expected.document_id
   and row.source_etag = document.source_etag
  group by expected.document_id, expected.period_month
),
job_state as (
  select
    expected.document_id,
    latest.status as job_status,
    latest.records_extracted,
    latest.source_etag as job_source_etag,
    latest.completed_at,
    latest.claim_id
  from expected_documents expected
  left join lateral (
    select job.status, job.records_extracted, job.source_etag,
           job.completed_at, job.claim_id
    from public.financial_extraction_jobs job
    where job.document_id = expected.document_id
    order by job.updated_at desc
    limit 1
  ) latest on true
)
select
  expected.period_month,
  expected.document_id,
  case
    when document.company_id = '468978dd-6ffa-440e-9465-df966ba093ee'::uuid
     and document.file_name = expected.expected_file_name
     and document.source_etag is not null
     and document.provider = 'onedrive'
     and document.is_deleted = false
    then 'PASS' else 'FAIL'
  end as document_identity,
  case
    when job.job_status = 'needs_review'
     and job.records_extracted = 4
     and job.job_source_etag = document.source_etag
     and job.completed_at is not null
     and job.claim_id is not null
    then 'PASS' else 'FAIL'
  end as latest_job,
  case
    when facts.fact_count = 4
     and facts.metric_count = 4
     and facts.pending_review_only
     and facts.contract_v2_only
     and facts.company_matches
     and facts.period_matches
     and facts.etag_matches
     and facts.currency_matches
     and facts.metrics = array[
       'cash_available', 'expense', 'net_result', 'revenue'
     ]::text[]
    then 'PASS' else 'FAIL'
  end as canonical_facts
from expected_documents expected
join document_state document using (document_id, period_month, expected_file_name)
join fact_state facts using (document_id)
join job_state job using (document_id)
order by expected.period_month;

rollback;
