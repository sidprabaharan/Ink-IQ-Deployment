-- RLS policies for orgs: allow members of an org to view and update their org row

do $$ begin
  create policy if not exists "org members can select orgs" on public.orgs
    for select to public
    using (
      id in (
        select org_id from public.org_users
        where user_id = auth.uid() and status = 'active'
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists "org members can update orgs" on public.orgs
    for update to public
    using (
      id in (
        select org_id from public.org_users
        where user_id = auth.uid() and status = 'active'
      )
    )
    with check (
      id in (
        select org_id from public.org_users
        where user_id = auth.uid() and status = 'active'
      )
    );
exception when duplicate_object then null; end $$;

-- Optional: index to speed up membership lookups (already exists for org_users.org_id)



