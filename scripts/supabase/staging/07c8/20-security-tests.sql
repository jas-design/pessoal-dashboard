-- Etapa 07C.8: testes de autorização/RLS sobre fixtures sintéticas.
-- Requer psql, execução administrativa e as mesmas variáveis de usuário de
-- 10-synthetic-fixtures.sql. Todas as mutações do teste sofrem ROLLBACK.

\set ON_ERROR_STOP on

select :'confirm_isolated_staging' = '07C8_SYNTHETIC_ONLY' as confirmed \gset
\if :confirmed
\else
  \echo 'ABORTADO: informe -v confirm_isolated_staging=07C8_SYNTHETIC_ONLY'
  \quit 3
\endif

begin;

do $block$
begin
  if current_user <> 'postgres' then
    raise exception '07C8 tests: run as postgres to SET ROLE safely';
  end if;
end;
$block$;

create or replace function pg_temp.assert_true(p_name text, p_condition boolean)
returns text
language plpgsql
as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception 'FAILED: %', p_name;
  end if;
  return 'ok - ' || p_name;
end;
$function$;

create or replace function pg_temp.expect_error(
  p_name text,
  p_sql text,
  p_sqlstate text,
  p_message text default null
)
returns text
language plpgsql
as $function$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate
      and (p_message is null or position(p_message in sqlerrm) > 0)
    then
      return 'ok - ' || p_name;
    end if;
    raise exception 'FAILED: %; got [%] %', p_name, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: %; expected an error', p_name;
end;
$function$;

-- PostgreSQL 17 does not resolve the pg_temp alias in GRANT ON SCHEMA.
-- Resolve the session's real temporary schema name explicitly.
do $block$
declare
  v_temp_schema text := pg_my_temp_schema()::regnamespace::text;
begin
  execute format(
    'grant usage on schema %I to anon, authenticated, service_role',
    v_temp_schema
  );
  execute format(
    'grant execute on function %I.assert_true(text, boolean) to anon, authenticated, service_role',
    v_temp_schema
  );
  execute format(
    'grant execute on function %I.expect_error(text, text, text, text) to anon, authenticated, service_role',
    v_temp_schema
  );
end;
$block$;

-- anon: sem RPC de revisão, sem companies e sem linhas de documents por RLS.
set local role anon;
select pg_temp.expect_error(
  'anon cannot execute review wrapper',
  $$select public.finance_review_list('all', 100, 0)$$,
  '42501'
);
select pg_temp.expect_error(
  'anon cannot call private implementation',
  $$select financial_private.finance_review_list_impl('all', 10, 0)$$,
  '42501'
);
select pg_temp.expect_error(
  'anon cannot select companies',
  $$select count(*) from public.companies$$,
  '42501'
);
select pg_temp.assert_true(
  'anon sees no documents',
  (select count(*) = 0 from public.documents)
);
reset role;

-- Sem vínculo: nenhuma empresa e nenhuma revisão.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'unlinked_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'unlinked_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'unlinked user sees no companies',
  not public.is_admin()
  and public.current_user_role() = 'user'
  and (select count(*) = 0 from public.companies)
);
select pg_temp.assert_true(
  'unlinked user sees no review rows',
  ((public.finance_review_list('all', 100, 0)->>'total')::integer = 0)
);
reset role;

-- Owner A: acesso total a A, sem acesso a B; divergência visível só para diagnóstico.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'owner_a_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'owner role and capabilities',
  not public.is_admin()
  and public.current_user_role() = 'user'
  and public.company_access_role('07c80000-0000-4000-8000-000000000001'::uuid) = 'owner'
  and public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and public.company_can_decide_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and public.company_can_classify_financial_source('07c80000-0000-4000-8000-000000000001'::uuid)
  and not public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000002'::uuid)
);
select pg_temp.assert_true(
  'owner A review list excludes company B',
  ((public.finance_review_list('all', 100, 0)->>'total')::integer = 4)
);
select pg_temp.assert_true(
  'owner A sees all delegated memberships for A',
  (
    select count(*) = 3
    from public.company_members
    where company_id = '07c80000-0000-4000-8000-000000000001'::uuid
  )
);
insert into public.company_members (company_id, user_id, role)
values (
  '07c80000-0000-4000-8000-000000000001'::uuid,
  :'unlinked_id'::uuid,
  'viewer'
);
delete from public.company_members
where company_id = '07c80000-0000-4000-8000-000000000001'::uuid
  and user_id = :'unlinked_id'::uuid;
