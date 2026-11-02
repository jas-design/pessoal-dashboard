begin;

-- This publication layer is additive. Legacy monthly tables remain untouched
-- because their rows have no verified company or source provenance.
do $block$
declare
  v_missing_columns text;
begin
  if to_regclass('public.financial_monthly_metrics_published') is not null then
    raise exception 'Preflight failed: financial_monthly_metrics_published already exists';
  end if;

  if to_regprocedure(
    'public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)'
  ) is not null then
    raise exception 'Preflight failed: finance_publish_monthly_metrics already exists';
  end if;

  if to_regprocedure(
    'public.finance_monthly_publication_status(uuid,date)'
  ) is not null then
    raise exception 'Preflight failed: finance_monthly_publication_status already exists';
  end if;

  select string_agg(expected.table_name || '.' || expected.column_name, ', ')
  into v_missing_columns
  from (values
    ('companies', 'id'),
    ('companies', 'owner_id'),
    ('companies', 'is_active'),
    ('company_members', 'company_id'),
    ('company_members', 'user_id'),
    ('company_members', 'role'),
    ('documents', 'id'),
    ('documents', 'owner_id'),
    ('documents', 'company_id'),
    ('documents', 'source_etag'),
    ('documents', 'is_deleted'),
    ('financial_extracted_rows', 'id'),
    ('financial_extracted_rows', 'owner_id'),
    ('financial_extracted_rows', 'document_id'),
    ('financial_extracted_rows', 'source_etag'),
    ('financial_extracted_rows', 'company_id'),
    ('financial_extracted_rows', 'period_month'),
    ('financial_extracted_rows', 'metric'),
    ('financial_extracted_rows', 'amount'),
    ('financial_extracted_rows', 'currency'),
    ('financial_extracted_rows', 'review_status'),
    ('financial_extracted_rows', 'reviewed_at'),
    ('financial_extracted_rows', 'reviewed_by'),
    ('financial_extracted_rows', 'logical_key'),
    ('financial_extracted_rows', 'source_cell'),
    ('financial_extracted_rows', 'contract_version'),
    ('financial_review_document_policy', 'document_id'),
    ('financial_review_document_policy', 'owner_id'),
    ('financial_review_document_policy', 'usage_role')
  ) as expected(table_name, column_name)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
  where actual.column_name is null;

  if v_missing_columns is not null then
    raise exception 'Preflight failed: missing columns: %', v_missing_columns;
  end if;

  if to_regprocedure('public.company_can_view_financial_review(uuid)') is null then
    raise exception 'Preflight failed: company financial access helper is missing';
  end if;

  if to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'Preflight failed: extensions.digest(bytea,text) is missing';
  end if;
end;
$block$;

create table public.financial_monthly_metrics_published (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  period_month date not null,
  revenue numeric,
  expenses numeric,
  net_profit numeric,
  net_margin numeric,
  cash_balance numeric,
  currency text not null default 'BRL',
  source_document_id uuid not null references public.documents(id) on delete restrict,
  source_etag text not null,
  approved_extracted_row_ids uuid[] not null,
  approved_at timestamptz not null,
  published_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  source_digest text not null,
  constraint financial_monthly_metrics_published_period_check
    check (period_month = date_trunc('month', period_month)::date),
  constraint financial_monthly_metrics_published_revenue_check
    check (revenue is null or revenue between 0 and 999999999999.99),
  constraint financial_monthly_metrics_published_expenses_check
    check (expenses is null or expenses between 0 and 999999999999.99),
  constraint financial_monthly_metrics_published_net_profit_check
    check (net_profit is null or abs(net_profit) <= 999999999999.99),
  constraint financial_monthly_metrics_published_net_margin_check
    check (net_margin is null or abs(net_margin) <= 999999.9999),
  constraint financial_monthly_metrics_published_cash_balance_check
    check (cash_balance is null or abs(cash_balance) <= 999999999999.99),
  constraint financial_monthly_metrics_published_currency_check
    check (currency = 'BRL'),
  constraint financial_monthly_metrics_published_etag_check
    check (
      length(source_etag) between 1 and 512
      and source_etag !~ '[[:cntrl:]]'
    ),
  constraint financial_monthly_metrics_published_rows_check
    check (cardinality(approved_extracted_row_ids) between 1 and 4),
  constraint financial_monthly_metrics_published_digest_check
    check (source_digest ~ '^[0-9a-f]{64}$'),
  constraint financial_monthly_metrics_published_company_period_key
    unique (company_id, period_month),
  constraint financial_monthly_metrics_published_source_digest_key
    unique (source_digest)
);

comment on table public.financial_monthly_metrics_published is
  'Immutable company-scoped monthly metrics published from approved canonical extraction facts.';

comment on column public.financial_monthly_metrics_published.net_margin is
  'Nullable by design. The canonical v2 extraction contract has no margin fact, so publication does not infer it.';

create index financial_monthly_metrics_published_company_period_idx
  on public.financial_monthly_metrics_published (company_id, period_month desc);

