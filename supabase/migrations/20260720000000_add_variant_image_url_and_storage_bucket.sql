-- Add per-variant product image support

alter table public.product_variants
add column if not exists image_url text;

-- Public storage bucket for variant images
insert into storage.buckets (id, name, public)
values ('product-variants', 'product-variants', true)
on conflict (id) do update set public = true;

-- Storage policies for the product-variants bucket

drop policy if exists "Authenticated users can read product-variants files" on storage.objects;
create policy "Authenticated users can read product-variants files"
on storage.objects
for select
to authenticated
using (bucket_id = 'product-variants');

drop policy if exists "Admins and editors can upload product-variants files" on storage.objects;
create policy "Admins and editors can upload product-variants files"
on storage.objects
for insert
to authenticated
with check (
	bucket_id = 'product-variants'
	and (select private.get_user_role()) in ('admin', 'editor')
);

drop policy if exists "Admins and editors can update product-variants files" on storage.objects;
create policy "Admins and editors can update product-variants files"
on storage.objects
for update
to authenticated
using (
	bucket_id = 'product-variants'
	and (select private.get_user_role()) in ('admin', 'editor')
)
with check (
	bucket_id = 'product-variants'
	and (select private.get_user_role()) in ('admin', 'editor')
);

drop policy if exists "Admins and editors can delete product-variants files" on storage.objects;
create policy "Admins and editors can delete product-variants files"
on storage.objects
for delete
to authenticated
using (
	bucket_id = 'product-variants'
	and (select private.get_user_role()) in ('admin', 'editor')
);
