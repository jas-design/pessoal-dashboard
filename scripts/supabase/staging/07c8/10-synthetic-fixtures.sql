-- Etapa 07C.8: fixtures exclusivamente sintéticas para staging isolado.
-- Requer psql e sete usuários sintéticos previamente criados no Auth/profiles.
-- Exemplo de parâmetros está documentado em docs/financial/07C8_*.md.

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
    raise exception '07C8 fixtures: run as postgres in the isolated database';
  end if;
end;
$block$;

create temp table actor_fixture (
  actor_name text primary key,
  user_id uuid not null unique
) on commit drop;

insert into actor_fixture (actor_name, user_id) values
  ('owner_a', :'owner_a_id'::uuid),
  ('owner_b', :'owner_b_id'::uuid),
  ('admin_a', :'admin_a_id'::uuid),
  ('reviewer_a', :'reviewer_a_id'::uuid),
  ('viewer_a', :'viewer_a_id'::uuid),
  ('unlinked', :'unlinked_id'::uuid),
  ('global_admin', :'global_admin_id'::uuid);

do $block$
declare
  v_missing text;
begin
  if (select count(*) from actor_fixture) <> 7 then
    raise exception '07C8 fixtures: actor UUIDs must be distinct';
  end if;

  select string_agg(a.actor_name, ', ' order by a.actor_name)
  into v_missing
  from actor_fixture a
  where not exists (select 1 from auth.users u where u.id = a.user_id)
     or not exists (select 1 from public.profiles p where p.id = a.user_id);
  if v_missing is not null then
    raise exception '07C8 fixtures: missing synthetic Auth/profile actors: %', v_missing;
  end if;

  if not exists (
    select 1
    from public.profiles p
    join actor_fixture a on a.user_id = p.id
    where a.actor_name = 'global_admin'
      and p.role = 'admin'
      and p.status = 'active'
  ) then
    raise exception '07C8 fixtures: global_admin must be an active synthetic global admin';
  end if;

  if exists (
    select 1
    from public.profiles p
    join actor_fixture a on a.user_id = p.id
    where a.actor_name <> 'global_admin'
      and (p.role <> 'user' or p.status <> 'active')
  ) then
    raise exception '07C8 fixtures: company actors must be active global-user profiles';
  end if;

  if to_regclass('public.company_members') is null then
    raise exception '07C8 fixtures: apply and verify the three 07C migrations first';
  end if;
end;
$block$;

do $block$
begin
  if exists (
    select 1 from public.companies
    where id in (
      '07c80000-0000-4000-8000-000000000001'::uuid,
      '07c80000-0000-4000-8000-000000000002'::uuid
    )
  ) then
    raise exception '07C8 fixtures already exist; run 90-cleanup.sql first';
  end if;
end;
$block$;

insert into public.companies (id, owner_id, name, is_active)
select '07c80000-0000-4000-8000-000000000001'::uuid, user_id,
       '07C8 SYNTHETIC COMPANY A', true
from actor_fixture where actor_name = 'owner_a'
union all
select '07c80000-0000-4000-8000-000000000002'::uuid, user_id,
       '07C8 SYNTHETIC COMPANY B', true
from actor_fixture where actor_name = 'owner_b';

insert into public.company_members (company_id, user_id, role, granted_by)
select '07c80000-0000-4000-8000-000000000001'::uuid, member.user_id,
       member.role, owner.user_id
from (
  select user_id, 'admin'::text as role from actor_fixture where actor_name = 'admin_a'
  union all
  select user_id, 'reviewer' from actor_fixture where actor_name = 'reviewer_a'
  union all
  select user_id, 'viewer' from actor_fixture where actor_name = 'viewer_a'
) member
cross join (select user_id from actor_fixture where actor_name = 'owner_a') owner;

insert into public.documents (
  id, owner_id, source, category, file_name, mime_type, file_size,
  provider, external_file_id, external_drive_id, company_id, source_path,
  source_etag, source_modified_at, metadata, is_deleted
)
select document_id, owner_id, 'onedrive', 'financeiro', file_name,
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       file_size, 'onedrive', external_file_id, '07C8-SYNTHETIC-DRIVE',
       company_id, '/drive/root:/Deskboard KPIs/07C8', source_etag,
       source_modified_at, '{"synthetic":true,"stage":"07C.8"}'::jsonb, false