select pg_temp.assert_true(
  'mismatched row is diagnostic and not decidable',
  exists (
    select 1
    from jsonb_array_elements(public.finance_review_list('all', 100, 0)->'items') item
    where item->>'id' = '07c80200-0000-4000-8000-000000000003'
      and (item->>'can_decide')::boolean = false
  )
);
select pg_temp.expect_error(
  'company mismatch blocks owner decision',
  $$select public.finance_review_decide(
    '07c80200-0000-4000-8000-000000000003'::uuid,
    'reject', 'Divergencia sintetica confirmada', 0
  )$$,
  'P0001',
  'Linha inexistente ou nao autorizada'
);
reset role;

-- Papéis delegados: capabilities calculadas no banco.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_a_id', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'admin_a_id', 'role', 'authenticated')::text, true);
select pg_temp.assert_true(
  'company admin can view decide and classify A only',
  not public.is_admin()
  and public.current_user_role() = 'user'
  and public.company_access_role('07c80000-0000-4000-8000-000000000001'::uuid) = 'admin'
  and public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and public.company_can_decide_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and public.company_can_classify_financial_source('07c80000-0000-4000-8000-000000000001'::uuid)
  and not public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000002'::uuid)
);
select pg_temp.expect_error(
  'delegated admin cannot grant company membership',
  format(
    $sql$insert into public.company_members (company_id, user_id, role)
         values ('07c80000-0000-4000-8000-000000000001'::uuid, %L::uuid, 'viewer')$sql$,
    :'unlinked_id'
  ),
  '42501'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'reviewer_a_id', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'reviewer_a_id', 'role', 'authenticated')::text, true);
select pg_temp.assert_true(
  'reviewer can view and decide but cannot classify',
  not public.is_admin()
  and public.current_user_role() = 'user'
  and public.company_access_role('07c80000-0000-4000-8000-000000000001'::uuid) = 'reviewer'
  and public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and public.company_can_decide_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and not public.company_can_classify_financial_source('07c80000-0000-4000-8000-000000000001'::uuid)
);
select pg_temp.assert_true(
  'reviewer A sees only coherent company A rows',
  ((public.finance_review_list('all', 100, 0)->>'total')::integer = 2)
);
select pg_temp.expect_error(
  'stale revision is rejected',
  $$select public.finance_review_decide(
    '07c80200-0000-4000-8000-000000000001'::uuid,
    'approve', 'Aprovacao sintetica de staging', 99
  )$$,
  'P0001',
  'Revisao desatualizada'
);
select pg_temp.expect_error(
  'TESTE_ file cannot be approved',
  $$select public.finance_review_decide(
    '07c80200-0000-4000-8000-000000000002'::uuid,
    'approve', 'Tentativa sintetica bloqueada', 0
  )$$,
  'P0001',
  'Arquivos de teste nao podem ser aprovados'
);
select
  result->>'review_status' as approved_status,
  result->>'review_revision' as approved_revision
