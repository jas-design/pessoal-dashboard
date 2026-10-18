begin;

-- financial_transactions is intentionally untouched until its real policies
-- and consumers are captured by the 07C preflight.

do $block$
declare
  v_missing_columns text;
begin
  select string_agg(expected.table_name || '.' || expected.column_name, ', ')
  into v_missing_columns
  from (values
    ('companies', 'id'),
    ('companies', 'owner_id'),
    ('companies', 'name'),
    ('companies', 'is_active'),
    ('documents', 'id'),
    ('documents', 'owner_id'),
    ('documents', 'source_etag'),
    ('documents', 'file_name'),
    ('documents', 'is_deleted'),
    ('financial_extracted_rows', 'id'),
    ('financial_extracted_rows', 'document_id'),
    ('financial_extracted_rows', 'owner_id'),
    ('financial_extracted_rows', 'source_etag'),
    ('financial_extracted_rows', 'company_id'),
    ('financial_extracted_rows', 'source_company_name'),
    ('financial_extracted_rows', 'period_month'),
    ('financial_extracted_rows', 'metric'),
    ('financial_extracted_rows', 'amount'),
    ('financial_extracted_rows', 'currency'),
    ('financial_extracted_rows', 'sheet_name'),
    ('financial_extracted_rows', 'source_row'),
    ('financial_extracted_rows', 'review_status'),
    ('financial_extracted_rows', 'review_revision'),
    ('financial_extracted_rows', 'review_note'),
    ('financial_extracted_rows', 'reviewed_at'),
    ('financial_extracted_rows', 'reviewed_by'),
    ('financial_extracted_rows', 'created_at'),
    ('financial_review_document_policy', 'document_id'),
    ('financial_review_document_policy', 'owner_id'),
    ('financial_review_document_policy', 'usage_role'),
    ('financial_review_document_policy', 'changed_by'),
    ('financial_review_document_policy', 'changed_at'),
    ('financial_review_audit', 'owner_id'),
    ('financial_review_audit', 'document_id'),
    ('financial_review_audit', 'extraction_row_id'),
    ('financial_review_audit', 'actor_id'),
    ('financial_review_audit', 'event_type'),
    ('financial_review_audit', 'old_value'),
    ('financial_review_audit', 'new_value'),
    ('financial_review_audit', 'reason'),
    ('financial_review_audit', 'source_etag'),
    ('financial_review_audit', 'snapshot')
  ) as expected(table_name, column_name)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
  where actual.column_name is null;

  if v_missing_columns is not null then
    raise exception 'Preflight failed: missing columns: %', v_missing_columns;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_review_document_policy'
      and con.contype in ('p', 'u')
      and (
        select array_agg(a.attname order by key_column.ordinality)
        from unnest(con.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_catalog.pg_attribute a
          on a.attrelid = con.conrelid
         and a.attnum = key_column.attnum
      ) = array['document_id']::name[]
  ) then
    raise exception
      'Preflight failed: financial_review_document_policy requires UNIQUE(document_id)';
  end if;
end;
$block$;

