-- quote_imprints table and minimal policies
create table if not exists public.quote_imprints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_item_id uuid not null references public.quote_items(id) on delete cascade,
  method text not null,
  location text,
  width numeric,
  height numeric,
  colors_or_threads text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.quote_imprints enable row level security;

create policy if not exists "Users can manage imprints in their org" on public.quote_imprints
  for all to public
  using (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'))
  with check (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'));





