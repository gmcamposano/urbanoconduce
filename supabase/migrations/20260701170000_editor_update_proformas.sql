-- Allow editors to update proforma invoices (and the related invoice_items delete)
-- so the /dashboard/proforma/[id]/edit updateInvoice action can run for editor users.
-- Matches the existing pattern from 20260626000000_editor_delete_proformas.sql.

drop policy if exists "Admins can update invoices" on public.invoices;

create policy "Admins and editors can update proformas"
on public.invoices
for update
to authenticated
using (
	(select private.get_user_role()) = 'admin'
	or (
		(select private.get_user_role()) = 'editor'
		and factura_tipo = 'proforma'
	)
)
with check (
	(select private.get_user_role()) = 'admin'
	or (
		(select private.get_user_role()) = 'editor'
		and factura_tipo = 'proforma'
	)
);

drop policy if exists "Admins can delete invoice items" on public.invoice_items;

create policy "Admins and editors can delete invoice items of proformas"
on public.invoice_items
for delete
to authenticated
using (
	(select private.get_user_role()) = 'admin'
	or (
		(select private.get_user_role()) = 'editor'
		and exists (
			select 1
			from public.invoices
			where invoices.id = invoice_items.invoice_id
				and invoices.factura_tipo = 'proforma'
		)
	)
);
