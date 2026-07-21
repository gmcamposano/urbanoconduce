-- Introduce price lists (tarifas): a named collection of per-product prices
-- assignable to one or more clients. Enables N clients to share the same
-- pricing structure without duplicating client_product_prices rows.
--
-- Resolution becomes 3-level (most specific wins):
--   1. client_product_prices (precio por cliente) — per-(client, product) exception
--   2. price_list_entries      (entrada de tarifa) — per-(assigned list, product)
--   3. products.price_without_taxes (precio de catálogo) — global default
--
-- Existing 12 client_product_prices overrides are left untouched as exceptions.
-- clients.default_price_list_id is nullable: null = no list assigned -> catalog.

-- 1. Price list header.
create table public.price_lists (
	id uuid primary key default gen_random_uuid(),
	name text not null check (btrim(name) <> ''),
	description text,
	created_by uuid references public.profiles(id),
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index price_lists_name_unique_idx
	on public.price_lists (lower(trim(name)));

-- 2. Price list entries: one row per (list, product).
create table public.price_list_entries (
	id uuid primary key default gen_random_uuid(),
	price_list_id uuid not null references public.price_lists(id) on delete cascade,
	product_id uuid not null references public.products(id) on delete cascade,
	unit_price numeric not null check (unit_price >= 0::numeric),
	created_by uuid references public.profiles(id),
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index price_list_entries_list_product_unique_idx
	on public.price_list_entries (price_list_id, product_id);

create index price_list_entries_product_id_idx
	on public.price_list_entries (product_id);

-- 3. Assign a default price list to a client (nullable).
alter table public.clients
	add column default_price_list_id uuid references public.price_lists(id) on delete set null;

-- 4. RLS — mirror the client_product_prices policy set.
alter table public.price_lists enable row level security;
alter table public.price_list_entries enable row level security;

create policy "Authenticated users can read price lists"
	on public.price_lists for select
	to authenticated
	using (true);

create policy "Admins and editors can insert price lists"
	on public.price_lists for insert
	to authenticated
	with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update price lists"
	on public.price_lists for update
	to authenticated
	using ((select private.get_user_role()) in ('admin', 'editor'))
	with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete price lists"
	on public.price_lists for delete
	to authenticated
	using ((select private.get_user_role()) = 'admin');

create policy "Authenticated users can read price list entries"
	on public.price_list_entries for select
	to authenticated
	using (true);

create policy "Admins and editors can insert price list entries"
	on public.price_list_entries for insert
	to authenticated
	with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update price list entries"
	on public.price_list_entries for update
	to authenticated
	using ((select private.get_user_role()) in ('admin', 'editor'))
	with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete price list entries"
	on public.price_list_entries for delete
	to authenticated
	using ((select private.get_user_role()) = 'admin');