alter table public.financial_monthly_metrics_published enable row level security;

revoke all on table public.financial_monthly_metrics_published
  from public, anon, authenticated, service_role;
grant select on table public.financial_monthly_metrics_published
  to authenticated, service_role;

create policy "Company members can view published financial metrics"
on public.financial_monthly_metrics_published
for select
to authenticated
using (public.company_can_view_financial_review(company_id));

create or replace function public.finance_publish_monthly_metrics(
  p_company_id uuid,
  p_period_month date,
  p_approved_extracted_row_ids uuid[],
  p_published_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_company public.companies%rowtype;
  v_document public.documents%rowtype;
  v_row public.financial_extracted_rows%rowtype;
  v_existing public.financial_monthly_metrics_published%rowtype;
  v_row_id uuid;
  v_distinct_row_count integer;
  v_source_document_id uuid;
  v_source_etag text;
  v_approved_at timestamptz;
  v_revenue numeric;
  v_expenses numeric;
  v_net_profit numeric;
  v_cash_balance numeric;
  v_has_revenue boolean := false;
  v_has_expenses boolean := false;
  v_has_net_profit boolean := false;
  v_has_cash_balance boolean := false;
  v_source_payload jsonb;
  v_source_digest text;
  v_published_id uuid;
begin
  if p_company_id is null
     or p_period_month is null
     or p_period_month <> date_trunc('month', p_period_month)::date
     or p_approved_extracted_row_ids is null
     or cardinality(p_approved_extracted_row_ids) not between 1 and 4
     or p_published_by is null then
    raise exception 'Payload de publicacao financeira invalido';
  end if;

  select count(distinct row_id)
  into v_distinct_row_count
  from unnest(p_approved_extracted_row_ids) as row_id;

  if v_distinct_row_count <> cardinality(p_approved_extracted_row_ids)
     or array_position(p_approved_extracted_row_ids, null) is not null then
    raise exception 'Publicacao contem identidades de fatos invalidas ou duplicadas';
  end if;

  select *
  into v_company
  from public.companies
  where id = p_company_id
    and is_active = true;

  if not found then
    raise exception 'Empresa inexistente ou inativa';
  end if;

  if v_company.owner_id is distinct from p_published_by
     and not exists (
       select 1
       from public.company_members member
       where member.company_id = p_company_id
         and member.user_id = p_published_by
         and member.role in ('admin', 'reviewer')
     ) then
    raise exception 'Publicador nao autorizado para a empresa';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_company_id::text || ':' || p_period_month::text,
      0
    )
  );

  foreach v_row_id in array p_approved_extracted_row_ids
  loop
    select *
    into v_row
    from public.financial_extracted_rows
    where id = v_row_id
    for share;

    if not found
       or v_row.contract_version <> 2
       or v_row.review_status <> 'approved'
       or v_row.reviewed_at is null
       or v_row.reviewed_by is null
       or v_row.logical_key is null
       or v_row.source_cell is null
       or v_row.company_id is distinct from p_company_id
       or v_row.owner_id is distinct from v_company.owner_id
       or v_row.period_month is distinct from p_period_month
       or v_row.currency <> 'BRL'
       or v_row.metric not in ('revenue', 'expense', 'net_result', 'cash_available') then
      raise exception 'Publicacao exige fatos canonicos v2 aprovados da empresa e competencia informadas';
    end if;

    if v_source_document_id is null then
      v_source_document_id := v_row.document_id;
      v_source_etag := v_row.source_etag;
    elsif v_source_document_id is distinct from v_row.document_id
       or v_source_etag is distinct from v_row.source_etag then
      raise exception 'Publicacao deve usar uma unica versao de documento primario';
    end if;

    v_approved_at := greatest(
      coalesce(v_approved_at, v_row.reviewed_at),
      v_row.reviewed_at
    );

    case v_row.metric
      when 'revenue' then
        if v_has_revenue then raise exception 'Fato de receita duplicado'; end if;
        v_revenue := v_row.amount;
        v_has_revenue := true;
      when 'expense' then
        if v_has_expenses then raise exception 'Fato de despesa duplicado'; end if;
        v_expenses := v_row.amount;
        v_has_expenses := true;
      when 'net_result' then
        if v_has_net_profit then raise exception 'Fato de resultado liquido duplicado'; end if;
        v_net_profit := v_row.amount;
        v_has_net_profit := true;
      when 'cash_available' then
        if v_has_cash_balance then raise exception 'Fato de saldo disponivel duplicado'; end if;
        v_cash_balance := v_row.amount;
        v_has_cash_balance := true;
    end case;
  end loop;

  select *
  into v_document
  from public.documents
  where id = v_source_document_id
  for share;

  if not found
     or v_document.is_deleted
     or v_document.owner_id is distinct from v_company.owner_id
     or v_document.company_id is distinct from p_company_id
     or v_document.source_etag is distinct from v_source_etag then
    raise exception 'Documento primario indisponivel, alterado ou fora da empresa';
  end if;

  if not exists (
    select 1
    from public.financial_review_document_policy policy
    where policy.document_id = v_source_document_id
      and policy.owner_id = v_company.owner_id
      and policy.usage_role = 'primary'
  ) then
    raise exception 'Documento deve estar classificado como fonte primaria';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', fact.id,
      'logical_key', fact.logical_key,
      'metric', fact.metric,
      'amount', fact.amount,
      'reviewed_at', fact.reviewed_at,
      'reviewed_by', fact.reviewed_by
    ) order by fact.metric, fact.id
  )
  into v_source_payload
  from public.financial_extracted_rows fact
  where fact.id = any(p_approved_extracted_row_ids);

  v_source_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'contract_version', 1,
          'company_id', p_company_id,
          'period_month', p_period_month,
          'source_document_id', v_source_document_id,
          'source_etag', v_source_etag,
          'facts', v_source_payload
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing
  from public.financial_monthly_metrics_published
  where company_id = p_company_id
    and period_month = p_period_month
  for update;

  if found then
    if v_existing.source_digest = v_source_digest
       and v_existing.approved_extracted_row_ids = (
         select array_agg(row_id order by row_id)
         from unnest(p_approved_extracted_row_ids) as row_id
       ) then
      return jsonb_build_object(
        'success', true,
        'status', 'unchanged',
        'publication_id', v_existing.id,
        'company_id', v_existing.company_id,
        'period_month', v_existing.period_month,
        'source_digest', v_existing.source_digest
      );
    end if;

    raise exception 'Conflito de publicacao: empresa e competencia ja possuem outra origem';
  end if;

  insert into public.financial_monthly_metrics_published (
    company_id,
    owner_id,
    period_month,
    revenue,
    expenses,
    net_profit,
    net_margin,
    cash_balance,
    currency,
    source_document_id,
    source_etag,
    approved_extracted_row_ids,
    approved_at,
    published_by,
    source_digest
  ) values (
    p_company_id,
    v_company.owner_id,
    p_period_month,
    v_revenue,
    v_expenses,
    v_net_profit,
    null,
    v_cash_balance,
    'BRL',
    v_source_document_id,
    v_source_etag,
    (select array_agg(row_id order by row_id)
     from unnest(p_approved_extracted_row_ids) as row_id),
    v_approved_at,
    p_published_by,
    v_source_digest
  )
  returning id into v_published_id;

  return jsonb_build_object(
    'success', true,
    'status', 'published',
    'publication_id', v_published_id,
    'company_id', p_company_id,
    'period_month', p_period_month,
    'source_digest', v_source_digest,
    'published_metrics', jsonb_build_object(
      'revenue', v_revenue,
      'expenses', v_expenses,
      'net_profit', v_net_profit,
      'net_margin', null,
      'cash_balance', v_cash_balance
    )
  );
