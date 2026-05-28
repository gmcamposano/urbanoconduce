drop policy if exists "Admins and editors can update invoices" on public.invoices;
drop policy if exists "Admins can update invoices" on public.invoices;

create policy "Admins can update invoices"
on public.invoices
for update
to authenticated
using ((select private.get_user_role()) = 'admin')
with check ((select private.get_user_role()) = 'admin');
