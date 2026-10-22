-- Postflight somente leitura da Etapa 07C.11B/07C.12F.1.

\set ON_ERROR_STOP on

begin transaction read only;

do $postflight$
declare
  v_target text;
begin
  foreach v_target in array array[
    'activities', 'api_connections', 'audit_logs',
    'automation_daily_stats', 'automation_logs', 'dashboard_metrics',
    'dashboard_widgets', 'integrations', 'notifications', 'system_health',
    'user_preferences', 'webhooks', 'widget_preferences'
  ] loop
    if has_table_privilege('anon', format('public.%I', v_target), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_target), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_target), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_target), 'DELETE')
       or has_table_privilege('anon', format('public.%I', v_target), 'TRUNCATE')
       or has_table_privilege('anon', format('public.%I', v_target), 'REFERENCES')
       or has_table_privilege('anon', format('public.%I', v_target), 'TRIGGER')
       or has_table_privilege('anon', format('public.%I', v_target), 'MAINTAIN') then
      raise exception '07C12F1 postflight: anon privilege remains on public.%', v_target;
    end if;
  end loop;

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
    raise exception '07C12F1 postflight: unsafe postgres default remains';
  end if;

  -- PostgreSQL concede EXECUTE a PUBLIC em novas funcoes por default. O
  -- hardening precisa existir no escopo global do papel criador; um REVOKE
  -- limitado ao schema public nao remove esse default nativo.
  if not exists (
    select 1
    from pg_catalog.pg_default_acl d
    where d.defaclnamespace = 0
      and pg_catalog.pg_get_userbyid(d.defaclrole) = 'postgres'
      and d.defaclobjtype = 'f'
  ) or exists (
    select 1
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) privilege
    where d.defaclnamespace = 0
      and pg_catalog.pg_get_userbyid(d.defaclrole) = 'postgres'
      and d.defaclobjtype = 'f'
      and (
        privilege.grantee = 0
        or pg_catalog.pg_get_userbyid(privilege.grantee) in ('anon', 'authenticated')
      )
  ) then
    raise exception '07C12F1 postflight: postgres global function defaults are unsafe';
  end if;

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
    raise exception '07C12F1 postflight: managed default exception changed';
  end if;

  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      and pg_catalog.pg_get_userbyid(c.relowner) = 'supabase_admin'
  ) or exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_catalog.pg_get_userbyid(p.proowner) = 'supabase_admin'
  ) then
    raise exception '07C12F1 postflight: managed role owns application object';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'financial_private')
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception '07C12F1 postflight: anon executes SECURITY DEFINER function';
  end if;
end;
$postflight$;

select
  '07c12f1_public_security_postflight' as check_name,
  'approved_with_managed_supabase_admin_exception' as result;

rollback;