end;
$function$;

create or replace function public.finance_monthly_publication_status(
  p_company_id uuid,
  p_period_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_pending_count integer;
  v_approved_count integer;
  v_rejected_count integer;
begin
  if v_actor is null then
    raise exception 'Autenticacao obrigatoria';
  end if;

  if p_company_id is null
     or p_period_month is null
     or p_period_month <> date_trunc('month', p_period_month)::date then
    raise exception 'Empresa e competencia validas sao obrigatorias';
  end if;

  if not public.company_can_view_financial_review(p_company_id) then
    raise exception 'Empresa inexistente ou nao autorizada';
  end if;

  if exists (
    select 1
    from public.financial_monthly_metrics_published publication
    where publication.company_id = p_company_id
      and publication.period_month = p_period_month
  ) then
    return jsonb_build_object('state', 'approved');
  end if;

  select
    count(*) filter (where fact.review_status = 'pending_review'),
    count(*) filter (where fact.review_status = 'approved'),
    count(*) filter (where fact.review_status = 'rejected')
  into v_pending_count, v_approved_count, v_rejected_count
  from public.financial_extracted_rows fact
  join public.documents document
    on document.id = fact.document_id
   and document.owner_id = fact.owner_id
   and document.company_id = fact.company_id
   and document.source_etag = fact.source_etag
   and not document.is_deleted
  join public.financial_review_document_policy policy
    on policy.document_id = fact.document_id
   and policy.owner_id = fact.owner_id
   and policy.usage_role = 'primary'
  where fact.company_id = p_company_id
    and fact.period_month = p_period_month
    and fact.contract_version = 2;

  return jsonb_build_object(
    'state', case
      when v_pending_count > 0 or v_approved_count > 0 then 'pending'
      else 'missing'
    end,
    'pending_count', v_pending_count,
    'approved_count', v_approved_count,
    'rejected_count', v_rejected_count
  );
end;
$function$;

alter function public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)
  owner to postgres;
alter function public.finance_monthly_publication_status(uuid,date)
  owner to postgres;

revoke all on function public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)
  to service_role;

revoke all on function public.finance_monthly_publication_status(uuid,date)
  from public, anon, authenticated, service_role;
grant execute on function public.finance_monthly_publication_status(uuid,date)
  to authenticated, service_role;

commit;
