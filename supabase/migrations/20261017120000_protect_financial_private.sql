begin;

-- Public wrappers are currently SECURITY INVOKER. They must become trusted
-- SECURITY DEFINER entry points before private schema access can be revoked.
do $block$
declare
  v_entry record;
  v_public_oid oid;
  v_private_oid oid;
  v_public_owner oid;
  v_private_owner oid;
  v_schema_owner oid;
  v_owner_name text;
  v_is_security_definer boolean;
  v_runtime_settings text[];
begin
  select nspowner into v_schema_owner
  from pg_catalog.pg_namespace
  where nspname = 'financial_private';

  if v_schema_owner is null then
    raise exception 'Preflight failed: financial_private schema not found';
  end if;

  for v_entry in
    select *
    from (values
      (
        'public.finance_review_list(text,integer,integer)',
        'financial_private.finance_review_list_impl(text,integer,integer)',
        'financial_private.finance_review_list_impl'
      ),
      (
        'public.finance_review_history(uuid,integer)',
        'financial_private.finance_review_history_impl(uuid,integer)',
        'financial_private.finance_review_history_impl'
      ),
      (
        'public.finance_review_decide(uuid,text,text,integer)',
        'financial_private.finance_review_decide_impl(uuid,text,text,integer)',
        'financial_private.finance_review_decide_impl'
      ),
      (
        'public.finance_review_set_document_role(uuid,text,text)',
        'financial_private.finance_review_set_document_role_impl(uuid,text,text)',
        'financial_private.finance_review_set_document_role_impl'
      )
    ) as functions(public_signature, private_signature, delegated_name)
  loop
    v_public_oid := to_regprocedure(v_entry.public_signature);
    v_private_oid := to_regprocedure(v_entry.private_signature);

    if v_public_oid is null or v_private_oid is null then
      raise exception 'Preflight failed: missing function pair % -> %',
        v_entry.public_signature, v_entry.private_signature;
    end if;

    select proowner, prosecdef, proconfig
    into strict v_public_owner, v_is_security_definer, v_runtime_settings
    from pg_catalog.pg_proc
    where oid = v_public_oid;

    select proowner into strict v_private_owner
    from pg_catalog.pg_proc
    where oid = v_private_oid;

    if v_is_security_definer then
      raise exception 'Preflight failed: wrapper % is already SECURITY DEFINER',
        v_entry.public_signature;
    end if;

    if v_runtime_settings is not null then
      raise exception 'Preflight failed: wrapper % has runtime settings that require explicit review',
        v_entry.public_signature;
    end if;

    if v_public_owner <> v_private_owner or v_public_owner <> v_schema_owner then
      raise exception 'Preflight failed: wrapper, implementation and schema owners differ for %',
        v_entry.public_signature;
    end if;

    select pg_catalog.pg_get_userbyid(v_public_owner) into v_owner_name;
    if v_owner_name in ('anon', 'authenticated', 'service_role') then
      raise exception 'Preflight failed: unsafe owner % for %',
        v_owner_name, v_entry.public_signature;
    end if;

    if position(
      v_entry.delegated_name in pg_catalog.pg_get_functiondef(v_public_oid)
    ) = 0 then
      raise exception 'Preflight failed: wrapper % does not delegate to expected implementation',
        v_entry.public_signature;
    end if;
  end loop;
end;
$block$;

alter function public.finance_review_list(text,integer,integer)
  security definer;
alter function public.finance_review_list(text,integer,integer)
  set search_path = '';

alter function public.finance_review_history(uuid,integer)
  security definer;
alter function public.finance_review_history(uuid,integer)
  set search_path = '';

alter function public.finance_review_decide(uuid,text,text,integer)
  security definer;
alter function public.finance_review_decide(uuid,text,text,integer)
  set search_path = '';

alter function public.finance_review_set_document_role(uuid,text,text)
  security definer;
alter function public.finance_review_set_document_role(uuid,text,text)
  set search_path = '';

revoke all on function financial_private.finance_review_list_impl(text,integer,integer)
  from public, anon, authenticated;
revoke all on function financial_private.finance_review_history_impl(uuid,integer)
  from public, anon, authenticated;
revoke all on function financial_private.finance_review_decide_impl(uuid,text,text,integer)
  from public, anon, authenticated;
revoke all on function financial_private.finance_review_set_document_role_impl(uuid,text,text)
  from public, anon, authenticated;

revoke usage on schema financial_private from public, anon, authenticated;

grant usage on schema financial_private to service_role;
grant execute on function financial_private.finance_review_list_impl(text,integer,integer)
  to service_role;
grant execute on function financial_private.finance_review_history_impl(uuid,integer)
  to service_role;
grant execute on function financial_private.finance_review_decide_impl(uuid,text,text,integer)
  to service_role;
grant execute on function financial_private.finance_review_set_document_role_impl(uuid,text,text)
  to service_role;

commit;
