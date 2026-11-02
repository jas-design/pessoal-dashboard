-- Read-only preflight for 09C. Run only after assert-local-isolation.ps1
-- succeeds with -RequireBaseline. This file does not apply the migration.
begin;
set local transaction read only;

do $block$
declare
  v_rls_enabled boolean;
begin
  if to_regprocedure(
    'public.finance_complete_document(uuid,uuid,text,text,jsonb,text,text)'
  ) is null then
    raise exception 'Preflight failed: finance_complete_document v1 is missing';
  end if;

  if to_regprocedure(
    'public.finance_complete_document_v2(uuid,uuid,text,text,jsonb,text,text)'
  ) is not null then
    raise exception 'Preflight failed: finance_complete_document_v2 already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_extracted_rows'
      and column_name in ('logical_key', 'source_cell', 'contract_version')
  ) then
    raise exception 'Preflight failed: v2 columns already exist';
  end if;

  select c.relrowsecurity
  into v_rls_enabled
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'financial_extracted_rows';

  if v_rls_enabled is distinct from true then
    raise exception 'Preflight failed: financial_extracted_rows RLS is disabled';
  end if;
end;
$block$;

select
  'planned_change' as section,
  change
from (values
  ('add nullable logical_key and source_cell columns for legacy compatibility'),
  ('add contract_version with legacy default 1'),
  ('extend metric and amount checks for canonical v2 facts'),
  ('add partial unique logical identity index'),
  ('create service_role-only finance_complete_document_v2 RPC'),
  ('preserve finance_complete_document v1, RLS and existing review RPCs')
) as planned(change);

rollback;
