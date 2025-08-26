-- Production scheduler minimal schema and RPCs

-- Tables
create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_item_id uuid references public.quote_items(id) on delete set null,
  imprint_id uuid references public.quote_imprints(id) on delete set null,
  job_number text,
  status text not null default 'unscheduled',
  customer_name text,
  description text,
  decoration_method text not null,
  placement text,
  size text,
  colours text,
  total_quantity int not null default 0,
  estimated_hours numeric(8,2) default 0,
  due_date timestamptz,
  priority text default 'medium',
  current_stage text,
  equipment_id text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  mockup_image_path text,
  assigned_user_id uuid references auth.users(id),
  quote_updated_at timestamptz,
  created_at timestamptz default now()
);

alter table public.production_jobs enable row level security;

do $$ begin
  create policy "org members can manage production_jobs" on public.production_jobs
    for all to public
    using (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'))
    with check (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'));
exception when duplicate_object then null; end $$;

create index if not exists idx_production_jobs_org on public.production_jobs(org_id);
create index if not exists idx_production_jobs_quote on public.production_jobs(quote_id);
create index if not exists idx_production_jobs_status on public.production_jobs(status);
create index if not exists idx_production_jobs_method on public.production_jobs(decoration_method);

-- Audit table (optional but used by UI)
create table if not exists public.production_job_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);
alter table public.production_job_audit enable row level security;
do $$ begin
  create policy "org members can insert audit" on public.production_job_audit
    for insert to public
    with check (true);
exception when duplicate_object then null; end $$;

-- Telemetry table + rpc used by frontend track()
create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  org_id uuid references public.orgs(id),
  event_name text not null,
  payload jsonb,
  created_at timestamptz default now()
);
alter table public.telemetry_events enable row level security;
do $$ begin
  create policy "org members can insert telemetry" on public.telemetry_events
    for insert to public
    with check (true);
exception when duplicate_object then null; end $$;

-- RPCs

-- Create jobs from quote items (one per quote_item)
drop function if exists public.create_jobs_from_quote(uuid);
create or replace function public.create_jobs_from_quote(p_quote_id uuid)
returns setof public.production_jobs
language plpgsql as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.quotes where id = p_quote_id;
  if v_org is null then
    raise exception 'Quote not found';
  end if;

  -- Insert jobs for each quote item if not already present for this item
  insert into public.production_jobs(
    org_id, quote_id, quote_item_id, status, customer_name, description,
    decoration_method, placement, size, colours, total_quantity, estimated_hours,
    due_date, priority, current_stage, mockup_image_path, quote_updated_at
  )
  select
    v_org,
    q.id,
    qi.id,
    'unscheduled',
    c.name,
    coalesce(qi.product_description, qi.product_name),
    case lower(coalesce(qi.imprint_type, 'screen_printing'))
      when 'screen printing' then 'screen_printing'
      when 'screen_print' then 'screen_printing'
      when 'embroidery' then 'embroidery'
      when 'dtf' then 'dtf'
      when 'dtg' then 'dtg'
      else 'screen_printing'
    end,
    null,
    null,
    qi.color,
    coalesce(qi.quantity, 0),
    0,
    coalesce(q.production_due_date, q.customer_due_date),
    'medium',
    null,
    null,
    q.updated_at
  from public.quotes q
  join public.customers c on c.id = q.customer_id
  join public.quote_items qi on qi.quote_id = q.id
  where q.id = p_quote_id
    and not exists (
      select 1 from public.production_jobs pj
      where pj.quote_item_id = qi.id
    )
  returning *;
end$$;

-- List jobs for org (basic filters)
drop function if exists public.get_production_jobs(text, text);
create or replace function public.get_production_jobs(p_method text default null, p_stage text default null)
returns setof public.production_jobs
language sql
stable
as $$
  select * from public.production_jobs pj
  where pj.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')
    and (p_method is null or pj.decoration_method = p_method)
    and (p_stage is null or coalesce(pj.current_stage, '') = p_stage)
  order by pj.created_at desc
$$;

-- Minimal config rpc: list available methods (stages left empty for now)
drop function if exists public.get_production_config();
create or replace function public.get_production_config()
returns json language plpgsql as $$
begin
  return json_build_array(
    json_build_object('method_code','screen_printing','decorations', json_build_array(json_build_object('stages', json_build_array()))),
    json_build_object('method_code','embroidery','decorations', json_build_array(json_build_object('stages', json_build_array()))),
    json_build_object('method_code','dtf','decorations', json_build_array(json_build_object('stages', json_build_array()))),
    json_build_object('method_code','dtg','decorations', json_build_array(json_build_object('stages', json_build_array())))
  );
end$$;

-- Move job (update schedule and stage)
drop function if exists public.move_job(uuid, text, timestamptz, timestamptz, text);
create or replace function public.move_job(p_job_id uuid, p_stage text, p_start timestamptz, p_end timestamptz, p_equipment_id text)
returns void language sql as $$
  update public.production_jobs
  set current_stage = p_stage,
      scheduled_start = p_start,
      scheduled_end = p_end,
      equipment_id = p_equipment_id,
      status = 'scheduled'
  where id = p_job_id;
$$;

-- Unschedule job
drop function if exists public.unschedule_job(uuid);
create or replace function public.unschedule_job(p_job_id uuid)
returns void language sql as $$
  update public.production_jobs
  set current_stage = null,
      scheduled_start = null,
      scheduled_end = null,
      equipment_id = null,
      status = 'unscheduled'
  where id = p_job_id;
$$;

-- Update job status
drop function if exists public.update_job_status(uuid, text);
create or replace function public.update_job_status(p_job_id uuid, p_status text)
returns void language sql as $$
  update public.production_jobs
  set status = p_status
  where id = p_job_id;
$$;

-- Audit RPC used by UI
drop function if exists public.create_job_audit_event(uuid, text, jsonb);
create or replace function public.create_job_audit_event(p_job_id uuid, p_action text, p_details jsonb)
returns void language sql as $$
  insert into public.production_job_audit(job_id, action, details)
  values (p_job_id, p_action, p_details);
$$;

-- Telemetry RPC to avoid 404 on emit_event
drop function if exists public.emit_event(text, jsonb);
create or replace function public.emit_event(p_event_name text, p_payload jsonb)
returns void language plpgsql as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.org_users where user_id = auth.uid() and status='active' limit 1;
  insert into public.telemetry_events(user_id, org_id, event_name, payload)
  values (auth.uid(), v_org, p_event_name, p_payload);
end$$;






