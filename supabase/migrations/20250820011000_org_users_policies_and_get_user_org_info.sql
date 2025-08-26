-- RLS policies for org_users so users can see/manage their memberships

do $$ begin
  create policy if not exists "user can select own org_users" on public.org_users
    for select to public
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists "user can insert own org_users" on public.org_users
    for insert to public
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists "user can update own org_users" on public.org_users
    for update to public
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Return the signed-in user's organization info (matches frontend typings)
create or replace function public.get_user_org_info()
returns table (
  org_id uuid,
  org_name text,
  org_slug text,
  org_settings jsonb,
  user_role text,
  member_count integer
) language sql stable as $$
  select
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    o.settings as org_settings,
    ou.role as user_role,
    (
      select count(*)::int from public.org_users ou2
      where ou2.org_id = o.id and ou2.status = 'active'
    ) as member_count
  from public.org_users ou
  join public.orgs o on o.id = ou.org_id
  where ou.user_id = auth.uid()
    and ou.status = 'active'
  order by o.created_at asc
$$;




