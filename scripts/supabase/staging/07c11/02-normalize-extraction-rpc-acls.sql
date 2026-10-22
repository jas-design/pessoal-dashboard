-- Etapa 07C.12B.1: normalizacao exclusiva das ACLs das RPCs de extracao.
-- Uso permitido somente no staging local descartavel kawana-07c11-staging.
-- A variavel de sessao deve ser fornecida pelo comando de execucao:
-- PGOPTIONS="-c app.staging_project_id=kawana-07c11-staging"

begin;

do $block$
declare
  v_signature text;
  v_oid oid;
  v_unexpected_grantees text;
begin
  if current_database() <> 'postgres'
    or current_user <> 'postgres'
    or current_setting('app.staging_project_id', true)
      is distinct from 'kawana-07c11-staging'
  then
    raise exception '07C12B1: destino local de staging nao confirmado';
  end if;

  if to_regclass('public.company_members') is not null then
    raise exception '07C12B1: migrations 07C parecem ja aplicadas';
  end if;

  foreach v_signature in array array[
    'public.finance_claim_next_document(uuid,boolean)',
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);

    if v_oid is null then
      raise exception '07C12B1: funcao esperada ausente: %', v_signature;
    end if;

    if pg_catalog.pg_get_userbyid(
      (select p.proowner from pg_catalog.pg_proc p where p.oid = v_oid)
    ) <> 'postgres' then
      raise exception '07C12B1: owner inesperado para %', v_signature;
    end if;

    if (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_oid) then
      raise exception '07C12B1: % deixou de ser SECURITY INVOKER', v_signature;
    end if;

    select string_agg(distinct coalesce(r.rolname, 'PUBLIC'), ', ' order by coalesce(r.rolname, 'PUBLIC'))
    into v_unexpected_grantees
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    left join pg_catalog.pg_roles r on r.oid = acl.grantee
    where p.oid = v_oid
      and coalesce(r.rolname, 'PUBLIC') not in (
        'postgres', 'anon', 'authenticated', 'service_role'
      );

    if v_unexpected_grantees is not null then
      raise exception '07C12B1: grantees inesperados em %: %',
        v_signature, v_unexpected_grantees;
    end if;
  end loop;
end;
$block$;

revoke all on function public.finance_claim_next_document(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.finance_complete_document(
  uuid, uuid, text, text, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.finance_claim_next_document(uuid, boolean)
  to service_role;
grant execute on function public.finance_complete_document(
  uuid, uuid, text, text, jsonb, text, text
) to service_role;

do $block$
declare
  v_signature text;
  v_oid oid;
begin
  foreach v_signature in array array[
    'public.finance_claim_next_document(uuid,boolean)',
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);

    if has_function_privilege('anon', v_oid, 'EXECUTE')
      or has_function_privilege('authenticated', v_oid, 'EXECUTE')
      or not has_function_privilege('service_role', v_oid, 'EXECUTE')
    then
      raise exception '07C12B1: ACL final invalida para %', v_signature;
    end if;
  end loop;
end;
$block$;

commit;
