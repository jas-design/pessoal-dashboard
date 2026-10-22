-- Contencao segura para a migration
-- 20261019120000_harden_profiles_security.sql.
--
-- NAO e uma restauracao integral do estado anterior: o estado anterior tinha
-- DEFAULT 'admin' e grants UPDATE amplos historicos. Este script nao restaura
-- nenhum deles, nao remove o dominio admin/user e nao altera perfis.
--
-- Em staging, o rollback suportado e destruir e recriar o ambiente descartavel
-- a partir da baseline. Em producao, preferir migration corretiva forward-only.

begin;

lock table public.profiles in share row exclusive mode;

-- Revoga apenas a funcionalidade nova de edicao de campos comuns. O default
-- continua ausente e role/status continuam inacessiveis a authenticated.
revoke update (full_name, avatar_url)
on table public.profiles
from authenticated;

do $verification$
declare
  v_role_default text;
begin
  select column_default
  into v_role_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'role';

  if v_role_default is not null then
    raise exception 'Safe containment refused: profiles.role default was restored';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.conname = 'profiles_role_authorized_check'
      and con.convalidated
      and position('admin' in pg_catalog.pg_get_constraintdef(con.oid, true)) > 0
      and position('user' in pg_catalog.pg_get_constraintdef(con.oid, true)) > 0
  ) then
    raise exception 'Safe containment refused: admin/user role constraint differs';
  end if;
end;
$verification$;

commit;

select
  'profiles_safe_containment' as operation,
  'common-field editing revoked; secure role contract preserved' as result;
