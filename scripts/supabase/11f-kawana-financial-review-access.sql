-- Grant the only active non-owner dashboard administrator access to Kawana.
-- This is an operational data authorization, not a schema migration.
-- Review the selected user in Supabase Auth before running this script manually.

begin;

do $block$
declare
  v_company_id constant uuid := '468978dd-6ffa-440e-9465-df966ba093ee';
  v_owner_id uuid;
  v_user_id uuid;
  v_candidate_count integer;
begin
  select owner_id
  into strict v_owner_id
  from public.companies
  where id = v_company_id
    and is_active = true;

  select count(*), min(profile.id::text)::uuid
  into v_candidate_count, v_user_id
  from public.profiles profile
  where profile.status = 'active'
    and profile.role = 'admin'
    and profile.id <> v_owner_id;

  if v_candidate_count <> 1 then
    raise exception
      'Expected exactly one active non-owner administrator; found %',
      v_candidate_count;
  end if;

  if exists (
    select 1
    from public.company_members member
    where member.company_id = v_company_id
      and member.user_id = v_user_id
  ) then
    raise exception 'The selected user already has Kawana company access';
  end if;

  insert into public.company_members (
    company_id,
    user_id,
    role,
    granted_by
  ) values (
    v_company_id,
    v_user_id,
    'admin',
    v_owner_id
  );
end;
$block$;

commit;
