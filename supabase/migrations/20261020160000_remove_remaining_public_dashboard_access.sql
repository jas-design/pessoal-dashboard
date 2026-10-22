-- Etapa 07C.11B: remove o acesso anonimo remanescente e reconcilia a
-- baseline de 20/10/2026 com os hardenings aplicados depois da exportacao.
-- Nao altera grants de authenticated/service_role nem le dados de negocio.

begin;

do $preflight$
declare
  v_missing text;
begin
  select string_agg(target.table_name, ', ' order by target.table_name)
  into v_missing
  from (values
    ('activities'),
    ('api_connections'),
    ('audit_logs'),
    ('automation_daily_stats'),
    ('automation_logs'),
    ('dashboard_metrics'),
    ('dashboard_widgets'),
    ('integrations'),
    ('notifications'),
    ('system_health'),
    ('user_preferences'),
    ('webhooks'),
    ('widget_preferences')
  ) target(table_name)
  where to_regclass(format('public.%I', target.table_name)) is null;

  if v_missing is not null then
    raise exception '07C.11B: missing public tables: %', v_missing;
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    raise exception '07C.11B: role anon not found';
  end if;
end;
$preflight$;

-- The first ten tables were already hardened remotely after the baseline was
-- exported. Repeating REVOKE is intentional and makes local reconstruction
-- deterministic. The final three remove the remaining public reads.
revoke all privileges on table
  public.activities,
  public.api_connections,
  public.audit_logs,
  public.automation_daily_stats,
  public.automation_logs,
  public.dashboard_metrics,
  public.dashboard_widgets,
  public.integrations,
  public.notifications,
  public.system_health,
  public.user_preferences,
  public.webhooks,
  public.widget_preferences
from public, anon;

drop policy if exists "Public can read dashboard metrics"
  on public.dashboard_metrics;
drop policy if exists "Public can read dashboard widgets"
  on public.dashboard_widgets;
drop policy if exists "Public can read system health"
  on public.system_health;

commit;
