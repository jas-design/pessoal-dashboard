-- Etapa 07C.12F.2: novas funcoes criadas por postgres exigem grants explicitos.

begin;

alter default privileges for role postgres
  revoke execute on functions from public;

do $verification$
begin
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
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '07C.12F.2: postgres global function defaults remain executable by PUBLIC';
  end if;
end;
$verification$;

commit;
