-- S&S Catalog Synchronization Schema
-- Tables to store S&S Activewear product catalog data locally

-- Suppliers table (for S&S and future suppliers)
create table if not exists public.suppliers (
  id text primary key, -- 'SS', 'SANMAR', etc.
  name text not null,
  api_endpoint text,
  api_version text,
  active boolean default true,
  last_sync timestamptz,
  sync_status text default 'pending', -- pending, syncing, complete, error
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- S&S product catalog table
create table if not exists public.ss_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.suppliers(id) on delete cascade,
  
  -- Core product data from PromoStandards
  style_id text not null, -- S&S style ID (e.g., "2000", "B15453")
  sku text not null, -- Primary SKU
  name text not null,
  brand text,
  description text,
  category text,
  
  -- Pricing data
  min_price decimal(10,2),
  max_price decimal(10,2),
  currency text default 'USD',
  price_last_updated timestamptz,
  
  -- Product attributes
  colors jsonb, -- Array of color objects: [{name, code, hex, swatchUrl}]
  sizes jsonb, -- Array of size strings: ["XS", "S", "M", "L", "XL"]
  materials text,
  weight_oz decimal(6,2),
  
  -- Images and media
  primary_image_url text,
  images jsonb, -- Array of image URLs
  
  -- Product flags from S&S
  is_closeout boolean default false,
  is_on_demand boolean default false,
  is_caution boolean default false,
  is_hazmat boolean default false,
  is_rush_service boolean default false,
  
  -- Lifecycle tracking
  effective_date timestamptz,
  end_date timestamptz,
  last_change_date timestamptz,
  
  -- Sync metadata
  source_data jsonb, -- Store raw S&S response for debugging
  sync_status text default 'active', -- active, discontinued, error
  last_synced timestamptz default now(),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(supplier_id, style_id)
);

-- S&S product variants table (color/size combinations)
create table if not exists public.ss_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.ss_products(id) on delete cascade,
  
  -- Variant identifiers
  part_id text not null, -- S&S part ID (e.g., "B00760033")
  sku text not null,
  
  -- Variant attributes
  color_name text not null,
  color_code text,
  color_hex text,
  size_label text not null, -- "S", "M", "L", etc.
  
  -- Pricing (variant-specific)
  price decimal(10,2),
  
  -- Physical attributes
  gtin text, -- Global Trade Item Number (barcode)
  weight_oz decimal(6,2),
  
  -- Images for this specific variant
  images jsonb, -- {front, back, side, swatch}
  
  -- Packaging info
  shipping_package jsonb, -- {type, quantity, dimensions, weight}
  
  -- Variant flags
  is_main_part boolean default false,
  manufactured_item boolean default false,
  
  -- Sync metadata
  last_synced timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(product_id, part_id)
);

-- S&S warehouse inventory table
create table if not exists public.ss_inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.ss_product_variants(id) on delete cascade,
  
  -- Warehouse info
  warehouse_id text not null, -- 'IL', 'KS', 'NV', 'TX', 'GA', 'NJ'
  warehouse_name text not null,
  warehouse_address jsonb, -- {city, state, postalCode}
  
  -- Inventory levels
  quantity_available integer not null default 0,
  
  -- Sync metadata
  as_of timestamptz not null default now(),
  last_synced timestamptz default now(),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(variant_id, warehouse_id)
);

-- S&S pricing matrix (FOB-specific pricing)
create table if not exists public.ss_pricing (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.ss_product_variants(id) on delete cascade,
  
  -- FOB (Freight on Board) location
  fob_id text not null, -- 'IL', 'KS', etc.
  fob_postal_code text,
  
  -- Pricing tiers
  min_quantity integer not null,
  price decimal(10,4) not null, -- High precision for pricing
  price_uom text default 'EA', -- Each, Dozen, etc.
  discount_code text,
  
  -- Price validity
  price_effective_date timestamptz,
  price_expiry_date timestamptz,
  
  -- Pricing metadata
  price_type text default 'Customer', -- Customer, Wholesale, etc.
  currency text default 'USD',
  
  -- Sync metadata
  last_synced timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(variant_id, fob_id, min_quantity)
);

-- Create indexes for performance
create index if not exists idx_ss_products_style_id on public.ss_products(style_id);
create index if not exists idx_ss_products_brand on public.ss_products(brand);
create index if not exists idx_ss_products_category on public.ss_products(category);
create index if not exists idx_ss_products_sync_status on public.ss_products(sync_status);
create index if not exists idx_ss_products_last_synced on public.ss_products(last_synced);

