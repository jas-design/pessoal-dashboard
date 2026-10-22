-- Etapa 07C.8: verificação somente leitura após as três migrations 07C.

begin transaction read only;

do $block$
declare
  v_signature text;
  v_oid oid;
begin
  if to_regclass('public.company_members') is null then
    raise exception '07C8 postflight: company_members is missing';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.company_members'::regclass) then
    raise exception '07C8 postflight: company_members RLS is disabled';
  end if;
  if (
    select pg_catalog.pg_get_userbyid(relowner)
    from pg_catalog.pg_class
    where oid = 'public.company_members'::regclass
  ) <> 'postgres' then
    raise exception '07C8 postflight: company_members owner is not postgres';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'companies'
      and p.polcmd = 'r'
      and trim(both '()' from pg_catalog.pg_get_expr(p.polqual, p.polrelid)) = 'true'
  ) then
    raise exception '07C8 postflight: broad companies policy still exists';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'companies'
      and policyname = 'Company owners and members can view companies'
  ) then
    raise exception '07C8 postflight: restricted companies policy is missing';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'company_members'
      and policyname in (
        'Users can view their company memberships',
        'Company owners can add members',
        'Company owners can change member roles',
        'Company owners can remove members'
      )
  ) <> 4 then
    raise exception '07C8 postflight: company membership policies are incomplete';
  end if;

  foreach v_signature in array array[
    'public.company_access_role(uuid)',
    'public.company_can_view_financial_review(uuid)',
    'public.company_can_decide_financial_review(uuid)',
    'public.company_can_classify_financial_source(uuid)',
    'public.finance_review_list(text,integer,integer)',
    'public.finance_review_history(uuid,integer)',
    'public.finance_review_decide(uuid,text,text,integer)',
    'public.finance_review_set_document_role(uuid,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception '07C8 postflight: missing function %', v_signature;
    end if;
    if pg_catalog.pg_get_userbyid((select proowner from pg_catalog.pg_proc where oid = v_oid)) <> 'postgres' then
      raise exception '07C8 postflight: unexpected function owner for %', v_signature;
    end if;
    if not has_function_privilege('authenticated', v_oid, 'EXECUTE')
      or not has_function_privilege('service_role', v_oid, 'EXECUTE')
      or has_function_privilege('anon', v_oid, 'EXECUTE')
    then
      raise exception '07C8 postflight: public function ACL differs for %', v_signature;
    end if;
  end loop;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname in (
        'Users view own documents',
        'Users create own documents',
        'Users update own documents',
        'Users delete own documents'
      )
  ) <> 4 then
    raise exception '07C8 postflight: confirmed documents policies changed';
  end if;

  foreach v_signature in array array[
    'public.finance_review_list(text,integer,integer)',
    'public.finance_review_history(uuid,integer)',
    'public.finance_review_decide(uuid,text,text,integer)',
    'public.finance_review_set_document_role(uuid,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if not (select prosecdef from pg_catalog.pg_proc where oid = v_oid)
      or (select proconfig from pg_catalog.pg_proc where oid = v_oid)
         is distinct from array['search_path=""']::text[]
    then
      raise exception '07C8 postflight: wrapper hardening differs for %', v_signature;
    end if;
  end loop;

  if has_schema_privilege('anon', 'financial_private', 'USAGE')
    or has_schema_privilege('authenticated', 'financial_private', 'USAGE')
    or has_schema_privilege('service_role', 'financial_private', 'USAGE')
  then
    raise exception '07C8 postflight: an API role still has private schema usage';
  end if;

  foreach v_signature in array array[
    'financial_private.finance_review_list_impl(text,integer,integer)',
    'financial_private.finance_review_history_impl(uuid,integer)',
    'financial_private.finance_review_decide_impl(uuid,text,text,integer)',
    'financial_private.finance_review_set_document_role_impl(uuid,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if has_function_privilege('anon', v_oid, 'EXECUTE')
      or has_function_privilege('authenticated', v_oid, 'EXECUTE')
      or has_function_privilege('service_role', v_oid, 'EXECUTE')
    then
      raise exception '07C8 postflight: API role can execute private function %', v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.finance_claim_next_document(uuid,boolean)',
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if (select prosecdef from pg_catalog.pg_proc where oid = v_oid)
      or not has_function_privilege('service_role', v_oid, 'EXECUTE')
      or has_function_privilege('anon', v_oid, 'EXECUTE')
      or has_function_privilege('authenticated', v_oid, 'EXECUTE')
    then
      raise exception '07C8 postflight: extraction RPC contract differs for %', v_signature;
    end if;
  end loop;

  if position(
      'd.file_size BETWEEN 1 AND 8388608'
      in pg_catalog.pg_get_functiondef(to_regprocedure(
        'public.finance_claim_next_document(uuid,boolean)'
      ))
    ) = 0
    or position(
      'NOT p_pilot_only AND d.company_id IS NOT NULL'
      in pg_catalog.pg_get_functiondef(to_regprocedure(
        'public.finance_claim_next_document(uuid,boolean)'
      ))
    ) = 0
  then
    raise exception '07C8 postflight: claim eligibility contract changed';
  end if;
end;
$block$;

select
  '07c8_postflight' as check_name,
  'ready_for_synthetic_security_tests' as result,
  current_database() as database_name;

rollback;
