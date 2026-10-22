-- Testes sinteticos do hardening de public.profiles.
-- Executar somente em Supabase local/staging isolado, depois da migration
-- 20261019120000_harden_profiles_security.sql.
--
-- Requer tres usuarios Auth sinteticos:
-- - admin_id: profile role=admin/status=active;
-- - user_id: profile role=user/status=active, sem user_permissions;
-- - new_user_id: sem profile, usado para testar provisionamento explicito.

\set ON_ERROR_STOP on

select :'confirm_isolated_staging' = 'PROFILES_SYNTHETIC_ONLY' as confirmed \gset
\if :confirmed
\else
  \echo 'ABORTADO: use apenas staging isolado com dados sinteticos'
  \quit 3
\endif

begin;

do $block$
begin
  if current_user <> 'postgres' then
    raise exception 'Profiles tests: run as postgres to SET ROLE safely';
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
  p_sqlstate text default null
)
returns text
language plpgsql
as $function$
begin
  begin
    execute p_sql;
  exception when others then
    if p_sqlstate is null or sqlstate = p_sqlstate then
      return 'ok - ' || p_name;
    end if;
    raise exception 'FAILED: %; got [%] %', p_name, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: %; expected an error', p_name;
end;
$function$;

grant usage on schema pg_temp to anon, authenticated, service_role;
grant execute on function pg_temp.assert_true(text, boolean)
  to anon, authenticated, service_role;
grant execute on function pg_temp.expect_error(text, text, text)
  to anon, authenticated, service_role;

create temp table profile_actor_fixture (
  actor_name text primary key,
  user_id uuid not null unique
) on commit drop;

insert into profile_actor_fixture (actor_name, user_id) values
  ('admin', :'admin_id'::uuid),
  ('user', :'user_id'::uuid),
  ('new_user', :'new_user_id'::uuid);

do $block$
begin
  if (select count(*) from profile_actor_fixture) <> 3 then
    raise exception 'Profiles tests: actor UUIDs must be distinct';
  end if;

  if exists (
    select 1
    from profile_actor_fixture a
    where not exists (select 1 from auth.users u where u.id = a.user_id)
  ) then
    raise exception 'Profiles tests: all synthetic Auth users must exist';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join profile_actor_fixture a on a.user_id = p.id
    where a.actor_name = 'admin' and p.role = 'admin' and p.status = 'active'
  ) or not exists (
    select 1
    from public.profiles p
    join profile_actor_fixture a on a.user_id = p.id
    where a.actor_name = 'user' and p.role = 'user' and p.status = 'active'
  ) then
    raise exception 'Profiles tests: admin_id/user_id must have their explicit active global roles';
  end if;

  if exists (select 1 from public.profiles where id = :'new_user_id'::uuid) then
    raise exception 'Profiles tests: new_user_id must not have a profile';
  end if;

  if exists (select 1 from public.user_permissions where user_id = :'user_id'::uuid) then
    raise exception 'Profiles tests: user_id must not have module permissions';
  end if;
end;
$block$;

select pg_temp.assert_true(
  'role has no default',
  (
    select column_default is null
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  )
);

select pg_temp.assert_true(
  'authenticated has only common-field UPDATE privileges',
  has_table_privilege('authenticated', 'public.profiles', 'SELECT')
  and has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.profiles', 'DELETE')
  and not has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.profiles', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.profiles', 'TRIGGER')
  and not has_table_privilege('authenticated', 'public.profiles', 'MAINTAIN')
  and has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
  and has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
);

select pg_temp.assert_true(
  'anon has no profiles table privileges',
  not has_table_privilege('anon', 'public.profiles', 'SELECT')
  and not has_table_privilege('anon', 'public.profiles', 'INSERT')
  and not has_table_privilege('anon', 'public.profiles', 'UPDATE')
  and not has_table_privilege('anon', 'public.profiles', 'DELETE')
  and not has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
  and not has_table_privilege('anon', 'public.profiles', 'REFERENCES')
  and not has_table_privilege('anon', 'public.profiles', 'TRIGGER')
  and not has_table_privilege('anon', 'public.profiles', 'MAINTAIN')
);

