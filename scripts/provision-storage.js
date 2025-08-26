/*
  Creates public storage bucket `org-logos`, helper function `public.get_user_org()`,
  and RLS policies for reading and org-scoped writes.
*/

const { Client } = require('pg')

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) {
    console.error('Missing SUPABASE_DB_PASSWORD env var')
    process.exit(1)
  }

  const client = new Client({
    user: 'postgres.eqdlaagjaikxdrkgvopn',
    host: 'aws-1-ca-central-1.pooler.supabase.com',
    database: 'postgres',
    password,
    port: 6543,
    ssl: { rejectUnauthorized: false },
  })

  const sql = `
  do $$ begin
    insert into storage.buckets (id, name, public)
    values ('org-logos', 'org-logos', true)
    on conflict (id) do nothing;
  exception when undefined_table then null; end $$;

  create or replace function public.get_user_org()
  returns uuid language sql stable as $$
    select org_id from public.org_users
    where user_id = auth.uid() and status = 'active'
    limit 1
  $$;

  do $$ begin
    create policy "read org logos"
      on storage.objects for select to public
      using (bucket_id = 'org-logos');
  exception when duplicate_object then null; end $$;

  do $$ begin
    create policy "org members manage their logos"
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
  `

  try {
    await client.connect()
    const res = await client.query(sql)
    console.log('Provisioned storage bucket and policies.')
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})




