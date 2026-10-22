-- Etapa 07C.12D: cobertura complementar de acesso direto e elevacao.
-- Todas as mutacoes deste arquivo terminam em ROLLBACK.

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
    raise exception '07C12D tests: run as postgres to SET ROLE safely';
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

do $block$
declare
  v_temp_schema text := pg_my_temp_schema()::regnamespace::text;
begin
  execute format(
    'grant usage on schema %I to anon, authenticated',
    v_temp_schema
  );
  execute format(
    'grant execute on function %I.assert_true(text, boolean) to anon, authenticated',
    v_temp_schema
  );
  execute format(
    'grant execute on function %I.expect_error(text, text, text, text) to anon, authenticated',
    v_temp_schema
  );
end;
$block$;

set local role anon;
select pg_temp.expect_error(
  'anon cannot execute extraction completion',
  $$select public.finance_complete_document(
    '07c80100-0000-4000-8000-000000000001'::uuid,
    '07c89999-0000-4000-8000-000000000001'::uuid,
    'etag-07c8-a-1', 'needs_review', '[]'::jsonb, null, null
  )$$,
  '42501'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'owner_a_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'owner A directly sees own company and personal documents',
  (select count(*) = 6 from public.documents where owner_id = :'owner_a_id'::uuid)
  and exists (
    select 1 from public.documents
    where id = '07c80100-0000-4000-8000-000000000004'::uuid
      and company_id is null
  )
);
select pg_temp.assert_true(
  'owner A cannot directly read company B document by UUID',
  not exists (
    select 1 from public.documents
    where id = '07c80100-0000-4000-8000-000000000005'::uuid
  )
);
select pg_temp.assert_true(
  'owner A cannot directly read extracted rows despite known UUIDs',
  not exists (
    select 1 from public.financial_extracted_rows
    where id in (
      '07c80200-0000-4000-8000-000000000001'::uuid,
      '07c80200-0000-4000-8000-000000000005'::uuid
    )
  )
);
select pg_temp.expect_error(
  'owner A cannot read company B history by row UUID',
  $$select public.finance_review_history(
    '07c80200-0000-4000-8000-000000000005'::uuid, 20
  )$$,
  'P0001',
  'Linha nao encontrada'
);
select pg_temp.assert_true(
  'owner can decide company-less personal document',
  (
    public.finance_review_decide(
      '07c80200-0000-4000-8000-000000000004'::uuid,
      'reject', 'Rejeicao sintetica de documento pessoal', 0
    )->>'review_status'
  ) = 'rejected'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_a_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'admin_a_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'company admin receives positive review data only from A',
  ((public.finance_review_list('all', 100, 0)->>'total')::integer = 2)
);
select pg_temp.assert_true(
  'company admin cannot directly read documents through owner RLS',
  (select count(*) = 0 from public.documents)
);
select pg_temp.assert_true(
  'company admin can classify coherent company document',
  (
    public.finance_review_set_document_role(
      '07c80100-0000-4000-8000-000000000001'::uuid,
      'supporting', 'Classificacao sintetica pelo admin empresarial'
    )->>'changed'
  )::boolean
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'reviewer_a_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'reviewer_a_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.expect_error(
  'reviewer cannot classify document through wrapper',
  $$select public.finance_review_set_document_role(
    '07c80100-0000-4000-8000-000000000001'::uuid,
    'primary', 'Tentativa sintetica sem permissao de classificar'
  )$$,
  'P0001',
  'Documento nao encontrado ou nao autorizado'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'viewer_a_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'viewer_a_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'viewer receives positive review data only from A',
  ((public.finance_review_list('all', 100, 0)->>'total')::integer = 2)
);
update public.company_members
set role = 'admin'
where company_id = '07c80000-0000-4000-8000-000000000001'::uuid
  and user_id = :'viewer_a_id'::uuid;
select pg_temp.assert_true(
  'viewer cannot elevate own company membership',
  public.company_access_role(
    '07c80000-0000-4000-8000-000000000001'::uuid
  ) = 'viewer'
);
select pg_temp.expect_error(
  'viewer cannot elevate own global profile role',
  format(
    'update public.profiles set role = %L where id = %L::uuid',
    'admin', :'viewer_a_id'
  ),
  '42501'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'unlinked_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'unlinked_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.expect_error(
  'unlinked user cannot create own company membership',
  format(
    $sql$insert into public.company_members (company_id, user_id, role)
         values ('07c80000-0000-4000-8000-000000000001'::uuid, %L::uuid, 'admin')$sql$,
    :'unlinked_id'
  ),
  '42501'
);
select pg_temp.assert_true(
  'unlinked user cannot read documents or extracted rows by UUID',
  not exists (
    select 1 from public.documents
    where id = '07c80100-0000-4000-8000-000000000001'::uuid
  )
  and not exists (
    select 1 from public.financial_extracted_rows
    where id = '07c80200-0000-4000-8000-000000000001'::uuid
  )
);
reset role;

select
  '07c12d_direct_access_suite' as suite,
  'all assertions passed; transaction will be rolled back' as result;

rollback;
