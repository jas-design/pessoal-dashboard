-- Etapa 07C.12E: testes da migration de hardening de profiles.
-- Todas as mutacoes terminam em ROLLBACK.

\set ON_ERROR_STOP on

select :'confirm_isolated_staging' = '07C11_SYNTHETIC_ONLY' as confirmed \gset
\if :confirmed
\else
  \echo 'ABORTADO: informe -v confirm_isolated_staging=07C11_SYNTHETIC_ONLY'
  \quit 3
\endif

begin;

do $block$
begin
  if current_user <> 'postgres' then
    raise exception '07C12E tests: run as postgres to SET ROLE safely';
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
  p_sqlstate text
)
returns text
language plpgsql
as $function$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then
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
  execute format('grant usage on schema %I to anon, authenticated, service_role', v_temp_schema);
  execute format(
    'grant execute on function %I.assert_true(text, boolean) to anon, authenticated, service_role',
    v_temp_schema
  );
  execute format(
    'grant execute on function %I.expect_error(text, text, text) to anon, authenticated, service_role',
    v_temp_schema
  );
end;
$block$;

set local role anon;
select pg_temp.expect_error(
  'anon cannot select profiles',
  'select count(*) from public.profiles',
  '42501'
);
select pg_temp.expect_error(
  'anon cannot insert profiles',
  $$insert into public.profiles (id, full_name, email, role, status)
    values ('07ce0000-0000-4000-8000-000000000010', 'Anon', 'anon@example.test', 'admin', 'active')$$,
  '42501'
);
select pg_temp.expect_error(
  'anon cannot update profiles',
  $$update public.profiles set full_name = 'Anon'$$,
  '42501'
);
reset role;

-- Um usuario comum nao pode recriar o proprio profile como admin.
delete from public.profiles where id = :'unlinked_id'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'unlinked_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'unlinked_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.expect_error(
  'common user cannot insert own admin profile',
  format(
    $sql$insert into public.profiles (id, full_name, email, role, status)
      values (%L::uuid, 'Unauthorized', 'unauthorized@example.test', 'admin', 'active')$sql$,
    :'unlinked_id'
  ),
  '42501'
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
  'common user is not global admin and has no global dashboard access',
  not public.is_admin() and not public.can_access_module('dashboard')
);
select pg_temp.assert_true(
  'authenticated user reads only own permitted profile',
  (select count(*) = 1 from public.profiles)
  and exists (select 1 from public.profiles where id = :'viewer_a_id'::uuid)
);
update public.profiles
set full_name = '07C12E Updated Viewer',
    avatar_url = 'https://example.test/07c12e-avatar.png'
where id = :'viewer_a_id'::uuid;
select pg_temp.assert_true(
  'user updates own common profile fields',
  exists (
    select 1 from public.profiles
    where id = :'viewer_a_id'::uuid
      and full_name = '07C12E Updated Viewer'
      and avatar_url = 'https://example.test/07c12e-avatar.png'
  )
);
select pg_temp.expect_error(
  'viewer cannot elevate own global role',
  format('update public.profiles set role = %L where id = %L::uuid', 'admin', :'viewer_a_id'),
  '42501'
);
select pg_temp.expect_error(
  'user cannot update own status',
  format('update public.profiles set status = %L where id = %L::uuid', 'inactive', :'viewer_a_id'),
  '42501'
);
select pg_temp.expect_error(
  'user cannot update own email',
  format('update public.profiles set email = %L where id = %L::uuid', 'changed@example.test', :'viewer_a_id'),
  '42501'
);
select pg_temp.expect_error(
  'broad update cannot mix common and privileged columns',
  format(
    'update public.profiles set full_name = %L, role = %L where id = %L::uuid',
    'Unauthorized', 'admin', :'viewer_a_id'
  ),
  '42501'
);
select pg_temp.expect_error(
  'common user cannot change another global role',
  format('update public.profiles set role = %L where id = %L::uuid', 'user', :'global_admin_id'),
  '42501'
);
update public.profiles
set full_name = 'Unauthorized Other Update'
where id = :'owner_a_id'::uuid;
select pg_temp.assert_true(
  'common user cannot update another profile common fields',
  not exists (
    select 1 from public.profiles
    where id = :'owner_a_id'::uuid
      and full_name = 'Unauthorized Other Update'
  )
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'global_admin_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'global_admin_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'active global admin remains compatible',
  public.is_admin() and public.can_access_module('dashboard')
);
update public.profiles
set full_name = '07C12E Managed Profile'
where id = :'owner_a_id'::uuid;
select pg_temp.assert_true(
  'global admin updates only allowed common fields on managed profile',
  exists (
    select 1 from public.profiles
    where id = :'owner_a_id'::uuid
      and full_name = '07C12E Managed Profile'
  )
);
select pg_temp.expect_error(
  'global admin cannot update another role from browser contract',
  format('update public.profiles set role = %L where id = %L::uuid', 'admin', :'owner_a_id'),
  '42501'
);
reset role;

set local role service_role;
select pg_temp.expect_error(
  'omitted role cannot create default admin',
  format(
    $sql$insert into public.profiles (id, full_name, email, status)
      values (%L::uuid, 'Missing Role', 'missing-role@example.test', 'active')$sql$,
    :'profile_candidate_id'
  ),
  '23502'
);
select pg_temp.expect_error(
  'service role remains subject to approved global roles',
  format(
    $sql$insert into public.profiles (id, full_name, email, role, status)
      values (%L::uuid, 'Invalid Role', 'invalid-role@example.test', 'viewer', 'active')$sql$,
    :'profile_candidate_id'
  ),
  '23514'
);
insert into public.profiles (id, full_name, email, role, status)
values (
  :'profile_candidate_id'::uuid,
  '07C12E Authorized Provisioning',
  '07c11-profile-candidate@example.test',
  'user',
  'active'
);
select pg_temp.assert_true(
  'service role provisions explicit ordinary profile',
  exists (
    select 1 from public.profiles
    where id = :'profile_candidate_id'::uuid
      and role = 'user'
      and status = 'active'
  )
);
update public.profiles set status = 'inactive' where id = :'global_admin_id'::uuid;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'global_admin_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'global_admin_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true(
  'inactive global admin is not admin',
  not public.is_admin()
);
reset role;

select
  '07c12e_profile_security_suite' as suite,
  'all assertions passed; transaction will be rolled back' as result;

rollback;
