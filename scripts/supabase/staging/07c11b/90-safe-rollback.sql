-- Contencao segura da Etapa 07C.11B.
-- Nao restaura acesso anonimo nem default privileges amplos.
-- O rollback integral de staging e recriar o projeto local da baseline.

begin;

grant select on table
  public.dashboard_metrics,
  public.dashboard_widgets,
  public.system_health
to authenticated;

grant all privileges on table
  public.dashboard_metrics,
  public.dashboard_widgets,
  public.system_health
to service_role;

grant execute on function public.can_access_module(text)
  to authenticated, service_role;
grant execute on function public.current_user_role()
  to authenticated, service_role;
grant execute on function public.is_admin()
  to authenticated, service_role;

commit;

select
  '07c11b_safe_containment' as operation,
  'authorized access preserved; public access not restored' as result;