from (
  select public.finance_review_decide(
    '07c80200-0000-4000-8000-000000000001'::uuid,
    'approve', 'Aprovacao sintetica de staging', 0
  ) result
) decision
\gset
select pg_temp.assert_true(
  'approval preserves ETag and increments revision',
  :'approved_status' = 'approved'
  and :'approved_revision' = '1'
  and exists (
    select 1
    from jsonb_array_elements(public.finance_review_list('all', 100, 0)->'items') item
    where item->>'id' = '07c80200-0000-4000-8000-000000000001'
      and item->>'source_etag' = 'etag-07c8-a-1'
      and item->>'review_status' = 'approved'
      and (item->>'review_revision')::integer = 1
      and item->>'reviewed_by' = :'reviewer_a_id'
  )
);
select pg_temp.assert_true(
  'approval creates exactly one matching audit event',
  jsonb_array_length(
    public.finance_review_history('07c80200-0000-4000-8000-000000000001'::uuid, 20)
  ) = 1
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'viewer_a_id', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'viewer_a_id', 'role', 'authenticated')::text, true);
select pg_temp.assert_true(
  'viewer can only view',
  not public.is_admin()
  and public.current_user_role() = 'user'
  and public.company_access_role('07c80000-0000-4000-8000-000000000001'::uuid) = 'viewer'
  and public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and not public.company_can_decide_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
  and not public.company_can_classify_financial_source('07c80000-0000-4000-8000-000000000001'::uuid)
);
select pg_temp.expect_error(
  'viewer cannot decide',
  $$select public.finance_review_decide(
    '07c80200-0000-4000-8000-000000000002'::uuid,
    'reject', 'Tentativa sintetica sem permissao', 0
  )$$,
  'P0001',
  'Linha inexistente ou nao autorizada'
);
reset role;

-- Owner B não atravessa para A.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_b_id', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_b_id', 'role', 'authenticated')::text, true);
select pg_temp.assert_true(
  'owner B sees only B review row',
  not public.is_admin()
  and public.current_user_role() = 'user'
  and ((public.finance_review_list('all', 100, 0)->>'total')::integer = 1)
);
reset role;

-- Admin global mantém documentos gerais, mas não herda poder financeiro.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'global_admin_id', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'global_admin_id', 'role', 'authenticated')::text, true);
select pg_temp.assert_true(
  'global admin retains general document visibility',
  public.is_admin()
  and (select count(*) >= 7 from public.documents where id::text like '07c80100-%')
);
select pg_temp.assert_true(
  'global admin without membership gets no financial review rows',
  ((public.finance_review_list('all', 100, 0)->>'total')::integer = 0)
  and not public.company_can_view_financial_review('07c80000-0000-4000-8000-000000000001'::uuid)
);
reset role;

-- Implementações privadas não são chamáveis diretamente por papéis de API.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a_id', true);
select pg_temp.expect_error(
  'authenticated cannot call private implementation',
  $$select financial_private.finance_review_list_impl('all', 10, 0)$$,
  '42501'
);
select pg_temp.expect_error(
  'authenticated cannot call extraction claim',
  format($sql$select public.finance_claim_next_document(%L::uuid, true)$sql$, :'owner_a_id'),
  '42501'
);
reset role;

set local role service_role;
select pg_temp.expect_error(
  'service_role cannot call private implementation',
  $$select financial_private.finance_review_list_impl('all', 10, 0)$$,
  '42501'
);

-- Compatibilidade n8n: somente service_role chama as RPCs públicas de extração.
select
  result->>'document_id' as claimed_document_id,
  result->>'claim_id' as claim_id,
  result->>'source_etag' as claimed_etag
from (
  select public.finance_claim_next_document(:'owner_a_id'::uuid, true) result
) claim
\gset

select pg_temp.assert_true(
  'pilot claim selects TESTE_ at the 8 MiB boundary',
  :'claimed_document_id' = '07c80100-0000-4000-8000-000000000006'
  and :'claimed_etag' = 'etag-07c8-claim-1'
);

select pg_temp.assert_true(
  'service_role completes claimed document without facts',
  (
    public.finance_complete_document(
      :'claimed_document_id'::uuid,
      :'claim_id'::uuid,
      :'claimed_etag',
      'needs_review',
      '[]'::jsonb,
      '07C8 synthetic staging test',
      null
    )->>'status'
  ) = 'needs_review'
);

select
  result->>'document_id' as non_pilot_document_id
from (
  select public.finance_claim_next_document(:'owner_a_id'::uuid, false) result
) claim
\gset

select pg_temp.assert_true(
  'non-pilot claim excludes newer company-less document',
  :'non_pilot_document_id' = '07c80100-0000-4000-8000-000000000003'
);
reset role;

select '07c8_security_suite' as suite,
       'all assertions passed; transaction will be rolled back' as result;

rollback;
