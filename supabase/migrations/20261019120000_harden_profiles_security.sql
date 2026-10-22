-- Etapa 07C: hardening isolado de public.profiles.
--
-- Contrato comprovado no Supabase KAWANA em 2026-10-19:
-- - role/status sao text NOT NULL;
-- - os perfis existentes usam role='admin';
-- - public.is_admin() exige role='admin' e status='active';
-- - role='user' e o papel global comum aprovado; papeis empresariais ficam
--   exclusivamente em companies.owner_id e public.company_members;
-- - nao existe trigger de provisionamento de perfil.
--
-- Esta migration nao cria perfis nem altera linhas existentes.

begin;


do $existence_preflight$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Profiles hardening: public.profiles not found';
  end if;
end;
$existence_preflight$;

lock table public.profiles in share row exclusive mode;

do $preflight$
declare
  v_role_default text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'Profiles hardening: role must be text NOT NULL';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'status'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'Profiles hardening: status must be text NOT NULL';
  end if;

  select c.column_default
  into v_role_default
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role';

  if v_role_default is not null
     and v_role_default not in ('''admin''::text', '''admin''') then
    raise exception 'Profiles hardening: unexpected role default: %', v_role_default;
  end if;

  if exists (
    select 1
    from public.profiles
    where role is null
       or role not in ('admin', 'user')
  ) then
    raise exception 'Profiles hardening: unapproved existing profile role found';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Profiles hardening: public.is_admin() not found';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
      and p.prosecdef
  ) then
    raise exception 'Profiles hardening: public.is_admin() must be SECURITY DEFINER';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'profiles'
      and p.policyname = 'Users can update own profile'
      and p.cmd = 'UPDATE'
  ) then
    raise exception 'Profiles hardening: expected profile UPDATE policy not found';
  end if;
end;
$preflight$;

-- Omitting role must now fail instead of silently creating an administrator.
alter table public.profiles
  alter column role drop default;

-- Global roles are deliberately distinct from company roles. Both must be
-- supplied explicitly because role has no default.
alter table public.profiles
  add constraint profiles_role_authorized_check
  check (role in ('admin', 'user')) not valid;

alter table public.profiles
  validate constraint profiles_role_authorized_check;

-- Keep profile creation limited to an active administrator. Because role has
-- no default, every insert must state it explicitly; the constraint above
-- rejects unapproved values. service_role remains subject to the constraint.
drop policy if exists "Admins can insert profiles" on public.profiles;

create policy "Admins can insert profiles"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

-- Recreate the confirmed row scope explicitly. Column privileges below are
-- the separate control that prevents role/status changes.
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- The updated baseline still has historical DELETE/TRUNCATE/REFERENCES/
-- TRIGGER/MAINTAIN grants. TRUNCATE is not filtered by RLS, so establish the
-- browser contract explicitly instead of relying on row policies alone.
revoke all privileges on table public.profiles from public, anon;
revoke all privileges on table public.profiles from authenticated;

grant select, insert on table public.profiles to authenticated;

-- RLS still limits authenticated users to their own row, while active admins
-- retain the existing ability to edit common fields on managed profiles.
grant update (full_name, avatar_url) on table public.profiles to authenticated;

-- All names referenced by is_admin() are schema-qualified, so an empty
-- search_path removes unnecessary name-resolution risk without changing it.
alter function public.is_admin() set search_path = '';

comment on constraint profiles_role_authorized_check on public.profiles is
  'Global roles only: admin or user. Company roles belong to companies.owner_id and company_members.';

commit;
