-- Invoices feature: tables, policies, and minimal helper functions

-- invoices table
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null unique,
  status text not null default 'draft', -- draft, sent, partially_paid, paid, void, overdue
  invoice_date timestamptz not null default now(),
  due_date timestamptz,
  subtotal numeric(12,2) default 0,
  tax_amount numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  shipping_amount numeric(12,2) default 0,
  total_amount numeric(12,2) default 0,
  balance_due numeric(12,2) default 0,
  currency text default 'USD',
  notes text,
  terms text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- invoice_items table
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_no int not null default 1,
  item_type text not null default 'product', -- product | discount | shipping
  product_name text,
  product_sku text,
  description text,
  category text,
  color text,
  qty int default 0,
  unit_price numeric(12,2) default 0,
  line_subtotal numeric(12,2) default 0,
  taxed boolean default true,
  xs int default 0,
  s int default 0,
  m int default 0,
  l int default 0,
  xl int default 0,
  xxl int default 0,
  xxxl int default 0,
  group_index int,
  group_label text,
  created_at timestamptz default now()
);

-- invoice_payments table
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null, -- cash | card | ach | check | other
  reference text,
  received_at timestamptz not null default now(),
  memo text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- invoice_status_history table
create table if not exists public.invoice_status_history (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  reason text
);

-- Row Level Security
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_status_history enable row level security;

