-- Create a public bucket for organization logos and add scoped policies

do $$ begin
  insert into storage.buckets (id, name, public)
  values ('org-logos', 'org-logos', true)
  on conflict (id) do nothing;
exception when undefined_table then null; end $$;

-- Allow public read of org logos (bucket is public; this policy is harmless for self-hosted)
do $$ begin
  create policy if not exists "read org logos"
    on storage.objects for select to public
    using (bucket_id = 'org-logos');
exception when duplicate_object then null; end $$;

-- Allow authenticated users to manage files only under their orgId prefix
do $$ begin
  create policy if not exists "org members manage their logos"
    on storage.objects for all to public
    using (
      bucket_id = 'org-logos'
      and auth.uid() is not null
      and name like ('orgs/' || public.get_user_org() || '/%')
    )
    with check (
      bucket_id = 'org-logos'
      and auth.uid() is not null
      and name like ('orgs/' || public.get_user_org() || '/%')
    );
exception when duplicate_object then null; end $$;




