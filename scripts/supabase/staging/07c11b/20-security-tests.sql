-- Testes dos grants, RLS e defaults propostos pela Etapa 07C.11B.
-- Executar somente no staging local com um actor_id sintetico role=user e sem
-- user_permissions. Todas as operacoes locais sao revertidas.

\set ON_ERROR_STOP on

select :'confirm_isolated_staging' = '07C11_SYNTHETIC_ONLY' as confirmed \gset
\if :confirmed
\else
  \echo 'ABORTADO: use apenas staging local com dados sinteticos'
  \quit 3
\endif

begin;

select set_config('app.test_actor_id', :'actor_id', false);

do $block$
begin
  if current_user <> 'postgres' then
    raise exception '07C.11B tests: run as postgres to SET ROLE safely';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = current_setting('app.test_actor_id')::uuid
      and role = 'user'
      and status = 'active'
  ) then
    raise exception '07C.11B tests: actor_id must be an active synthetic global user';
  end if;

  if exists (
    select 1 from public.user_permissions
    where user_id = current_setting('app.test_actor_id')::uuid
  ) then
    raise exception '07C.11B tests: actor_id must not have module permissions';
  end if;
end;
$block$;

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

do $temp_grants$
declare
  v_temp_schema text := pg_my_temp_schema()::regnamespace::text;
begin
  execute format(
    'grant usage on schema %I to anon, authenticated',
    v_temp_schema
  );
  execute format(
    'grant execute on function %I.expect_error(text, text, text) to anon, authenticated',
    v_temp_schema
  );
end;
$temp_grants$;

do $assertions$
declare
  v_target text;
begin
  foreach v_target in array array[
    'activities', 'api_connections', 'audit_logs',
    'automation_daily_stats', 'automation_logs', 'dashboard_metrics',
    'dashboard_widgets', 'integrations', 'notifications', 'system_health',
    'user_preferences', 'webhooks', 'widget_preferences'
  ]
  loop
    if has_table_privilege('anon', format('public.%I', v_target), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_target), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_target), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_target), 'DELETE')
       or has_table_privilege('anon', format('public.%I', v_target), 'TRUNCATE')
       or has_table_privilege('anon', format('public.%I', v_target), 'REFERENCES')
       or has_table_privilege('anon', format('public.%I', v_target), 'TRIGGER')
       or has_table_privilege('anon', format('public.%I', v_target), 'MAINTAIN') then
      raise exception 'FAILED: anon privilege remains on public.%', v_target;
    end if;

    if not has_table_privilege(
      'authenticated', format('public.%I', v_target), 'SELECT'
    ) or not has_table_privilege(
      'service_role', format('public.%I', v_target), 'SELECT'
    ) then
      raise exception 'FAILED: legitimate SELECT grant missing on public.%', v_target;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename in ('dashboard_metrics', 'dashboard_widgets', 'system_health')
      and ('anon' = any(p.roles) or 'public' = any(p.roles))
  ) then
    raise exception 'FAILED: public SELECT policy remains on dashboard tables';
  end if;

  -- Objetos da aplicacao sao criados por postgres. Seus defaults precisam
  -- permanecer estritamente seguros para os papeis de API.
  if exists (
    select 1
    from pg_catalog.pg_default_acl d
    join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral pg_catalog.aclexplode(d.defaclacl) privilege
    where n.nspname = 'public'
      and pg_catalog.pg_get_userbyid(d.defaclrole) = 'postgres'
      and d.defaclobjtype in ('r', 'S', 'f')
      and (
        privilege.grantee = 0
        or pg_catalog.pg_get_userbyid(privilege.grantee) in ('anon', 'authenticated')
      )
  ) then
    raise exception 'FAILED: unsafe postgres default privilege remains in public';
  end if;

  -- supabase_admin e um papel interno gerenciado pelo Supabase. A excecao
  -- abaixo e aceita apenas enquanto permanecer exatamente igual ao inventario
  -- comprovado e nenhum objeto da aplicacao em public pertencer a esse papel.
  if (
    select count(*)
    from pg_catalog.pg_default_acl d
    join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral pg_catalog.aclexplode(d.defaclacl) privilege
    where n.nspname = 'public'
      and pg_catalog.pg_get_userbyid(d.defaclrole) = 'supabase_admin'
      and d.defaclobjtype in ('r', 'S', 'f')
      and pg_catalog.pg_get_userbyid(privilege.grantee) in ('anon', 'authenticated')
  ) <> 24 then
    raise exception 'FAILED: managed supabase_admin default exception changed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) privilege
    where d.defaclnamespace = 0
      and pg_catalog.pg_get_userbyid(d.defaclrole) = 'supabase_admin'
      and (
        privilege.grantee = 0
        or pg_catalog.pg_get_userbyid(privilege.grantee) in ('anon', 'authenticated')
      )
  ) then
    raise exception 'FAILED: supabase_admin client defaults unexpectedly became global';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      and pg_catalog.pg_get_userbyid(c.relowner) = 'supabase_admin'
  ) or exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_catalog.pg_get_userbyid(p.proowner) = 'supabase_admin'
  ) then
    raise exception 'FAILED: application object in public is owned by supabase_admin';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'financial_private')
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'FAILED: anon can execute a SECURITY DEFINER function';
  end if;

  if has_function_privilege('anon', 'public.can_access_module(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.current_user_role()', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') then
    raise exception 'FAILED: anon still executes an authorization helper';
  end if;

  if not has_function_privilege('authenticated', 'public.can_access_module(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.current_user_role()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.can_access_module(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.current_user_role()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.is_admin()', 'EXECUTE') then
    raise exception 'FAILED: authorized helper EXECUTE grant was removed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid in (
      to_regprocedure('public.can_access_module(text)'),
      to_regprocedure('public.current_user_role()'),
      to_regprocedure('public.is_admin()')
    )
      and p.proconfig is distinct from array['search_path=""']::text[]
  ) then
    raise exception 'FAILED: authorization helper search_path is not empty';
  end if;
