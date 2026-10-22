-- Etapa 07C: rollback emergencial da camada de acesso.
-- NÃO executa automaticamente e NÃO remove company_members nem seus dados.
-- Este rollback não restaura corpos antigos das RPCs. O snapshot comprovado em
-- scripts/supabase/baselines/07c2-current-financial-review-functions.sql deve
-- ser tratado separadamente, pois também restaura ACLs legadas inseguras.

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
  set search_path = '';

alter function public.finance_review_history(uuid,integer)
  security invoker;
alter function public.finance_review_history(uuid,integer)
  set search_path = '';

alter function public.finance_review_decide(uuid,text,text,integer)
  security invoker;
alter function public.finance_review_decide(uuid,text,text,integer)
  set search_path = '';

alter function public.finance_review_set_document_role(uuid,text,text)
  security invoker;
alter function public.finance_review_set_document_role(uuid,text,text)
  set search_path = '';

drop policy if exists "Company owners and members can view companies"
  on public.companies;

-- Restores the confirmed pre-07C visibility semantics. This is deliberately
-- broad and must be used only as an approved emergency compatibility rollback.
create policy "Authenticated users can view companies"
on public.companies
for select
to authenticated
using (true);

-- Restores only the four effective privileges confirmed by Block A. Grant
-- provenance and any privileges outside this set were not inventoried.
grant select, insert, update, delete on table public.companies
  to anon, authenticated;

commit;