-- RLS policies (org scoped)
do $$ begin
  create policy "org members can manage invoices" on public.invoices
    for all to public
    using (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'))
    with check (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "org members can manage invoice_items" on public.invoice_items
    for all to public
    using (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and i.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')))
    with check (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and i.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "org members can manage invoice_payments" on public.invoice_payments
    for all to public
    using (exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and i.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')))
    with check (exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id and i.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "org members can manage invoice_status_history" on public.invoice_status_history
    for all to public
    using (exists (select 1 from public.invoices i where i.id = invoice_status_history.invoice_id and i.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')))
    with check (exists (select 1 from public.invoices i where i.id = invoice_status_history.invoice_id and i.org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active')));
exception when duplicate_object then null; end $$;

-- indexes
create index if not exists idx_invoices_org on public.invoices(org_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);
create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);
create index if not exists idx_invoice_payments_invoice on public.invoice_payments(invoice_id);

-- Atomic invoice number counters (per org per year)
create table if not exists public.invoice_counters (
  org_id uuid not null references public.orgs(id) on delete cascade,
  yr text not null,
  last_seq int not null default 0,
  primary key(org_id, yr)
);

alter table public.invoice_counters enable row level security;
do $$ begin
  create policy "org members can use invoice_counters" on public.invoice_counters
    for all to public
    using (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'))
    with check (org_id in (select org_id from public.org_users where user_id = auth.uid() and status='active'));
exception when duplicate_object then null; end $$;

-- Helper: generate invoice number (simple sequential per year per org)
create or replace function public.generate_invoice_number(p_org_id uuid)
returns text language plpgsql as $$
declare
  yr text := to_char(now(), 'YYYY');
  new_seq int;
  candidate text;
begin
  -- Atomically compute next sequence using existing invoices as baseline
  insert into public.invoice_counters(org_id, yr, last_seq)
  values (
    p_org_id,
    yr,
    (
      select coalesce(max(split_part(invoice_number, '-', 3)::int), 0) + 1
      from public.invoices
      where org_id = p_org_id and split_part(invoice_number, '-', 2) = yr
    )
  )
  on conflict (org_id, yr)
  do update set last_seq = greatest(
    public.invoice_counters.last_seq,
    (
      select coalesce(max(split_part(invoice_number, '-', 3)::int), 0)
      from public.invoices
      where org_id = p_org_id and split_part(invoice_number, '-', 2) = yr
    )
  ) + 1
  returning last_seq into new_seq;

  candidate := 'INV-' || yr || '-' || lpad(new_seq::text, 5, '0');
  return candidate;
end$$;

-- Minimal: create invoice from quote (full snapshot)
create or replace function public.create_invoice_from_quote(p_quote_id uuid, p_invoice_date timestamptz default now(), p_due_date timestamptz default null)
returns table(invoice_id uuid) language plpgsql as $$
declare
  v_org uuid;
  v_new_id uuid := gen_random_uuid();
  v_number text;
begin
  select org_id into v_org from public.quotes where id = p_quote_id;
  if v_org is null then
    raise exception 'Quote not found';
  end if;
  v_number := public.generate_invoice_number(v_org);
  -- Insert invoice; if number collision occurs (extreme race), retry with a fresh number
  begin
    insert into public.invoices(id, org_id, quote_id, customer_id, invoice_number, status, invoice_date, due_date, subtotal, tax_amount, discount_amount, shipping_amount, total_amount, balance_due)
    select v_new_id, q.org_id, q.id, q.customer_id, v_number, 'draft', coalesce(p_invoice_date, now()), p_due_date,
           coalesce(sum(qi.total_price),0), coalesce(q.tax_amount,0), coalesce(q.discount_amount,0), 0,
           coalesce(q.final_amount, coalesce(sum(qi.total_price),0)), coalesce(q.final_amount, coalesce(sum(qi.total_price),0))
    from public.quotes q
    left join public.quote_items qi on qi.quote_id = q.id
    where q.id = p_quote_id
    group by q.id, q.org_id, q.tax_amount, q.discount_amount, q.final_amount;
  exception when unique_violation then
    -- regenerate once and retry
    v_number := public.generate_invoice_number(v_org);
    insert into public.invoices(id, org_id, quote_id, customer_id, invoice_number, status, invoice_date, due_date, subtotal, tax_amount, discount_amount, shipping_amount, total_amount, balance_due)
    select v_new_id, q.org_id, q.id, q.customer_id, v_number, 'draft', coalesce(p_invoice_date, now()), p_due_date,
           coalesce(sum(qi.total_price),0), coalesce(q.tax_amount,0), coalesce(q.discount_amount,0), 0,
           coalesce(q.final_amount, coalesce(sum(qi.total_price),0)), coalesce(q.final_amount, coalesce(sum(qi.total_price),0))
    from public.quotes q
    left join public.quote_items qi on qi.quote_id = q.id
    where q.id = p_quote_id
    group by q.id, q.org_id, q.tax_amount, q.discount_amount, q.final_amount;
  end;

  -- snapshot items
  insert into public.invoice_items(
    invoice_id, line_no, item_type, product_name, product_sku, description, category, color,
    qty, unit_price, line_subtotal, taxed,
    xs, s, m, l, xl, xxl, xxxl,
    group_index, group_label
  )
  select v_new_id,
         row_number() over (order by qi.created_at),
         'product',
         coalesce(qi.product_name, 'Product'),
         qi.product_sku,
         qi.product_description,
         qi.category,
         qi.color,
         coalesce(qi.quantity,0),
         coalesce(qi.unit_price,0),
         coalesce(qi.total_price,0),
         coalesce(qi.taxed,true),
         coalesce(qi.xs,0), coalesce(qi.s,0), coalesce(qi.m,0), coalesce(qi.l,0), coalesce(qi.xl,0), coalesce(qi.xxl,0), coalesce(qi.xxxl,0),
         qi.group_index, qi.group_label
  from public.quote_items qi
  where qi.quote_id = p_quote_id;

  return query select v_new_id;
end$$;

-- Get invoices simple
create or replace function public.get_invoices(p_page int default 1, p_size int default 50)
returns table(invoices json) language plpgsql as $$
begin
  return query
  select json_agg(i) from (
    select inv.*, c.name as customer_name, c.company as customer_company
    from public.invoices inv
    left join public.customers c on c.id = inv.customer_id
    order by inv.created_at desc
    limit p_size offset (p_page-1)*p_size
  ) i;
end$$;

-- Get invoice by id with items and payments
create or replace function public.get_invoice(p_invoice_id uuid)
returns json language plpgsql as $$
declare
  v json;
begin
  select json_build_object(
    'invoice', i.*, 
    'items', (select json_agg(ii.*) from public.invoice_items ii where ii.invoice_id = i.id),
    'payments', (select json_agg(ip.*) from public.invoice_payments ip where ip.invoice_id = i.id)
  ) into v
  from public.invoices i where i.id = p_invoice_id;
  return v;
end$$;

-- Update status (immutability enforced by allowed transitions)
create or replace function public.update_invoice_status(p_invoice_id uuid, p_new_status text)
returns void language plpgsql as $$
declare
  v_old text;
begin
  select status into v_old from public.invoices where id = p_invoice_id;
  if v_old is null then raise exception 'Invoice not found'; end if;
  if v_old = 'paid' or v_old = 'void' then return; end if;
  if v_old = 'draft' and p_new_status not in ('sent','void') then return; end if;
  if v_old = 'sent' and p_new_status not in ('partially_paid','paid','void') then return; end if;
  if v_old = 'partially_paid' and p_new_status not in ('paid','void') then return; end if;
  update public.invoices set status = p_new_status, updated_at = now() where id = p_invoice_id;
  insert into public.invoice_status_history(invoice_id, from_status, to_status, changed_by)
  values (p_invoice_id, v_old, p_new_status, auth.uid());
end$$;

-- Record payment
create or replace function public.record_payment(p_invoice_id uuid, p_amount numeric, p_method text, p_reference text, p_received_at timestamptz, p_memo text)
returns void language plpgsql as $$
declare
  v_total numeric;
  v_paid numeric;
  v_new_status text;
begin
  insert into public.invoice_payments(invoice_id, amount, method, reference, received_at, memo, created_by)
  values (p_invoice_id, p_amount, p_method, p_reference, coalesce(p_received_at, now()), p_memo, auth.uid());

  select total_amount into v_total from public.invoices where id = p_invoice_id;
  select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id = p_invoice_id;
  update public.invoices set balance_due = greatest(v_total - v_paid, 0) where id = p_invoice_id;
  v_new_status := case when v_paid >= v_total then 'paid' else 'partially_paid' end;
  perform public.update_invoice_status(p_invoice_id, v_new_status);
end$$;


