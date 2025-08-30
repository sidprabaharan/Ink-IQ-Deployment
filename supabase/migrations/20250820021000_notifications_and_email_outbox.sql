-- Notifications and Email Outbox for automations

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  level text not null default 'info',
  title text not null,
  message text
);

alter table public.notifications enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='org_members_can_select_notifications'
  ) then
    create policy org_members_can_select_notifications on public.notifications
      for select using (
        exists (
          select 1 from public.org_users ou
          where ou.org_id = notifications.org_id and ou.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Email Outbox: to be processed by a separate sender function/integration
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'pending', -- pending | sent | failed
  attempts int not null default 0,
  org_id uuid not null references public.orgs(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  template text,
  variables jsonb
);

create index if not exists email_outbox_status_idx on public.email_outbox(status, created_at);
alter table public.email_outbox enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='email_outbox' and policyname='org_members_can_select_email_outbox'
  ) then
    create policy org_members_can_select_email_outbox on public.email_outbox
      for select using (
        exists (
          select 1 from public.org_users ou
          where ou.org_id = email_outbox.org_id and ou.user_id = auth.uid()
        )
      );
  end if;
end $$;


