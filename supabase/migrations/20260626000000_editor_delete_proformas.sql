drop policy if exists "Admins can delete invoices" on public.invoices;

create policy "Admins and editors can delete proformas"
on public.invoices
for delete
to authenticated
using (
	(select private.get_user_role()) = 'admin'
	OR ((select private.get_user_role()) = 'editor' AND factura_tipo = 'proforma')
);
