-- ==========================================
-- Database Schema for Invoice Generator App
-- ==========================================

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
	id uuid primary key references auth.users on delete cascade,
	email text not null,
	name text,
	role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
	updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.invoices (
	id uuid primary key default gen_random_uuid(),
	invoice_number text not null unique,
	client_name text not null,
	client_email text not null,
	invoice_date date not null default current_date,
	due_date date not null,
	status text not null default 'draft' check (status in ('draft', 'pending', 'paid', 'overdue')),
	notes text,
	tax_rate numeric not null default 0,
	discount_amount numeric not null default 0,
	total_amount numeric not null default 0,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.clients (
	id uuid primary key default gen_random_uuid(),
	client_type text not null check (client_type in ('person', 'company')),
	full_name text,
	alias text,
	rnc text,
	company_name text,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now()),
	constraint clients_required_fields check (
		(
			client_type = 'person'
			and btrim(coalesce(full_name, '')) <> ''
		)
		or (
			client_type = 'company'
			and btrim(coalesce(alias, '')) <> ''
			and btrim(coalesce(rnc, '')) <> ''
			and btrim(coalesce(company_name, '')) <> ''
		)
	)
);

create table if not exists public.invoice_items (
	id uuid primary key default gen_random_uuid(),
	invoice_id uuid not null references public.invoices(id) on delete cascade,
	description text not null,
	quantity numeric not null check (quantity > 0),
	unit_price numeric not null check (unit_price >= 0),
	amount numeric not null,
	created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.clients enable row level security;
alter table public.invoice_items enable row level security;

create index if not exists profiles_role_idx on public.profiles using btree (role);
create index if not exists invoices_created_by_idx on public.invoices using btree (created_by);
create index if not exists invoices_created_at_idx on public.invoices using btree (created_at desc);
create index if not exists clients_created_by_idx on public.clients using btree (created_by);
create index if not exists clients_created_at_idx on public.clients using btree (created_at desc);
create index if not exists clients_client_type_idx on public.clients using btree (client_type);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items using btree (invoice_id);

create or replace function private.get_user_role()
returns text
language sql
security definer
set search_path = public
as $$
	select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

revoke all on function private.get_user_role() from public;
grant execute on function private.get_user_role() to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	new.updated_at = timezone('utc'::text, now());
	return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	chosen_role text;
begin
	chosen_role := case new.raw_user_meta_data->>'role'
		when 'admin' then 'admin'
		when 'editor' then 'editor'
		else 'viewer'
	end;

	insert into public.profiles (id, email, name, role)
	values (
		new.id,
		new.email,
		coalesce(new.raw_user_meta_data->>'name', 'New User'),
		chosen_role
	)
	on conflict (id) do update set
		email = excluded.email,
		name = excluded.name,
		role = excluded.role,
		updated_at = timezone('utc'::text, now());

	return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.touch_updated_at() from public;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function private.touch_updated_at();

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
before update on public.clients
for each row
execute function private.touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Allow public read access to profiles" on public.profiles;
drop policy if exists "Allow users to update their own profile info" on public.profiles;
drop policy if exists "Allow admins to update any profile role" on public.profiles;

create policy "Profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

create policy "Profiles can be updated by owner or admin"
on public.profiles
for update
to authenticated
using (
	(select private.get_user_role()) = 'admin'
	or (
		(select auth.uid()) = id
		and role = (select role from public.profiles where id = auth.uid())
	)
)
with check (
	(select private.get_user_role()) = 'admin'
	or (
		(select auth.uid()) = id
		and role = (select role from public.profiles where id = auth.uid())
	)
);

drop policy if exists "Authenticated users can read clients" on public.clients;
drop policy if exists "Admins and editors can insert clients" on public.clients;
drop policy if exists "Admins and editors can update clients" on public.clients;
drop policy if exists "Admins can delete clients" on public.clients;

create policy "Authenticated users can read clients"
on public.clients
for select
to authenticated
using (true);

create policy "Admins and editors can insert clients"
on public.clients
for insert
to authenticated
with check (true);

create policy "Admins and editors can update clients"
on public.clients
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete clients"
on public.clients
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');

drop policy if exists "Allow authenticated users to read all invoices" on public.invoices;
drop policy if exists "Allow admins and editors to insert invoices" on public.invoices;
drop policy if exists "Allow admins and editors to update invoices" on public.invoices;
drop policy if exists "Allow admins to delete invoices" on public.invoices;

create policy "Authenticated users can read invoices"
on public.invoices
for select
to authenticated
using (true);

create policy "Admins and editors can insert invoices"
on public.invoices
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update invoices"
on public.invoices
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete invoices"
on public.invoices
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');

drop policy if exists "Allow authenticated users to read invoice items" on public.invoice_items;
drop policy if exists "Allow admins and editors to insert invoice items" on public.invoice_items;
drop policy if exists "Allow admins and editors to update invoice items" on public.invoice_items;
drop policy if exists "Allow admins to delete invoice items" on public.invoice_items;

create policy "Authenticated users can read invoice items"
on public.invoice_items
for select
to authenticated
using (true);

create policy "Admins and editors can insert invoice items"
on public.invoice_items
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update invoice items"
on public.invoice_items
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete invoice items"
on public.invoice_items
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');