create index if not exists idx_ss_variants_part_id on public.ss_product_variants(part_id);
create index if not exists idx_ss_variants_color on public.ss_product_variants(color_name);
create index if not exists idx_ss_variants_size on public.ss_product_variants(size_label);

create index if not exists idx_ss_inventory_warehouse on public.ss_inventory(warehouse_id);
create index if not exists idx_ss_inventory_quantity on public.ss_inventory(quantity_available);
create index if not exists idx_ss_inventory_as_of on public.ss_inventory(as_of);

create index if not exists idx_ss_pricing_fob on public.ss_pricing(fob_id);
create index if not exists idx_ss_pricing_quantity on public.ss_pricing(min_quantity);

-- Enable RLS (Row Level Security) for multi-tenant support
alter table public.suppliers enable row level security;
alter table public.ss_products enable row level security;
alter table public.ss_product_variants enable row level security;
alter table public.ss_inventory enable row level security;
alter table public.ss_pricing enable row level security;

-- RLS policies (allow all authenticated users to read supplier catalogs)
do $$ begin
  create policy "authenticated users can read suppliers" on public.suppliers
    for select to authenticated using (true);
    
  create policy "authenticated users can read ss_products" on public.ss_products
    for select to authenticated using (true);
    
  create policy "authenticated users can read ss_variants" on public.ss_product_variants
    for select to authenticated using (true);
    
  create policy "authenticated users can read ss_inventory" on public.ss_inventory
    for select to authenticated using (true);
    
  create policy "authenticated users can read ss_pricing" on public.ss_pricing
    for select to authenticated using (true);
    
  -- Only service role can modify (for sync operations)
  create policy "service role can manage suppliers" on public.suppliers
    for all to service_role using (true) with check (true);
    
  create policy "service role can manage ss_products" on public.ss_products
    for all to service_role using (true) with check (true);
    
  create policy "service role can manage ss_variants" on public.ss_product_variants
    for all to service_role using (true) with check (true);
    
  create policy "service role can manage ss_inventory" on public.ss_inventory
    for all to service_role using (true) with check (true);
    
  create policy "service role can manage ss_pricing" on public.ss_pricing
    for all to service_role using (true) with check (true);
    
exception when duplicate_object then null; end $$;

-- Insert S&S Activewear supplier record
insert into public.suppliers (id, name, api_endpoint, api_version, active)
values ('SS', 'S&S Activewear', 'https://promostandards.ssactivewear.com', '2.0.0', true)
on conflict (id) do update set
  name = excluded.name,
  api_endpoint = excluded.api_endpoint,
  api_version = excluded.api_version,
  updated_at = now();

-- Helper functions for sync operations
create or replace function public.get_ss_products_for_sync(
  batch_size integer default 100,
  last_sync_before timestamptz default null
)
returns table (
  style_id text,
  name text,
  brand text,
  last_synced timestamptz
) language sql as $$
  select p.style_id, p.name, p.brand, p.last_synced
  from public.ss_products p
  where p.supplier_id = 'SS'
    and p.sync_status = 'active'
    and (last_sync_before is null or p.last_synced < last_sync_before)
  order by p.last_synced asc nulls first
  limit batch_size;
$$;

-- Function to update sync status
create or replace function public.update_supplier_sync_status(
  supplier_id text,
  new_status text
)
returns void language sql as $$
  update public.suppliers 
  set sync_status = new_status,
      last_sync = case when new_status = 'complete' then now() else last_sync end,
      updated_at = now()
  where id = supplier_id;
$$;

-- Function to get product inventory summary
create or replace function public.get_ss_product_inventory(
  product_style_id text
)
returns table (
  warehouse_id text,
  warehouse_name text,
  total_quantity bigint,
  last_updated timestamptz
) language sql as $$
  select 
    i.warehouse_id,
    i.warehouse_name,
    sum(i.quantity_available) as total_quantity,
    max(i.as_of) as last_updated
  from public.ss_inventory i
  join public.ss_product_variants v on v.id = i.variant_id
  join public.ss_products p on p.id = v.product_id
  where p.style_id = product_style_id
    and p.supplier_id = 'SS'
  group by i.warehouse_id, i.warehouse_name
  order by total_quantity desc;
$$;

-- Grant necessary permissions
grant usage on schema public to authenticated, anon;
grant select on public.suppliers to authenticated, anon;
grant select on public.ss_products to authenticated, anon;
grant select on public.ss_product_variants to authenticated, anon;
grant select on public.ss_inventory to authenticated, anon;
grant select on public.ss_pricing to authenticated, anon;

grant execute on function public.get_ss_products_for_sync to service_role;
grant execute on function public.update_supplier_sync_status to service_role;
grant execute on function public.get_ss_product_inventory to authenticated, anon;

