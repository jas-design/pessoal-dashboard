-- Pos-verificacao somente leitura das quatro migrations propostas.

begin transaction read only;

do $postflight$
declare
  v_default text;
  v_role_constraint text;
begin
  if to_regclass('public.company_members') is null then
    raise exception '07C11: company_members missing';
  end if;

  select column_default
  into v_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'role';

  if v_default is not null then
    raise exception '07C11: profiles.role still has a default: %', v_default;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.conname = 'profiles_role_authorized_check'
      and con.convalidated
  ) then
    raise exception '07C11: validated profiles role constraint missing';
  end if;

  select pg_catalog.pg_get_constraintdef(con.oid, true)
  into v_role_constraint
  from pg_catalog.pg_constraint con
  where con.conrelid = 'public.profiles'::regclass
    and con.conname = 'profiles_role_authorized_check';

  if position('admin' in v_role_constraint) = 0
     or position('user' in v_role_constraint) = 0
     or position('owner' in v_role_constraint) > 0
     or position('reviewer' in v_role_constraint) > 0
     or position('viewer' in v_role_constraint) > 0 then
    raise exception '07C11: global/company role separation differs: %', v_role_constraint;
  end if;

  if has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_table_privilege('anon', 'public.profiles', 'INSERT')
     or has_table_privilege('anon', 'public.profiles', 'UPDATE')
     or has_table_privilege('anon', 'public.profiles', 'DELETE')
     or has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
     or has_table_privilege('anon', 'public.profiles', 'REFERENCES')
     or has_table_privilege('anon', 'public.profiles', 'TRIGGER')
     or has_table_privilege('anon', 'public.profiles', 'MAINTAIN')
     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
     or has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.profiles', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.profiles', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.profiles', 'MAINTAIN') then
    raise exception '07C11: unsafe profiles table privileges remain';
  end if;

  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     or not has_table_privilege('authenticated', 'public.profiles', 'INSERT') then
    raise exception '07C11: required profiles SELECT/INSERT privileges missing';
  end if;

  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE') then
    raise exception '07C11: profiles column UPDATE contract differs';
  end if;

  if has_schema_privilege('anon', 'financial_private', 'USAGE')
     or has_schema_privilege('authenticated', 'financial_private', 'USAGE')
     or has_schema_privilege('service_role', 'financial_private', 'USAGE') then
    raise exception '07C11: an API role still has financial_private USAGE';
  end if;
end;
$postflight$;

select
  '07c11_combined_postflight' as check_name,
  'structural_checks_passed' as result,
  current_database() as database_name,
  current_setting('server_version') as server_version;

rollback;

