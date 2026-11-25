-- Sprint financeiro: inventário sanitizável dos fatos existentes.
-- Somente leitura; não aprova, não publica e encerra com rollback.

begin transaction read only;

with facts as (
  select
    company.name as company_name,
    fact.period_month,
    fact.document_id,
    document.file_name,
    fact.id as fact_id,
    fact.metric,
    fact.amount,
    fact.currency,
    fact.sheet_name,
    fact.source_row,
    fact.source_cell,
    fact.contract_version,
    fact.review_status,
    fact.review_revision,
    policy.usage_role,
    document.source_etag = fact.source_etag
      and document.is_deleted = false as source_version_current,
    document.company_id = fact.company_id as company_matches,
    document.period_year = extract(year from fact.period_month)::integer
      and document.period_month = extract(month from fact.period_month)::integer
      as period_matches,
    publication.id is not null as month_published,
    max(fact.amount) filter (where fact.metric = 'revenue')
      over (partition by fact.document_id, fact.source_etag, fact.period_month)
      as revenue,
    max(fact.amount) filter (where fact.metric = 'expense')
      over (partition by fact.document_id, fact.source_etag, fact.period_month)
      as expense,
    max(fact.amount) filter (where fact.metric = 'net_result')
      over (partition by fact.document_id, fact.source_etag, fact.period_month)
      as net_result
  from public.financial_extracted_rows fact
  join public.documents document on document.id = fact.document_id
  left join public.companies company on company.id = fact.company_id
  left join public.financial_review_document_policy policy
    on policy.document_id = fact.document_id
  left join public.financial_monthly_metrics_published publication
    on publication.company_id = fact.company_id
   and publication.period_month = fact.period_month
)
select
  company_name,
  period_month,
  document_id,
  file_name,
  fact_id,
  metric,
  amount,
  currency,
  sheet_name,
  source_row,
  source_cell,
  contract_version,
  review_status,
  review_revision,
  coalesce(usage_role, 'unclassified') as usage_role,
  source_version_current,
  company_matches,
  period_matches,
  month_published,
  case
    when contract_version <> 2 then 'NOT_APPLICABLE_LEGACY'
    when revenue is null or expense is null or net_result is null
      then 'REVIEW_MISSING_OPERANDS'
    when net_result = revenue - expense then 'PASS'
    else 'REVIEW_DIVERGENCE'
  end as math_validation,
  case
    when contract_version <> 2 then 'LEGACY_V1_NOT_ELIGIBLE'
    when month_published and review_status = 'approved' and usage_role = 'primary'
      then 'PUBLISHED_REFERENCE'
    when not source_version_current then 'SOURCE_VERSION_DIVERGED'
    when not company_matches or not period_matches then 'IDENTITY_DIVERGED'
    when currency <> 'BRL' then 'CURRENCY_DIVERGED'
    when period_month between date '2026-01-01' and date '2026-08-01'
      and (
        (metric = 'cash_available'
          and (sheet_name <> 'RESUMO KWM' or source_cell <> 'B10'))
        or (metric = 'revenue'
          and (sheet_name <> 'RECEITAS X DESPESAS KWN' or source_cell <> 'B23'))
        or (metric = 'expense'
          and (sheet_name <> 'RECEITAS X DESPESAS KWN' or source_cell <> 'B8'))
        or (metric = 'net_result'
          and (sheet_name <> 'RECEITAS X DESPESAS KWN' or source_cell <> 'B6'))
      )
      then 'PROVENANCE_DIVERGED'
    when revenue is null or expense is null or net_result is null
      or net_result <> revenue - expense then 'MATH_DIVERGED'
    when review_status = 'approved' and usage_role = 'primary'
      then 'ELIGIBLE_FOR_PUBLICATION'
    when review_status = 'approved' then 'NEEDS_PRIMARY_CLASSIFICATION'
    when review_status = 'pending_review' then 'ELIGIBLE_FOR_DOCUMENT_REVIEW'
    else 'NOT_ELIGIBLE'
  end as eligibility
from facts
order by period_month, contract_version desc, metric, fact_id;

rollback;
