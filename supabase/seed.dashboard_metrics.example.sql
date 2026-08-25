-- Replace the user id below with the authenticated Supabase user id that owns
-- these private financial metrics before running this seed manually.
with owner as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
),
monthly_values(period_month, revenue, net_profit, net_margin, cash_balance) as (
  values
    ('2024-01-01'::date, 980000.00, 136500.00, 13.90, 318200.00),
    ('2024-02-01'::date, 1045000.00, 149300.00, 14.30, 342700.00),
    ('2024-03-01'::date, 1108000.00, 158900.00, 14.40, 371400.00),
    ('2024-04-01'::date, 1111000.00, 171500.00, 15.40, 394600.00),
    ('2024-05-01'::date, 1250000.00, 185750.00, 14.90, 432890.00),
    ('2024-06-01'::date, 1292000.00, 191800.00, 14.80, 448300.00),
    ('2024-07-01'::date, 1346000.00, 203100.00, 15.10, 462700.00),
    ('2024-08-01'::date, 1398000.00, 211400.00, 15.10, 488900.00),
    ('2024-09-01'::date, 1435000.00, 218200.00, 15.20, 502400.00),
    ('2024-10-01'::date, 1512000.00, 231300.00, 15.30, 526100.00),
    ('2024-11-01'::date, 1589000.00, 246200.00, 15.50, 548700.00),
    ('2024-12-01'::date, 1684000.00, 269400.00, 16.00, 587900.00)
),
monthly_calculations as (
  select
    period_month,
    revenue,
    net_profit,
    net_margin,
    cash_balance,
    coalesce(
      round(((revenue - lag(revenue) over months) / nullif(lag(revenue) over months, 0)) * 100, 2),
      0
    ) as revenue_variation,
    coalesce(
      round(((net_profit - lag(net_profit) over months) / nullif(lag(net_profit) over months, 0)) * 100, 2),
      0
    ) as net_profit_variation,
    coalesce(
      round(net_margin - lag(net_margin) over months, 2),
      0
    ) as net_margin_variation
  from monthly_values
  window months as (order by period_month)
),
metric_rows as (
  select
    owner.user_id,
    metrics_by_month.period_month,
    metric.metric_key,
    metric.metric_label,
    metric.metric_value,
    metric.variation,
    metric.comparison_label,
    metric.icon,
    to_char(metrics_by_month.period_month, 'YYYY-MM') as period,
    metric.metric_order,
    metric.metric_unit,
    metric.currency,
    metric.source
  from owner
  cross join monthly_calculations as metrics_by_month
  cross join lateral (
    values
      (
        'monthly_revenue',
        'Faturamento (mes)',
        metrics_by_month.revenue,
        metrics_by_month.revenue_variation,
        'vs mes anterior',
        'currency',
        1,
        'currency',
        'BRL',
        'manual'
      ),
      (
        'monthly_net_profit',
        'Lucro liquido (mes)',
        metrics_by_month.net_profit,
        metrics_by_month.net_profit_variation,
        'vs mes anterior',
        'chart',
        2,
        'currency',
        'BRL',
        'manual'
      ),
      (
        'net_margin',
        'Margem liquida',
        metrics_by_month.net_margin,
        metrics_by_month.net_margin_variation,
        'p.p. vs mes anterior',
        'percent',
        3,
        'percentage',
        'BRL',
        'manual'
      ),
      (
        'cash_balance',
        'Saldo em caixa',
        metrics_by_month.cash_balance,
        0,
        'Atualizado hoje',
        'wallet',
        4,
        'currency',
        'BRL',
        'manual'
      )
  ) as metric(
    metric_key,
    metric_label,
    metric_value,
    variation,
    comparison_label,
    icon,
    metric_order,
    metric_unit,
    currency,
    source
  )
)
insert into public.dashboard_metrics (
  user_id,
  period_month,
  metric_key,
  metric_label,
  metric_value,
  variation,
  comparison_label,
  icon,
  period,
  metric_order,
  metric_unit,
  currency,
  source
)
select
  user_id,
  period_month,
  metric_key,
  metric_label,
  metric_value,
  variation,
  comparison_label,
  icon,
  period,
  metric_order,
  metric_unit,
  currency,
  source
from metric_rows
on conflict (user_id, period_month, metric_key) do update
set
  metric_label = excluded.metric_label,
  metric_value = excluded.metric_value,
  variation = excluded.variation,
  comparison_label = excluded.comparison_label,
  icon = excluded.icon,
  period = excluded.period,
  metric_order = excluded.metric_order,
  metric_unit = excluded.metric_unit,
  currency = excluded.currency,
  source = excluded.source;
