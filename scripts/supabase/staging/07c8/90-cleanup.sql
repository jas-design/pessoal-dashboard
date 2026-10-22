-- Etapa 07C.8: remove somente fixtures com UUIDs reservados desta etapa.
-- Não remove usuários Auth/profiles e não reverte migrations.

\set ON_ERROR_STOP on

select :'confirm_isolated_staging' = '07C8_SYNTHETIC_ONLY' as confirmed \gset
\if :confirmed
\else
  \echo 'ABORTADO: informe -v confirm_isolated_staging=07C8_SYNTHETIC_ONLY'
  \quit 3
\endif

begin;

do $block$
begin
  if current_user <> 'postgres' then
    raise exception '07C8 cleanup: run as postgres in the isolated database';
  end if;
end;
$block$;

delete from public.financial_review_audit
where document_id in (
  '07c80100-0000-4000-8000-000000000001'::uuid,
  '07c80100-0000-4000-8000-000000000002'::uuid,
  '07c80100-0000-4000-8000-000000000003'::uuid,
  '07c80100-0000-4000-8000-000000000004'::uuid,
  '07c80100-0000-4000-8000-000000000005'::uuid,
  '07c80100-0000-4000-8000-000000000006'::uuid,
  '07c80100-0000-4000-8000-000000000007'::uuid
);

delete from public.financial_review_document_policy
where document_id::text like '07c80100-0000-4000-8000-%';

delete from public.financial_extracted_rows
where document_id::text like '07c80100-0000-4000-8000-%';

delete from public.financial_extraction_jobs
where document_id::text like '07c80100-0000-4000-8000-%';

delete from public.documents
where id::text like '07c80100-0000-4000-8000-%';

delete from public.company_members
where company_id in (
  '07c80000-0000-4000-8000-000000000001'::uuid,
  '07c80000-0000-4000-8000-000000000002'::uuid
);

delete from public.companies
where id in (
  '07c80000-0000-4000-8000-000000000001'::uuid,
  '07c80000-0000-4000-8000-000000000002'::uuid
);

commit;

select '07c8_cleanup' as operation,
       'fixture rows removed; synthetic Auth users retained' as result;
