create table if not exists public.product_colors (
	id uuid primary key default gen_random_uuid(),
	color text not null unique,
	created_by uuid references public.profiles(id) on delete set null,
	created_at timestamptz not null default timezone('utc'::text, now()),
	updated_at timestamptz not null default timezone('utc'::text, now()),
	constraint product_colors_color_not_blank check (btrim(color) <> '')
);

alter table public.product_colors enable row level security;

create index if not exists product_colors_created_by_idx on public.product_colors using btree (created_by);
create index if not exists product_colors_created_at_idx on public.product_colors using btree (created_at desc);
create index if not exists product_colors_color_idx on public.product_colors using btree (color);

drop trigger if exists product_colors_touch_updated_at on public.product_colors;
create trigger product_colors_touch_updated_at
before update on public.product_colors
for each row
execute function private.touch_updated_at();

grant select, insert, update, delete on public.product_colors to authenticated;

drop policy if exists "Authenticated users can read product colors" on public.product_colors;
drop policy if exists "Admins and editors can insert product colors" on public.product_colors;
drop policy if exists "Admins and editors can update product colors" on public.product_colors;
drop policy if exists "Admins can delete product colors" on public.product_colors;

create policy "Authenticated users can read product colors"
on public.product_colors
for select
to authenticated
using (true);

create policy "Admins and editors can insert product colors"
on public.product_colors
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update product colors"
on public.product_colors
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete product colors"
on public.product_colors
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');
