-- Leads CRM: table, policies, and helper RPCs

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  status text not null default 'new_lead',
  value numeric(12,2) default 0,
  notes text,
  customer_type text default 'new',
  existing_customer_id uuid references public.customers(id) on delete set null,
  ai_enriched boolean default false,
  data_source text default 'manual',
  confidence_score numeric(4,2),
  job_title text,
  address jsonb,
  social_profiles jsonb,
  company_info jsonb,
  total_activities int default 0,
  last_activity_type text,
  quote_id uuid references public.quotes(id) on delete set null,
  created_at timestamptz default now(),
  last_contacted_at timestamptz
);

alter table public.leads enable row level security;

do $$ begin
  create policy "org members can manage leads" on public.leads
    for all to public
    using (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'))
    with check (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'));
exception when duplicate_object then null; end $$;

create index if not exists idx_leads_org on public.leads(org_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_created_at on public.leads(created_at);

-- Helper RPCs
drop function if exists public.create_lead(text, text, text, text, text, numeric, text);
create or replace function public.create_lead(
  p_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_status text default 'new_lead',
  p_value numeric default 0,
  p_notes text default null
)
returns json language plpgsql as $$
declare
  v_org uuid;
  v_id uuid := gen_random_uuid();
begin
  select org_id into v_org from public.org_users where user_id = auth.uid() and status='active' limit 1;
  if v_org is null then
    raise exception 'No organization found for user';
  end if;

  insert into public.leads(id, org_id, name, company, email, phone, status, value, notes)
  values (v_id, v_org, p_name, p_company, p_email, p_phone, coalesce(p_status,'new_lead'), coalesce(p_value,0), p_notes);

  return json_build_object('lead_id', v_id);
end$$;

drop function if exists public.get_leads(int, int);
create or replace function public.get_leads(p_page int default 1, p_size int default 100)
returns setof public.leads
language sql
stable
as $$
  select * from public.leads l
  where l.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')
  order by l.created_at desc
  limit p_size offset (p_page-1)*p_size
$$;