end;
$assertions$;

select
  'managed_default_exception' as check_name,
  'supabase_admin public defaults inventoried; no application objects owned' as result;

-- Prova os defaults com objetos sinteticos que desaparecem no ROLLBACK.
create table public.__07c11b_default_table (id bigint primary key);
create sequence public.__07c11b_default_sequence;
create function public.__07c11b_default_function()
returns boolean
language sql
as 'select true';

do $default_object_checks$
begin
  if has_table_privilege('anon', 'public.__07c11b_default_table', 'SELECT')
     or has_table_privilege('authenticated', 'public.__07c11b_default_table', 'SELECT')
     or has_sequence_privilege('anon', 'public.__07c11b_default_sequence', 'USAGE')
     or has_sequence_privilege('authenticated', 'public.__07c11b_default_sequence', 'USAGE')
     or has_function_privilege('anon', 'public.__07c11b_default_function()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.__07c11b_default_function()', 'EXECUTE') then
    raise exception 'FAILED: new public object inherited a client-role privilege';
  end if;

  if not has_table_privilege('service_role', 'public.__07c11b_default_table', 'SELECT')
     or not has_sequence_privilege('service_role', 'public.__07c11b_default_sequence', 'USAGE')
     or not has_function_privilege('service_role', 'public.__07c11b_default_function()', 'EXECUTE') then
    raise exception 'FAILED: new public object did not preserve service_role';
  end if;
end;
$default_object_checks$;

set local role anon;
select pg_temp.expect_error(
  'anon cannot read dashboard_metrics',
  'select count(*) from public.dashboard_metrics',
  '42501'
);
select pg_temp.expect_error(
  'anon cannot read dashboard_widgets',
  'select count(*) from public.dashboard_widgets',
  '42501'
);
select pg_temp.expect_error(
  'anon cannot read system_health',
  'select count(*) from public.system_health',
  '42501'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'actor_id', 'role', 'authenticated')::text,
  true
);

do $authenticated_checks$
begin
  if public.is_admin() or public.current_user_role() <> 'user' then
    raise exception 'FAILED: synthetic global user authorization differs';
  end if;

  perform count(*) from public.dashboard_metrics;
  perform count(*) from public.dashboard_widgets;
  perform count(*) from public.system_health;
end;
$authenticated_checks$;
reset role;

rollback;
