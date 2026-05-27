drop policy if exists "Admins can delete products" on public.products;
drop policy if exists "Admins can delete product colors" on public.product_colors;
drop policy if exists "Admins can delete clients" on public.clients;

create policy "Admins and editors can delete products"
on public.products
for delete
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can delete product colors"
on public.product_colors
for delete
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can delete clients"
on public.clients
for delete
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'));
