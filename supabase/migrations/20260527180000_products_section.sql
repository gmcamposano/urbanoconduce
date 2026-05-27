create table if not exists public.products (
	id uuid primary key default gen_random_uuid(),
	title text not null unique,
	description text,
	price_without_taxes numeric not null check (price_without_taxes >= 0),
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now()),
	constraint products_title_not_blank check (btrim(title) <> '')
);

alter table public.products enable row level security;

create index if not exists products_created_by_idx on public.products using btree (created_by);
create index if not exists products_created_at_idx on public.products using btree (created_at desc);
create index if not exists products_title_idx on public.products using btree (title);

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row
execute function private.touch_updated_at();

grant select, insert, update, delete on public.products to authenticated;

drop policy if exists "Authenticated users can read products" on public.products;
drop policy if exists "Admins and editors can insert products" on public.products;
drop policy if exists "Admins and editors can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

create policy "Authenticated users can read products"
on public.products
for select
to authenticated
using (true);

create policy "Admins and editors can insert products"
on public.products
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update products"
on public.products
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete products"
on public.products
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');
