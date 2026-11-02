-- Local-only staging authorization for the single synthetic 09B document.
-- This file must never be moved to supabase/migrations or applied remotely.
-- Run only after assert-local-isolation.ps1 succeeds with -RequireBaseline.
begin;

do $block$
declare
  v_legacy_count integer;
  v_legacy_fingerprint text;
begin
  if to_regnamespace('financial_test') is not null then
    raise exception 'Preflight failed: financial_test schema already exists';
  end if;

  -- This isolated baseline is intentionally loaded without Supabase migration
  -- history. Managed/remote projects must fail this local-only preflight.
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    raise exception 'Preflight failed: managed or remote migration history detected';
  end if;

  if to_regprocedure(
    'public.finance_publish_monthly_metrics(uuid,date,uuid[],uuid)'
  ) is null then
    raise exception 'Preflight failed: 10C publication RPC is missing';
  end if;

  if to_regprocedure(
    'public.finance_review_decide(uuid,text,text,integer)'
  ) is null or to_regprocedure(
    'public.finance_review_set_document_role(uuid,text,text)'
  ) is null then
    raise exception 'Preflight failed: operational review contract is missing';
  end if;

  select
    count(*),
    md5(coalesce(
      string_agg(md5(row_to_json(metric)::text), '' order by metric.id::text),
      ''
    ))
  into v_legacy_count, v_legacy_fingerprint
  from public.financial_monthly_metrics metric;

  if v_legacy_count <> 3
     or v_legacy_fingerprint <> '7c32b6f51d5791c7219e68a1dea5596b' then
    raise exception 'Preflight failed: local staging legacy baseline diverged';
  end if;

  if (select count(*) from public.financial_monthly_metrics_published) <> 0
     or (select count(*) from public.financial_extracted_rows) <> 0
     or (select count(*) from public.financial_review_document_policy) <> 0
     or (select count(*) from public.financial_review_audit) <> 0 then
    raise exception 'Preflight failed: local staging financial fixtures are not clean';
  end if;

  if not exists (
    select 1
    from public.documents document
    join public.companies company on company.id = document.company_id
    where document.id = '00000000-0000-4000-8000-0000000009e2'
      and document.owner_id = '08e9abae-db9c-46b4-81be-c90bf7ea04e5'
      and document.company_id = '6faa0c8b-733f-4406-91c9-638a4e93ee11'
      and document.file_name = 'TESTE_FINANCEIRO_09B_SINTETICO.xlsx'
      and document.source_etag = 'synthetic-local-sha256-2a5a4be80c428acf5c14c21bfc214d8020215ddbc95eb1f74c7161493de9e39a'
      and not document.is_deleted
      and company.owner_id = document.owner_id
      and company.name = 'Empresa Horizonte Local'
      and company.is_active
  ) then
    raise exception 'Preflight failed: allowlisted local synthetic document diverged';
  end if;
end;
$block$;

create schema financial_test authorization postgres;
revoke all on schema financial_test from public, anon, authenticated, service_role;
grant usage on schema financial_test to service_role;

create table financial_test.authorized_documents (
  document_id uuid primary key,
  owner_id uuid not null,
  company_id uuid not null,
  expected_file_name text not null,
  expected_source_etag text not null,
  authorized_at timestamptz not null default now()
);

alter table financial_test.authorized_documents enable row level security;
revoke all on table financial_test.authorized_documents
  from public, anon, authenticated, service_role;

insert into financial_test.authorized_documents (
  document_id,
  owner_id,
  company_id,
  expected_file_name,
  expected_source_etag
) values (
  '00000000-0000-4000-8000-0000000009e2',
  '08e9abae-db9c-46b4-81be-c90bf7ea04e5',
  '6faa0c8b-733f-4406-91c9-638a4e93ee11',
  'TESTE_FINANCEIRO_09B_SINTETICO.xlsx',
  'synthetic-local-sha256-2a5a4be80c428acf5c14c21bfc214d8020215ddbc95eb1f74c7161493de9e39a'
);

