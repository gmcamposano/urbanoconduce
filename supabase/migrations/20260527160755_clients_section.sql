-- ==========================================
-- Clients section and company fields
-- ==========================================

create table if not exists public.clients (
	id uuid primary key default gen_random_uuid(),
	client_type text not null check (client_type in ('person', 'company')),
	full_name text not null,
	email text,
	phone text,
	alias text,
	rnc text,
	company_name text,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now()),
	constraint clients_company_fields_required check (
		client_type = 'person'
		or (
			btrim(coalesce(alias, '')) <> ''
			and btrim(coalesce(rnc, '')) <> ''
			and btrim(coalesce(company_name, '')) <> ''
		)
	)
);

alter table public.clients enable row level security;

create index if not exists clients_created_by_idx on public.clients using btree (created_by);
create index if not exists clients_created_at_idx on public.clients using btree (created_at desc);
create index if not exists clients_client_type_idx on public.clients using btree (client_type);

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
before update on public.clients
for each row
execute function private.touch_updated_at();

grant select, insert, update, delete on public.clients to authenticated;

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
with check ((select private.get_user_role()) in ('admin', 'editor'));

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
