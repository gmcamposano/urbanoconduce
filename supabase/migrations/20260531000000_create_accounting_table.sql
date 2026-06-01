create table if not exists public.accounting (
	id uuid primary key default gen_random_uuid(),
	invoice_id uuid references public.invoices(id) on delete set null,
	client_id uuid not null references public.clients(id) on delete restrict,
	amount numeric not null check (amount > 0),
	payment_date date not null default current_date,
	payment_method text not null check (payment_method in ('cash', 'transfer', 'check', 'card', 'other')),
	reference_number text,
	notes text,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.accounting enable row level security;

create index if not exists accounting_client_id_idx on public.accounting using btree (client_id);
create index if not exists accounting_invoice_id_idx on public.accounting using btree (invoice_id);
create index if not exists accounting_payment_date_idx on public.accounting using btree (payment_date desc);
create index if not exists accounting_created_at_idx on public.accounting using btree (created_at desc);

drop policy if exists "Authenticated users can read accounting" on public.accounting;
drop policy if exists "Admins and editors can insert accounting" on public.accounting;
drop policy if exists "Admins and editors can update accounting" on public.accounting;
drop policy if exists "Admins can delete accounting" on public.accounting;

create policy "Authenticated users can read accounting"
on public.accounting
for select
to authenticated
using (true);

create policy "Admins and editors can insert accounting"
on public.accounting
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update accounting"
on public.accounting
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete accounting"
on public.accounting
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');