create or replace function financial_private.finance_review_list_impl(
  p_status text default 'pending_review'::text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_total bigint;
  v_items jsonb;
begin
  if v_actor is null then raise exception 'Autenticacao obrigatoria'; end if;
  if p_status is null or p_status not in ('pending_review','approved','rejected','all') then
    raise exception 'Status de revisao invalido';
  end if;
  if p_limit not between 1 and 100 or p_offset not between 0 and 100000 then
    raise exception 'Paginacao invalida';
  end if;

  select count(*) into v_total
  from public.financial_extracted_rows f
  join public.documents d on d.id = f.document_id
  left join public.companies c
    on c.id = f.company_id
   and c.owner_id = f.owner_id
  where d.owner_id = f.owner_id
    and (
      (
        f.company_id is null
        and f.owner_id = v_actor
      )
      or (
        f.company_id is not null
        and c.id is not null
        and public.company_can_view_financial_review(f.company_id)
      )
    )
    and (p_status = 'all' or f.review_status = p_status);

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc, t.id), '[]'::jsonb)
  into v_items
  from (
    select f.id, f.document_id, f.source_etag, f.company_id,
      c.name as company_name, f.source_company_name, f.period_month,
      f.metric, f.amount, f.currency, f.sheet_name, f.source_row,
      f.review_status, f.review_revision, f.review_note, f.reviewed_at,
      f.reviewed_by, f.created_at, d.file_name, d.is_deleted,
      (d.source_etag is not distinct from f.source_etag) as source_version_current,
      coalesce(p.usage_role, 'unclassified') as source_usage_role,
      true as can_view,
      (
        f.review_status = 'pending_review'
        and not d.is_deleted
        and d.source_etag is not distinct from f.source_etag
        and (
          (f.company_id is null and f.owner_id = v_actor)
          or (
            f.company_id is not null
            and public.company_can_decide_financial_review(f.company_id)
          )
        )
      ) as can_decide,
      (
        not d.is_deleted
        and not exists (
          select 1
          from public.financial_extracted_rows approved_row
          where approved_row.document_id = d.id
            and approved_row.owner_id = d.owner_id
            and approved_row.review_status = 'approved'
        )
        and (
          d.owner_id = v_actor
          or (
            f.company_id is not null
            and public.company_can_classify_financial_source(f.company_id)
            and 1 = (
              select count(distinct document_row.company_id)
              from public.financial_extracted_rows document_row
              where document_row.document_id = d.id
                and document_row.owner_id = d.owner_id
                and document_row.company_id is not null
            )
          )
        )
      ) as can_classify
    from public.financial_extracted_rows f
    join public.documents d on d.id = f.document_id
    left join public.companies c
      on c.id = f.company_id
     and c.owner_id = f.owner_id
    left join public.financial_review_document_policy p
      on p.document_id = d.id
     and p.owner_id = f.owner_id
    where d.owner_id = f.owner_id
      and (
        (
          f.company_id is null
          and f.owner_id = v_actor
        )
        or (
          f.company_id is not null
          and c.id is not null
          and public.company_can_view_financial_review(f.company_id)
        )
      )
      and (p_status = 'all' or f.review_status = p_status)
    order by f.created_at desc, f.id
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total',v_total,'items',v_items);
end;
$function$;

create or replace function financial_private.finance_review_history_impl(
  p_row_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.financial_extracted_rows%rowtype;
  v_doc public.documents%rowtype;
  v_company public.companies%rowtype;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Autenticacao obrigatoria'; end if;
  if p_limit not between 1 and 100 then raise exception 'Limite invalido'; end if;

  select * into v_row
  from public.financial_extracted_rows
  where id = p_row_id;

  if not found then raise exception 'Linha nao encontrada'; end if;

  select * into v_doc
  from public.documents
  where id = v_row.document_id
    and owner_id = v_row.owner_id;

  if not found then raise exception 'Linha nao encontrada'; end if;

  if v_row.company_id is null then
    if v_row.owner_id <> v_actor then raise exception 'Linha nao encontrada'; end if;
  else
    select * into v_company
    from public.companies
    where id = v_row.company_id
      and owner_id = v_row.owner_id;

    if not found
      or not public.company_can_view_financial_review(v_row.company_id)
    then
      raise exception 'Linha nao encontrada';
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb)
  into v_result
  from (
    select id,event_type,old_value,new_value,reason,actor_id,created_at
    from public.financial_review_audit
    where extraction_row_id = p_row_id
      and owner_id = v_row.owner_id
    order by created_at desc
    limit p_limit
  ) t;

  return v_result;
end;
$function$;

create or replace function financial_private.finance_review_decide_impl(
  p_row_id uuid,
  p_action text,
  p_reason text,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.financial_extracted_rows%rowtype;
  v_doc public.documents%rowtype;
  v_company public.companies%rowtype;
  v_role text;
  v_new_status text;
begin
  if v_actor is null then raise exception 'Autenticacao obrigatoria'; end if;
  if p_action is null or p_action not in ('approve','reject') then raise exception 'Acao invalida'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then
    raise exception 'Justificativa obrigatoria (8 a 500 caracteres)';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Revisao obrigatoria';
  end if;

  select * into v_row
  from public.financial_extracted_rows
  where id = p_row_id
  for update;

  if not found then raise exception 'Linha inexistente ou nao autorizada'; end if;

  if v_row.company_id is null then
    if v_row.owner_id <> v_actor then raise exception 'Linha inexistente ou nao autorizada'; end if;
  else
    select * into v_company
    from public.companies
    where id = v_row.company_id
      and owner_id = v_row.owner_id;

    if not found or not public.company_can_decide_financial_review(v_row.company_id) then
      raise exception 'Linha inexistente ou nao autorizada';
    end if;
  end if;

  if v_row.review_status <> 'pending_review' then raise exception 'Linha ja revisada'; end if;
  if v_row.review_revision <> p_expected_revision then raise exception 'Revisao desatualizada'; end if;

  select * into v_doc
  from public.documents
  where id = v_row.document_id
    and owner_id = v_row.owner_id
  for share;

  if not found or v_doc.is_deleted then raise exception 'Documento indisponivel'; end if;
  if v_doc.source_etag is distinct from v_row.source_etag then
    raise exception 'Versao do arquivo mudou: reextrair antes da revisao';
  end if;

  if p_action = 'approve' then
    if v_doc.file_name ~* '^TESTE_' then
      raise exception 'Arquivos de teste nao podem ser aprovados';
    end if;
    if v_row.company_id is null then raise exception 'Empresa nao vinculada'; end if;
    if not v_company.is_active then raise exception 'Empresa inexistente ou inativa'; end if;

    select usage_role into v_role
    from public.financial_review_document_policy
    where document_id = v_doc.id
      and owner_id = v_row.owner_id;

    if coalesce(v_role,'unclassified') <> 'primary' then
      raise exception 'Classifique o documento como fonte primaria antes de aprovar';
    end if;
    v_new_status := 'approved';
  else
    v_new_status := 'rejected';
  end if;

  update public.financial_extracted_rows
  set review_status = v_new_status,
      reviewed_at = now(),
      reviewed_by = v_actor,
      review_note = btrim(p_reason),
      review_revision = review_revision + 1
  where id = v_row.id
    and owner_id = v_row.owner_id;

  insert into public.financial_review_audit
    (owner_id,document_id,extraction_row_id,actor_id,event_type,
     old_value,new_value,reason,source_etag,snapshot)
  values
    (v_row.owner_id,v_doc.id,v_row.id,v_actor,p_action,
     v_row.review_status,v_new_status,btrim(p_reason),v_row.source_etag,
     jsonb_build_object('company_id',v_row.company_id,
       'company_name',v_row.source_company_name,
       'period_month',v_row.period_month,'metric',v_row.metric,
       'amount',v_row.amount,'currency',v_row.currency,
       'sheet_name',v_row.sheet_name,'source_row',v_row.source_row,
       'file_name',v_doc.file_name));

  return jsonb_build_object('success',true,'row_id',v_row.id,
    'review_status',v_new_status,'review_revision',v_row.review_revision+1,
    'finance_dashboard_updated',false);
end;
$function$;

create or replace function financial_private.finance_review_set_document_role_impl(
  p_document_id uuid,
  p_usage_role text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_company_id uuid;
  v_company_count integer;
  v_old_role text;
begin
  if v_actor is null then raise exception 'Autenticacao obrigatoria'; end if;
  if p_usage_role is null or p_usage_role not in ('primary','supporting','unclassified') then
    raise exception 'Classificacao invalida';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then
    raise exception 'Justificativa obrigatoria (8 a 500 caracteres)';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then raise exception 'Documento nao encontrado ou nao autorizado'; end if;

  select count(distinct f.company_id), min(f.company_id::text)::uuid
  into v_company_count, v_company_id
  from public.financial_extracted_rows f
  join public.companies c
    on c.id = f.company_id
   and c.owner_id = f.owner_id
  where f.document_id = p_document_id
    and f.owner_id = v_doc.owner_id
    and f.company_id is not null;

  if v_actor <> v_doc.owner_id then
    if v_company_count <> 1
      or not public.company_can_classify_financial_source(v_company_id)
    then
      raise exception 'Documento nao encontrado ou nao autorizado';
    end if;
  end if;

  if v_doc.is_deleted then raise exception 'Documento excluido'; end if;
  if p_usage_role = 'primary' and v_doc.file_name ~* '^TESTE_' then
    raise exception 'Arquivos de teste nao podem ser fontes primarias';
  end if;
  if exists (
    select 1
    from public.financial_extracted_rows f
    where f.document_id = p_document_id
      and f.owner_id = v_doc.owner_id
      and f.review_status = 'approved'
  ) then
    raise exception 'Documento com linhas aprovadas: revisar antes de reclassificar';
  end if;

  select usage_role into v_old_role
  from public.financial_review_document_policy
  where document_id = p_document_id
    and owner_id = v_doc.owner_id
  for update;

  v_old_role := coalesce(v_old_role, 'unclassified');
  if v_old_role = p_usage_role then
    return jsonb_build_object('success',true,'changed',false,'usage_role',p_usage_role);
  end if;

  insert into public.financial_review_document_policy
    (document_id,owner_id,usage_role,changed_by,changed_at)
  values (p_document_id,v_doc.owner_id,p_usage_role,v_actor,now())
  on conflict (document_id) do update set
    usage_role = excluded.usage_role,
    changed_by = excluded.changed_by,
    changed_at = now();

  insert into public.financial_review_audit
    (owner_id,document_id,actor_id,event_type,old_value,new_value,reason,source_etag,snapshot)
  values
    (v_doc.owner_id,p_document_id,v_actor,'classify_source',v_old_role,p_usage_role,
     btrim(p_reason),v_doc.source_etag,
     jsonb_build_object('file_name',v_doc.file_name));

  return jsonb_build_object('success',true,'changed',true,'usage_role',p_usage_role);
end;
$function$;

revoke all on function public.finance_review_list(text,integer,integer) from public, anon;
revoke all on function public.finance_review_decide(uuid,text,text,integer) from public, anon;
revoke all on function public.finance_review_history(uuid,integer) from public, anon;
revoke all on function public.finance_review_set_document_role(uuid,text,text) from public, anon;

grant execute on function public.finance_review_list(text,integer,integer)
  to authenticated, service_role;
grant execute on function public.finance_review_decide(uuid,text,text,integer)
  to authenticated, service_role;
grant execute on function public.finance_review_history(uuid,integer)
  to authenticated, service_role;
grant execute on function public.finance_review_set_document_role(uuid,text,text)
  to authenticated, service_role;

revoke all on function financial_private.finance_review_list_impl(text,integer,integer)
  from public, anon;
revoke all on function financial_private.finance_review_decide_impl(uuid,text,text,integer)
  from public, anon;
revoke all on function financial_private.finance_review_history_impl(uuid,integer)
  from public, anon;
revoke all on function financial_private.finance_review_set_document_role_impl(uuid,text,text)
  from public, anon;

-- Temporary compatibility grants. The next versioned migration converts the
-- public wrappers to SECURITY DEFINER before removing this direct access.
grant execute on function financial_private.finance_review_list_impl(text,integer,integer)
  to authenticated, service_role;
grant execute on function financial_private.finance_review_decide_impl(uuid,text,text,integer)
  to authenticated, service_role;
grant execute on function financial_private.finance_review_history_impl(uuid,integer)
  to authenticated, service_role;
grant execute on function financial_private.finance_review_set_document_role_impl(uuid,text,text)
  to authenticated, service_role;

commit;
