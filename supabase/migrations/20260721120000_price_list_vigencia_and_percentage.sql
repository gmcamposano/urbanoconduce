-- Fase 2: vigencia on client↔price-list assignment + live % discount mode.
--
-- 1. New table client_price_list_assignments replaces clients.default_price_list_id.
--    Supports valid_from/valid_to so assignments can be scheduled and expire.
--    Resolution: most recent assignment where valid_from <= today and
--    (valid_to is null or valid_to >= today).
--
-- 2. price_list_entries gains discount_percentage nullable. Each entry is
--    either an absolute price (unit_price) OR a live % off catalog
--    (discount_percentage). Check: at least one of the two is not null.
--    Catalog price changes auto-propagate to % entries at invoice time.
--
-- 3. Migrate existing clients.default_price_list_id into a vigente assignment,
--    then drop the column.

-- 1. Assignments table.
create table public.client_price_list_assignments (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references public.clients(id) on delete cascade,
	price_list_id uuid not null references public.price_lists(id) on delete cascade,
	valid_from date not null default CURRENT_DATE,
	valid_to date,
	created_by uuid references public.profiles(id),
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now()),
	check (valid_to is null or valid_to >= valid_from)
);

create index client_price_list_assignments_client_id_idx
	on public.client_price_list_assignments (client_id);

create index client_price_list_assignments_client_valid_from_idx
	on public.client_price_list_assignments (client_id, valid_from desc);

alter table public.client_price_list_assignments enable row level security;

create policy "Authenticated users can read client price list assignments"
	on public.client_price_list_assignments for select
	to authenticated
	using (true);

create policy "Admins and editors can insert client price list assignments"
	on public.client_price_list_assignments for insert
	to authenticated
	with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update client price list assignments"
	on public.client_price_list_assignments for update
	to authenticated
	using ((select private.get_user_role()) in ('admin', 'editor'))
	with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete client price list assignments"
	on public.client_price_list_assignments for delete
	to authenticated
	using ((select private.get_user_role()) = 'admin');

-- 2. Migrate existing default_price_list_id into a vigente assignment.
insert into public.client_price_list_assignments (client_id, price_list_id, valid_from, valid_to, created_by)
select id, default_price_list_id, CURRENT_DATE, null, created_by
from public.clients
where default_price_list_id is not null;

-- 3. Drop the column now that data is migrated.
alter table public.clients drop column default_price_list_id;

-- 4. Live % discount mode on price_list_entries.
alter table public.price_list_entries
	add column discount_percentage numeric check (discount_percentage >= 0 and discount_percentage <= 100);

-- At least one of unit_price or discount_percentage must be set.
alter table public.price_list_entries
	add constraint price_list_entries_price_mode_check
	check (unit_price is not null or discount_percentage is not null);
