-- Etapa 07C.11B: novos objetos publicos devem exigir grants explicitos.
-- Objetos existentes nao perdem acesso de authenticated/service_role.

begin;

do $preflight$
declare
  v_signature text;
  v_oid oid;
  v_owner text;
  v_is_security_definer boolean;
begin
  if not exists (
    select 1 from pg_catalog.pg_namespace where nspname = 'public'
  ) then
    raise exception '07C.11B: schema public not found';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'postgres'
  ) then
    raise exception '07C.11B: default privilege owner postgres not found';
  end if;

  foreach v_signature in array array[
    'public.can_access_module(text)',
    'public.current_user_role()',
    'public.is_admin()'
  ]
  loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception '07C.11B: required function missing: %', v_signature;
    end if;

    select pg_catalog.pg_get_userbyid(p.proowner), p.prosecdef
    into strict v_owner, v_is_security_definer
    from pg_catalog.pg_proc p
    where p.oid = v_oid;

    if v_owner <> 'postgres' then
      raise exception '07C.11B: unexpected owner % for %', v_owner, v_signature;
    end if;

    if not v_is_security_definer then
      raise exception '07C.11B: % must remain SECURITY DEFINER', v_signature;
    end if;
  end loop;
end;
$preflight$;

-- PUBLIC function EXECUTE is a PostgreSQL default independent of the named
-- API roles. Revoke it as well as the explicit anon/authenticated defaults.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- These helpers are called by authenticated RLS/policies, never by login or
-- an anonymous page. Keep authenticated/service_role and remove both direct
-- and inherited anonymous execution.
revoke all privileges on function public.can_access_module(text)
  from public, anon;
revoke all privileges on function public.current_user_role()
  from public, anon;
revoke all privileges on function public.is_admin()
  from public, anon;

grant execute on function public.can_access_module(text)
  to authenticated, service_role;
grant execute on function public.current_user_role()
  to authenticated, service_role;
grant execute on function public.is_admin()
  to authenticated, service_role;

-- All referenced objects are already schema-qualified in the inventoried
-- definitions. Empty search_path reduces SECURITY DEFINER name-resolution
-- risk without changing their authorization result.
alter function public.can_access_module(text) set search_path = '';
alter function public.current_user_role() set search_path = '';
alter function public.is_admin() set search_path = '';

commit;
