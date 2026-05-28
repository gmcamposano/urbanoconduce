-- ==========================================
-- Productos con cliente, facturas con cliente, items con product_id
-- ==========================================

-- 1. products.client_id obligatorio
alter table public.products add column client_id uuid not null references public.clients(id) on delete restrict;

-- 2. Cambiar title de unico global a unico por cliente
drop index if exists products_title_idx;

alter table public.products drop constraint if exists products_title_key;
alter table public.products drop constraint if exists products_title_not_blank;

alter table public.products add constraint products_title_not_blank check (btrim(title) <> '');
alter table public.products add constraint products_title_unique_per_client unique (client_id, title);

create index if not exists products_client_id_idx on public.products using btree (client_id);
create index if not exists products_title_idx on public.products using btree (title);

-- trigger updated_at
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function private.touch_updated_at();

-- 3. invoices.client_id
alter table public.invoices add column client_id uuid references public.clients(id) on delete set null;

create index if not exists invoices_client_id_idx on public.invoices using btree (client_id);

-- 4. invoice_items.product_id
alter table public.invoice_items add column product_id uuid references public.products(id) on delete set null;

create index if not exists invoice_items_product_id_idx on public.invoice_items using btree (product_id);

-- 5. RLS actualizado para products
drop policy if exists "Authenticated users can read products" on public.products;
drop policy if exists "Admins and editors can insert products" on public.products;
drop policy if exists "Admins and editors can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

create policy "Authenticated users can read products"
on public.products for select
to authenticated
using (true);

create policy "Admins and editors can insert products"
on public.products for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update products"
on public.products for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete products"
on public.products for delete
to authenticated
using ((select private.get_user_role()) = 'admin');

-- 6. RLS para invoices.client_id y invoice_items.product_id (ya existen politicas, solo ampliar)
drop policy if exists "Authenticated users can read invoices" on public.invoices;
drop policy if exists "Admins and editors can update invoices" on public.invoices;

create policy "Authenticated users can read invoices"
on public.invoices for select
to authenticated
using (true);

create policy "Admins and editors can update invoices"
on public.invoices for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

drop policy if exists "Authenticated users can read invoice items" on public.invoice_items;
drop policy if exists "Admins and editors can insert invoice items" on public.invoice_items;
drop policy if exists "Admins and editors can update invoice items" on public.invoice_items;
drop policy if exists "Admins can delete invoice items" on public.invoice_items;

create policy "Authenticated users can read invoice items"
on public.invoice_items for select
to authenticated
using (true);

create policy "Admins and editors can insert invoice items"
on public.invoice_items for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update invoice items"
on public.invoice_items for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete invoice items"
on public.invoice_items for delete
to authenticated
using ((select private.get_user_role()) = 'admin');

-- 7. Grants
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;