set local role anon;
select pg_temp.expect_error(
  'anon cannot select profiles',
  'select count(*) from public.profiles',
  '42501'
);
select pg_temp.expect_error(
  'anon cannot insert profiles',
  format(
    'insert into public.profiles (id, full_name, email, role, status) values (%L::uuid, %L, %L, %L, %L)',
    :'new_user_id', 'Synthetic anonymous', 'anon.invalid@example.test', 'admin', 'active'
  ),
  '42501'
);
reset role;

set local role service_role;
select pg_temp.expect_error(
  'service_role cannot omit the global role',
  format(
    'insert into public.profiles (id, full_name, email, status) values (%L::uuid, %L, %L, %L)',
    :'new_user_id', 'Synthetic service role', 'service-role@example.test', 'active'
  ),
  '23502'
);
select pg_temp.expect_error(
  'service_role cannot use a company role as global role',
  format(
    'insert into public.profiles (id, full_name, email, role, status) values (%L::uuid, %L, %L, %L, %L)',
    :'new_user_id', 'Synthetic service role', 'service-role@example.test', 'owner', 'active'
  ),
  '23514'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'user_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true('global user is not admin', not public.is_admin());
select pg_temp.assert_true('global user role is explicit', public.current_user_role() = 'user');
select pg_temp.assert_true(
  'global user has no implicit module access',
  not public.can_access_module('dashboard')
);
select pg_temp.expect_error(
  'global user cannot create an admin profile',
  format(
    'insert into public.profiles (id, full_name, email, role, status) values (%L::uuid, %L, %L, %L, %L)',
    :'new_user_id', 'Synthetic escalation', 'escalation@example.test', 'admin', 'active'
  ),
  '42501'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'admin_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true('existing admin remains admin', public.is_admin());

select pg_temp.expect_error(
  'profile creation without explicit role fails',
  format(
    'insert into public.profiles (id, full_name, email, status) values (%L::uuid, %L, %L, %L)',
    :'new_user_id', 'Synthetic new user', 'new-user@example.test', 'active'
  ),
  '23502'
);

select pg_temp.expect_error(
  'company role cannot be used as global role',
  format(
    'insert into public.profiles (id, full_name, email, role, status) values (%L::uuid, %L, %L, %L, %L)',
    :'new_user_id', 'Synthetic new user', 'new-user@example.test', 'viewer', 'active'
  ),
  '23514'
);

insert into public.profiles (id, full_name, email, role, status)
values (
  :'new_user_id'::uuid,
  'Synthetic explicit user',
  'new-user@example.test',
  'user',
  'active'
);

select pg_temp.assert_true(
  'authorized explicit user creation succeeds',
  exists (
    select 1 from public.profiles
    where id = :'new_user_id'::uuid and role = 'user' and status = 'active'
  )
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'new_user_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'new_user_id', 'role', 'authenticated')::text,
  true
);
select pg_temp.assert_true('new global user is not admin', not public.is_admin());

update public.profiles
set full_name = 'Synthetic edited user',
    avatar_url = 'https://example.test/avatar.png'
where id = :'new_user_id'::uuid;

select pg_temp.assert_true(
  'user can edit own common fields',
  exists (
    select 1 from public.profiles
    where id = :'new_user_id'::uuid
      and full_name = 'Synthetic edited user'
      and avatar_url = 'https://example.test/avatar.png'
  )
);

select pg_temp.expect_error(
  'authenticated cannot change role',
  format('update public.profiles set role = %L where id = %L::uuid', 'admin', :'new_user_id'),
  '42501'
);
select pg_temp.expect_error(
  'authenticated cannot change status',
  format('update public.profiles set status = %L where id = %L::uuid', 'inactive', :'new_user_id'),
  '42501'
);

with changed as (
  update public.profiles
  set full_name = 'Unauthorized edit'
  where id = :'admin_id'::uuid
  returning id
)
select pg_temp.assert_true(
  'global user cannot edit another profile common fields',
  (select count(*) = 0 from changed)
);
reset role;

rollback;