from (
  select '07c80100-0000-4000-8000-000000000001'::uuid document_id,
         (select user_id from actor_fixture where actor_name = 'owner_a') owner_id,
         '07C8_FINANCEIRO_A.xlsx'::text file_name, 1024::bigint file_size,
         '07C8-A-NORMAL'::text external_file_id,
         '07c80000-0000-4000-8000-000000000001'::uuid company_id,
         'etag-07c8-a-1'::text source_etag,
         '2026-10-19 10:00:00+00'::timestamptz source_modified_at
  union all
  select '07c80100-0000-4000-8000-000000000002'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         'TESTE_FINANCEIRO_07C8_BLOQUEIO.xlsx', 1024, '07C8-A-TEST',
         '07c80000-0000-4000-8000-000000000001'::uuid,
         'etag-07c8-test-1', '2026-10-19 10:01:00+00'::timestamptz
  union all
  select '07c80100-0000-4000-8000-000000000003'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         '07C8_DIVERGENCIA_SINTETICA.xlsx', 1024, '07C8-A-MISMATCH',
         '07c80000-0000-4000-8000-000000000001'::uuid,
         'etag-07c8-mismatch-1', '2026-10-19 10:02:00+00'::timestamptz
  union all
  select '07c80100-0000-4000-8000-000000000004'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         '07C8_SEM_EMPRESA.xlsx', 1024, '07C8-A-UNCLASSIFIED', null::uuid,
         'etag-07c8-unclassified-1', '2026-10-19 10:03:00+00'::timestamptz
  union all
  select '07c80100-0000-4000-8000-000000000005'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_b'),
         '07C8_FINANCEIRO_B.xlsx', 1024, '07C8-B-NORMAL',
         '07c80000-0000-4000-8000-000000000002'::uuid,
         'etag-07c8-b-1', '2026-10-19 10:04:00+00'::timestamptz
  union all
  select '07c80100-0000-4000-8000-000000000006'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         'TESTE_FINANCEIRO_07C8_CLAIM.xlsx', 8388608, '07C8-A-CLAIM',
         '07c80000-0000-4000-8000-000000000001'::uuid,
         'etag-07c8-claim-1', '2026-10-19 10:06:00+00'::timestamptz
  union all
  select '07c80100-0000-4000-8000-000000000007'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         'TESTE_FINANCEIRO_07C8_OVERSIZE.xlsx', 8388609, '07C8-A-OVERSIZE',
         '07c80000-0000-4000-8000-000000000001'::uuid,
         'etag-07c8-oversize-1', '2026-10-19 10:07:00+00'::timestamptz
) fixture;

insert into public.financial_extracted_rows (
  id, owner_id, document_id, source_etag, company_id, source_company_name,
  period_month, metric, amount, currency, sheet_name, source_row,
  review_status, review_revision
)
select row_id, owner_id, document_id, source_etag, company_id,
       '07C8 SYNTHETIC'::text, '2026-10-01'::date, metric, amount,
       'BRL', '07C8_SYNTHETIC', source_row, 'pending_review', 0
from (
  select '07c80200-0000-4000-8000-000000000001'::uuid row_id,
         (select user_id from actor_fixture where actor_name = 'owner_a') owner_id,
         '07c80100-0000-4000-8000-000000000001'::uuid document_id,
         'etag-07c8-a-1'::text source_etag,
         '07c80000-0000-4000-8000-000000000001'::uuid company_id,
         'receita'::text metric, 100.00::numeric amount, 1 source_row
  union all
  select '07c80200-0000-4000-8000-000000000002'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         '07c80100-0000-4000-8000-000000000002'::uuid,
         'etag-07c8-test-1', '07c80000-0000-4000-8000-000000000001'::uuid,
         'receita', 200.00, 2
  union all
  select '07c80200-0000-4000-8000-000000000003'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         '07c80100-0000-4000-8000-000000000003'::uuid,
         'etag-07c8-mismatch-1', '07c80000-0000-4000-8000-000000000002'::uuid,
         'despesa', 300.00, 3
  union all
  select '07c80200-0000-4000-8000-000000000004'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_a'),
         '07c80100-0000-4000-8000-000000000004'::uuid,
         'etag-07c8-unclassified-1', null::uuid, 'despesa', 400.00, 4
  union all
  select '07c80200-0000-4000-8000-000000000005'::uuid,
         (select user_id from actor_fixture where actor_name = 'owner_b'),
         '07c80100-0000-4000-8000-000000000005'::uuid,
         'etag-07c8-b-1', '07c80000-0000-4000-8000-000000000002'::uuid,
         'receita', 500.00, 5
) fixture;

insert into public.financial_review_document_policy (
  document_id, owner_id, usage_role, changed_by
)
select '07c80100-0000-4000-8000-000000000001'::uuid,
       owner.user_id, 'primary', owner.user_id
from actor_fixture owner where owner.actor_name = 'owner_a'
union all
select '07c80100-0000-4000-8000-000000000005'::uuid,
       owner.user_id, 'primary', owner.user_id
from actor_fixture owner where owner.actor_name = 'owner_b';

commit;

select '07c8_synthetic_fixtures' as fixture_set,
       2 as companies, 7 as documents, 5 as extracted_rows,
       'synthetic_only' as data_classification;