create function financial_test.authorize_primary_source(
  p_document_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document public.documents%rowtype;
  v_company public.companies%rowtype;
  v_allowed financial_test.authorized_documents%rowtype;
  v_old_role text;
begin
  if p_document_id is null or p_actor_id is null then
    raise exception 'Documento e ator sao obrigatorios';
  end if;

  if length(btrim(coalesce(p_reason, ''))) not between 8 and 500 then
    raise exception 'Justificativa obrigatoria (8 a 500 caracteres)';
  end if;

  select * into v_allowed
  from financial_test.authorized_documents
  where document_id = p_document_id;

  if not found then
    raise exception 'Documento sintetico nao autorizado neste staging';
  end if;

  select * into v_document
  from public.documents
  where id = p_document_id
  for update;

  if not found
     or v_document.owner_id is distinct from v_allowed.owner_id
     or v_document.company_id is distinct from v_allowed.company_id
     or v_document.file_name is distinct from v_allowed.expected_file_name
     or v_document.source_etag is distinct from v_allowed.expected_source_etag
     or v_document.is_deleted then
    raise exception 'Documento allowlisted divergiu da proveniencia autorizada';
  end if;

  select * into v_company
  from public.companies
  where id = v_document.company_id
    and owner_id = v_document.owner_id
    and is_active;

  if not found then
    raise exception 'Empresa inexistente, inativa ou divergente';
  end if;

  if p_actor_id is distinct from v_company.owner_id
     and not exists (
       select 1
       from public.company_members member
       where member.company_id = v_company.id
         and member.user_id = p_actor_id
         and member.role = 'admin'
     ) then
    raise exception 'Ator nao autorizado para classificar a fonte';
  end if;

  if exists (
    select 1
    from public.financial_extracted_rows fact
    where fact.document_id = v_document.id
      and fact.owner_id = v_document.owner_id
      and fact.review_status = 'approved'
  ) then
    raise exception 'Documento com linhas aprovadas: revisar antes de reclassificar';
  end if;

  select usage_role into v_old_role
  from public.financial_review_document_policy
  where document_id = v_document.id
    and owner_id = v_document.owner_id
  for update;

  v_old_role := coalesce(v_old_role, 'unclassified');

  insert into public.financial_review_document_policy (
    document_id, owner_id, usage_role, changed_by, changed_at
  ) values (
    v_document.id, v_document.owner_id, 'primary', p_actor_id, now()
  )
  on conflict (document_id) do update set
    owner_id = excluded.owner_id,
    usage_role = excluded.usage_role,
    changed_by = excluded.changed_by,
    changed_at = excluded.changed_at;

  insert into public.financial_review_audit (
    owner_id, document_id, actor_id, event_type, old_value, new_value,
    reason, source_etag, snapshot
  ) values (
    v_document.owner_id,
    v_document.id,
    p_actor_id,
    'classify_source',
    v_old_role,
    'primary',
    btrim(p_reason),
    v_document.source_etag,
    jsonb_build_object(
      'file_name', v_document.file_name,
      'staging_test_authorization', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'changed', v_old_role <> 'primary',
    'usage_role', 'primary',
    'staging_test_authorization', true
  );
end;
$function$;

create function financial_test.approve_extracted_row(
  p_row_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.financial_extracted_rows%rowtype;
  v_document public.documents%rowtype;
  v_company public.companies%rowtype;
  v_allowed financial_test.authorized_documents%rowtype;
begin
  if p_row_id is null or p_actor_id is null then
    raise exception 'Linha e ator sao obrigatorios';
  end if;

  if length(btrim(coalesce(p_reason, ''))) not between 8 and 500 then
    raise exception 'Justificativa obrigatoria (8 a 500 caracteres)';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Revisao obrigatoria';
  end if;

  select * into v_row
  from public.financial_extracted_rows
  where id = p_row_id
  for update;

  if not found then
    raise exception 'Linha inexistente';
  end if;

  select * into v_allowed
  from financial_test.authorized_documents
  where document_id = v_row.document_id;

  if not found then
    raise exception 'Documento sintetico nao autorizado neste staging';
  end if;

  select * into v_document
  from public.documents
  where id = v_row.document_id
  for share;

  if not found
     or v_document.is_deleted
     or v_document.owner_id is distinct from v_allowed.owner_id
     or v_document.company_id is distinct from v_allowed.company_id
     or v_document.file_name is distinct from v_allowed.expected_file_name
     or v_document.source_etag is distinct from v_allowed.expected_source_etag
     or v_row.owner_id is distinct from v_document.owner_id
     or v_row.company_id is distinct from v_document.company_id
     or v_row.source_etag is distinct from v_document.source_etag then
    raise exception 'Empresa, proprietario, documento ou ETag divergente';
  end if;

  select * into v_company
  from public.companies
  where id = v_row.company_id
    and owner_id = v_row.owner_id
    and is_active;

  if not found then
    raise exception 'Empresa inexistente, inativa ou divergente';
  end if;

  if p_actor_id is distinct from v_company.owner_id
     and not exists (
       select 1
       from public.company_members member
       where member.company_id = v_company.id
         and member.user_id = p_actor_id
         and member.role in ('admin', 'reviewer')
     ) then
    raise exception 'Ator nao autorizado para revisar a linha';
  end if;

  if v_row.review_status <> 'pending_review' then
    raise exception 'Linha ja revisada';
  end if;

  if v_row.review_revision <> p_expected_revision then
    raise exception 'Revisao desatualizada';
  end if;

  if v_row.contract_version <> 2
     or v_row.logical_key is null
     or v_row.source_cell is null
     or v_row.metric not in ('revenue', 'expense', 'net_result', 'cash_available') then
    raise exception 'Linha nao pertence ao contrato financeiro canonico v2';
  end if;

  if not exists (
    select 1
    from public.financial_review_document_policy policy
    where policy.document_id = v_document.id
      and policy.owner_id = v_document.owner_id
      and policy.usage_role = 'primary'
  ) then
    raise exception 'Documento nao classificado como fonte primaria';
  end if;

  update public.financial_extracted_rows
  set review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      review_note = btrim(p_reason),
      review_revision = review_revision + 1
  where id = v_row.id
    and review_status = 'pending_review'
    and review_revision = p_expected_revision;

  if not found then
    raise exception 'Transicao de revisao concorrente';
  end if;

  insert into public.financial_review_audit (
    owner_id, document_id, extraction_row_id, actor_id, event_type,
    old_value, new_value, reason, source_etag, snapshot
  ) values (
    v_row.owner_id,
    v_document.id,
    v_row.id,
    p_actor_id,
    'approve',
    v_row.review_status,
    'approved',
    btrim(p_reason),
    v_row.source_etag,
    jsonb_build_object(
      'company_id', v_row.company_id,
      'company_name', v_row.source_company_name,
      'period_month', v_row.period_month,
      'metric', v_row.metric,
      'amount', v_row.amount,
      'currency', v_row.currency,
      'sheet_name', v_row.sheet_name,
      'source_row', v_row.source_row,
      'file_name', v_document.file_name,
      'staging_test_authorization', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'row_id', v_row.id,
    'review_status', 'approved',
    'review_revision', v_row.review_revision + 1,
    'staging_test_authorization', true
  );
end;
$function$;

alter function financial_test.authorize_primary_source(uuid,uuid,text)
  owner to postgres;
alter function financial_test.approve_extracted_row(uuid,uuid,text,integer)
  owner to postgres;

revoke all on function financial_test.authorize_primary_source(uuid,uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function financial_test.approve_extracted_row(uuid,uuid,text,integer)
  from public, anon, authenticated, service_role;

grant execute on function financial_test.authorize_primary_source(uuid,uuid,text)
  to service_role;
grant execute on function financial_test.approve_extracted_row(uuid,uuid,text,integer)
  to service_role;

comment on schema financial_test is
  'Local staging-only financial authorization. Never migrate or apply remotely.';

commit;
