-- Etapa 07C: rollback emergencial da camada de acesso.
-- NÃO executa automaticamente e NÃO remove company_members nem seus dados.
-- Este rollback não restaura corpos antigos das RPCs; isso depende da baseline
-- real ainda pendente, indicada na documentação 07C.

begin;

-- Restore direct access before returning wrappers to SECURITY INVOKER, so
-- there is no intermediate state in which the public RPCs cannot delegate.
grant usage on schema financial_private to authenticated;

grant execute on function financial_private.finance_review_list_impl(text,integer,integer)
  to authenticated;
grant execute on function financial_private.finance_review_history_impl(uuid,integer)
  to authenticated;
grant execute on function financial_private.finance_review_decide_impl(uuid,text,text,integer)
  to authenticated;
grant execute on function financial_private.finance_review_set_document_role_impl(uuid,text,text)
  to authenticated;

alter function public.finance_review_list(text,integer,integer)
  security invoker;
alter function public.finance_review_list(text,integer,integer)
  reset search_path;

alter function public.finance_review_history(uuid,integer)
  security invoker;
alter function public.finance_review_history(uuid,integer)
  reset search_path;

alter function public.finance_review_decide(uuid,text,text,integer)
  security invoker;
alter function public.finance_review_decide(uuid,text,text,integer)
  reset search_path;

alter function public.finance_review_set_document_role(uuid,text,text)
  security invoker;
alter function public.finance_review_set_document_role(uuid,text,text)
  reset search_path;

drop policy if exists "Company owners and members can view companies"
  on public.companies;

-- Restores the confirmed pre-07C visibility semantics. This is deliberately
-- broad and must be used only as an approved emergency compatibility rollback.
create policy "07C rollback authenticated users can view companies"
on public.companies
for select
to authenticated
using (true);

commit;
