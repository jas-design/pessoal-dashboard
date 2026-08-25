create extension if not exists pgcrypto;

create table if not exists public.dashboard_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_month date not null,
  metric_key text not null,
  metric_label text not null,
  metric_value numeric(14, 2) not null,
  variation numeric(8, 2) not null default 0,
  comparison_label text not null,
  icon text not null default 'chart',
  period text not null,
  metric_order integer not null default 0,
  metric_unit text not null default 'currency',
  currency text not null default 'BRL',
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dashboard_metrics_period_month_is_month_start
    check (period_month = date_trunc('month', period_month)::date),
  constraint dashboard_metrics_metric_key_not_blank
    check (btrim(metric_key) <> ''),
  constraint dashboard_metrics_metric_label_not_blank
    check (btrim(metric_label) <> ''),
  constraint dashboard_metrics_period_format
    check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint dashboard_metrics_metric_unit_valid
    check (metric_unit in ('currency', 'percentage', 'number')),
  constraint dashboard_metrics_currency_iso_code
    check (currency ~ '^[A-Z]{3}$'),
  constraint dashboard_metrics_source_valid
    check (source in ('manual', 'import', 'calculated', 'n8n'))
);

alter table public.dashboard_metrics
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists period_month date,
  add column if not exists metric_order integer default 0,
  add column if not exists metric_unit text default 'currency',
  add column if not exists currency text default 'BRL',
  add column if not exists source text default 'manual',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists period text;

create unique index if not exists dashboard_metrics_user_period_metric_key_idx
  on public.dashboard_metrics (user_id, period_month, metric_key);

create index if not exists dashboard_metrics_user_period_order_idx
  on public.dashboard_metrics (user_id, period_month desc, metric_order asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboard_metrics_set_updated_at on public.dashboard_metrics;

create trigger dashboard_metrics_set_updated_at
before update on public.dashboard_metrics
for each row
execute function public.set_updated_at();

alter table public.dashboard_metrics enable row level security;

drop policy if exists "dashboard_metrics_select_own" on public.dashboard_metrics;
drop policy if exists "dashboard_metrics_insert_own" on public.dashboard_metrics;
drop policy if exists "dashboard_metrics_update_own" on public.dashboard_metrics;
drop policy if exists "dashboard_metrics_delete_own" on public.dashboard_metrics;

create policy "dashboard_metrics_select_own"
on public.dashboard_metrics
for select
to authenticated
using (auth.uid() = user_id);

create policy "dashboard_metrics_insert_own"
on public.dashboard_metrics
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "dashboard_metrics_update_own"
on public.dashboard_metrics
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "dashboard_metrics_delete_own"
on public.dashboard_metrics
for delete
to authenticated
using (auth.uid() = user_id);

comment on table public.dashboard_metrics is
  'Monthly financial indicators shown in the dashboard metric cards.';

comment on column public.dashboard_metrics.period_month is
  'First day of the represented month, for example 2024-05-01 for Maio/2024.';

comment on column public.dashboard_metrics.metric_key is
  'Stable card identifier, for example monthly_revenue, monthly_net_profit, net_margin or cash_balance.';
