alter table public.invoices
add column if not exists source_proforma_id uuid references public.invoices(id) on delete set null;

create unique index if not exists invoices_source_proforma_id_unique_idx
on public.invoices (source_proforma_id);
