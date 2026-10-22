-- Provisiona perfis exclusivamente sinteticos no staging local 07C.11.
-- Os papeis globais sao sempre explicitos: admin ou user.

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
    raise exception '07C11 profiles: run as postgres in the isolated database';
  end if;
end;
$block$;

create temp table profile_fixture (
  actor_name text primary key,
  user_id uuid not null unique,
  global_role text not null check (global_role in ('admin', 'user'))
) on commit drop;

insert into profile_fixture (actor_name, user_id, global_role) values
  ('owner-a', :'owner_a_id'::uuid, 'user'),
  ('owner-b', :'owner_b_id'::uuid, 'user'),
  ('company-admin-a', :'admin_a_id'::uuid, 'user'),
  ('reviewer-a', :'reviewer_a_id'::uuid, 'user'),
  ('viewer-a', :'viewer_a_id'::uuid, 'user'),
  ('unlinked', :'unlinked_id'::uuid, 'user'),
  ('global-admin', :'global_admin_id'::uuid, 'admin');

do $block$
begin
  if (select count(*) from profile_fixture) <> 7 then
    raise exception '07C11 profiles: actor UUIDs must be distinct';
  end if;

  if exists (
    select 1
    from profile_fixture f
    where not exists (select 1 from auth.users u where u.id = f.user_id)
  ) then
    raise exception '07C11 profiles: all synthetic Auth users must exist';
  end if;

  if exists (
    select 1
    from public.profiles p
    join profile_fixture f on f.user_id = p.id
  ) then
    raise exception '07C11 profiles: synthetic profiles already exist';
  end if;
end;
$block$;

insert into public.profiles (id, full_name, email, role, status)
select
  f.user_id,
  '07C11 Synthetic ' || f.actor_name,
  '07c11-' || f.actor_name || '@example.test',
  f.global_role,
  'active'
from profile_fixture f;

commit;

select
  '07c11_synthetic_profiles' as fixture_set,
  count(*) filter (where role = 'admin') as global_admins,
  count(*) filter (where role = 'user') as global_users,
  'synthetic_only' as data_classification
from public.profiles
where email like '07c11-%@example.test';
