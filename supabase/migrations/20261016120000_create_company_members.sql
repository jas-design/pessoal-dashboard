begin;

-- The financial schema predates the local migration history. Abort on any
-- unexpected shape instead of guessing or creating a duplicate object.
do $block$
declare
  v_broad_policy_count integer;
begin
  if to_regclass('public.companies') is null then
    raise exception 'Preflight failed: public.companies does not exist';
  end if;
  if to_regclass('public.company_members') is not null then
    raise exception 'Preflight failed: public.company_members already exists';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.oid = to_regprocedure('public.is_admin()')
      and n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'boolean'::regtype
      and pg_catalog.pg_get_userbyid(p.proowner)
        not in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'Preflight failed: trusted public.is_admin() contract not found';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies'
      and column_name = 'owner_id' and udt_name = 'uuid'
  ) then
    raise exception 'Preflight failed: companies.id/owner_id UUID contract not found';
  end if;

  select count(*) into v_broad_policy_count
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'companies'
    and p.polcmd = 'r'
    and trim(both '()' from pg_catalog.pg_get_expr(p.polqual, p.polrelid)) = 'true';

  if v_broad_policy_count <> 1 then
    raise exception
      'Preflight failed: expected one unrestricted SELECT policy on companies, found %',
      v_broad_policy_count;
  end if;
end;
$block$;

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'reviewer', 'viewer')),
  granted_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

comment on table public.company_members is
  'Explicit company access. The owner role remains authoritative in companies.owner_id.';

comment on column public.company_members.role is
  'Delegated role: admin, reviewer or viewer. Owner is derived from companies.owner_id.';

create index company_members_user_id_idx
  on public.company_members(user_id);

alter table public.company_members enable row level security;

create or replace function public.company_access_role(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when auth.uid() is null then null
    when exists (
      select 1
      from public.companies c
      where c.id = p_company_id
        and c.owner_id = auth.uid()
    ) then 'owner'
    else (
      select cm.role
      from public.company_members cm
      where cm.company_id = p_company_id
        and cm.user_id = auth.uid()
    )
  end;
$function$;

create or replace function public.company_can_view_financial_review(
  p_company_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce(
    public.company_access_role(p_company_id) in ('owner', 'admin', 'reviewer', 'viewer'),
    false
  );
$function$;

create or replace function public.company_can_decide_financial_review(
  p_company_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce(
    public.company_access_role(p_company_id) in ('owner', 'admin', 'reviewer'),
    false
  );
$function$;

create or replace function public.company_can_classify_financial_source(
  p_company_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce(
    public.company_access_role(p_company_id) in ('owner', 'admin'),
    false
  );
$function$;

revoke all on function public.company_access_role(uuid) from public, anon;
revoke all on function public.company_can_view_financial_review(uuid) from public, anon;
revoke all on function public.company_can_decide_financial_review(uuid) from public, anon;
revoke all on function public.company_can_classify_financial_source(uuid) from public, anon;
grant execute on function public.company_access_role(uuid) to authenticated, service_role;
grant execute on function public.company_can_view_financial_review(uuid) to authenticated, service_role;
grant execute on function public.company_can_decide_financial_review(uuid) to authenticated, service_role;
grant execute on function public.company_can_classify_financial_source(uuid) to authenticated, service_role;

revoke all on table public.company_members from anon, authenticated;
grant select, insert, delete on table public.company_members to authenticated;
grant update (role) on table public.company_members to authenticated;

create policy "Users can view their company memberships"
on public.company_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.company_access_role(company_id) = 'owner'
);

create policy "Company owners can add members"
on public.company_members
for insert
to authenticated
with check (
  public.company_access_role(company_id) = 'owner'
  and granted_by = auth.uid()
  and user_id <> auth.uid()
);

create policy "Company owners can change member roles"
on public.company_members
for update
to authenticated
using (public.company_access_role(company_id) = 'owner')
with check (
  public.company_access_role(company_id) = 'owner'
  and user_id <> auth.uid()
);

create policy "Company owners can remove members"
on public.company_members
for delete
to authenticated
using (public.company_access_role(company_id) = 'owner');

-- Drop only the unrestricted policy proven by the guard at the start.
do $block$
declare
  v_policy_name text;
begin
  select p.polname into strict v_policy_name
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'companies'
    and p.polcmd = 'r'
    and trim(both '()' from pg_catalog.pg_get_expr(p.polqual, p.polrelid)) = 'true';

  execute format('drop policy %I on public.companies', v_policy_name);
end;
$block$;

-- The real inventory shows broad DML grants even though current RLS blocks
-- them. Remove only the four inventoried privileges and preserve service_role.
revoke select, insert, update, delete on table public.companies from anon;
revoke insert, update, delete on table public.companies from authenticated;
grant select on table public.companies to authenticated;

create policy "Company owners and members can view companies"
on public.companies
for select
to authenticated
using (
  public.company_can_view_financial_review(id)
  or public.is_admin()
);

commit;
