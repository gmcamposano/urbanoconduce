-- Warehouse for the single central stock location (ready to scale later)
create table if not exists public.warehouses (
	id uuid primary key default gen_random_uuid(),
	name text not null check (btrim(name) <> ''),
	is_default boolean not null default false,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.warehouses enable row level security;

create index if not exists warehouses_is_default_idx on public.warehouses using btree (is_default);

drop policy if exists "Authenticated users can read warehouses" on public.warehouses;
drop policy if exists "Admins and editors can manage warehouses" on public.warehouses;

create policy "Authenticated users can read warehouses"
	on public.warehouses
	for select
	to authenticated
	using (true);

create policy "Admins and editors can manage warehouses"
	on public.warehouses
	for all
	to authenticated
	using ((select private.get_user_role()) in ('admin', 'editor'))
	with check ((select private.get_user_role()) in ('admin', 'editor'));

insert into public.warehouses (name, is_default)
values ('Bodega Central', true)
on conflict do nothing;

-- Product variants: a product already has a model, so the variant is color-level.
create table if not exists public.product_variants (
	id uuid primary key default gen_random_uuid(),
	product_id uuid not null references public.products(id) on delete cascade,
	color text not null default '',
	sku text,
	min_stock numeric not null default 0 check (min_stock >= 0),
	purchase_price numeric check (purchase_price >= 0),
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now()),
	constraint product_variants_product_color_unique unique (product_id, color)
);

alter table public.product_variants enable row level security;

create index if not exists product_variants_product_id_idx on public.product_variants using btree (product_id);
create index if not exists product_variants_color_idx on public.product_variants using btree (color);

drop policy if exists "Authenticated users can read product variants" on public.product_variants;
drop policy if exists "Admins and editors can manage product variants" on public.product_variants;

create policy "Authenticated users can read product variants"
	on public.product_variants
	for select
	to authenticated
	using (true);

create policy "Admins and editors can manage product variants"
	on public.product_variants
	for all
	to authenticated
	using ((select private.get_user_role()) in ('admin', 'editor'))
	with check ((select private.get_user_role()) in ('admin', 'editor'));

-- Inventory movements: every change in stock is recorded here.
create table if not exists public.inventory_movements (
	id uuid primary key default gen_random_uuid(),
	product_variant_id uuid not null references public.product_variants(id) on delete restrict,
	warehouse_id uuid not null references public.warehouses(id) on delete restrict,
	type text not null check (type = any (array['initial'::text, 'purchase'::text, 'sale'::text, 'internal_transfer'::text, 'return'::text, 'adjustment'::text])),
	quantity numeric not null,
	reference_type text check (reference_type is null or reference_type in ('invoice')),
	reference_id uuid,
	notes text,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	constraint inventory_movements_quantity_sign check (
		(type in ('initial', 'purchase', 'return') and quantity > 0)
		or (type in ('sale', 'internal_transfer') and quantity < 0)
		or (type = 'adjustment')
	)
);

alter table public.inventory_movements enable row level security;

create index if not exists inventory_movements_variant_idx on public.inventory_movements using btree (product_variant_id);
create index if not exists inventory_movements_warehouse_idx on public.inventory_movements using btree (warehouse_id);
create index if not exists inventory_movements_reference_idx on public.inventory_movements using btree (reference_type, reference_id);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements using btree (created_at desc);

drop policy if exists "Authenticated users can read inventory movements" on public.inventory_movements;
drop policy if exists "Admins and editors can manage inventory movements" on public.inventory_movements;

create policy "Authenticated users can read inventory movements"
	on public.inventory_movements
	for select
	to authenticated
	using (true);

create policy "Admins and editors can manage inventory movements"
	on public.inventory_movements
	for all
	to authenticated
	using ((select private.get_user_role()) in ('admin', 'editor'))
	with check ((select private.get_user_role()) in ('admin', 'editor'));

-- Invoice document type: extends factura_tipo with internal transfers (despachos).
alter table public.invoices add column if not exists document_type text not null default 'proforma'
	check (document_type = any (array['proforma'::text, 'factura'::text, 'interna'::text]));

update public.invoices
set document_type = case
	when factura_tipo = 'proforma' then 'proforma'
	else 'factura'
end;

-- Link invoice items to product variants for automatic stock tracking.
alter table public.invoice_items add column if not exists product_variant_id uuid references public.product_variants(id) on delete set null;

create index if not exists invoice_items_product_variant_id_idx on public.invoice_items using btree (product_variant_id);

-- Auto-generate variants from historical invoice items.
insert into public.product_variants (product_id, color, created_by)
select distinct
	ii.product_id,
	coalesce(lower(trim(ii.color)), ''),
	p.created_by
from public.invoice_items ii
join public.products p on p.id = ii.product_id
where ii.product_id is not null
on conflict (product_id, color) do nothing;

-- Backfill invoice items with their matching variant.
update public.invoice_items ii
set product_variant_id = pv.id
from public.product_variants pv
where pv.product_id = ii.product_id
	and pv.color = coalesce(lower(trim(ii.color)), '');

-- Ensure timestamps are kept up to date.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = timezone('utc'::text, now());
	return new;
end;
$$;

drop trigger if exists set_warehouses_updated_at on public.warehouses;
create trigger set_warehouses_updated_at
	before update on public.warehouses
	for each row
	execute function private.set_updated_at();

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at
	before update on public.product_variants
	for each row
	execute function private.set_updated_at();
