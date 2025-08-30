-- Automation events and runs for status-change workflows
-- Creates tables, helper, and triggers on quotes and invoices

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending', -- pending | processing | done | failed
  attempts int not null default 0,
  org_id uuid not null references public.orgs(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  from_status text,
  to_status text not null,
  payload jsonb
);

create index if not exists automation_events_pending_idx on public.automation_events(status, created_at);
create index if not exists automation_events_org_idx on public.automation_events(org_id);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.automation_events(id) on delete cascade,
  rule_id text,
  action_type text not null,
  status text not null, -- success | error
  error text,
  context jsonb
);

-- Helper function to enqueue an automation event
create or replace function public.enqueue_automation_event(
  p_entity_type text,
  p_entity_id uuid,
  p_org_id uuid,
  p_from_status text,
  p_to_status text,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.automation_events(org_id, entity_type, entity_id, from_status, to_status, payload)
  values (p_org_id, p_entity_type, p_entity_id, p_from_status, p_to_status, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- Trigger on quotes to enqueue event after status change
create or replace function public.trg_quotes_status_changed()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  if (tg_op = 'UPDATE') and (coalesce(new.status, '') is distinct from coalesce(old.status, '')) then
    -- quotes has org_id column
    v_org_id := new.org_id;
    perform public.enqueue_automation_event('quote', new.id, v_org_id, old.status, new.status, jsonb_build_object('quote_number', new.quote_number));
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_after_status_change on public.quotes;
create trigger quotes_after_status_change
after update on public.quotes
for each row execute function public.trg_quotes_status_changed();

-- Trigger on invoices to enqueue event after status change
create or replace function public.trg_invoices_status_changed()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  if (tg_op = 'UPDATE') and (coalesce(new.status, '') is distinct from coalesce(old.status, '')) then
    v_org_id := new.org_id;
    perform public.enqueue_automation_event('invoice', new.id, v_org_id, old.status, new.status, jsonb_build_object('invoice_number', new.invoice_number));
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_after_status_change on public.invoices;
create trigger invoices_after_status_change
after update on public.invoices
for each row execute function public.trg_invoices_status_changed();

-- Basic RLS: allow org members to read their events/runs; only service role should insert/process
alter table public.automation_events enable row level security;
alter table public.automation_runs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'automation_events' and policyname = 'org_members_can_select_events') then
    create policy org_members_can_select_events on public.automation_events
      for select using (
        exists (
          select 1 from public.org_users ou
          where ou.org_id = automation_events.org_id and ou.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'automation_runs' and policyname = 'org_members_can_select_runs') then
    create policy org_members_can_select_runs on public.automation_runs
      for select using (
        exists (
          select 1 from public.org_users ou
          where ou.org_id in (
            select e.org_id from public.automation_events e where e.id = automation_runs.event_id
          ) and ou.user_id = auth.uid()
        )
      );
  end if;
end $$;


