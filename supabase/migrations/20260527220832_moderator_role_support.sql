alter table public.profiles
	drop constraint if exists profiles_role_check;

alter table public.profiles
	add constraint profiles_role_check check (role in ('admin', 'editor', 'moderator', 'viewer'));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (id, email, name, role)
	values (
		new.id,
		new.email,
		coalesce(new.raw_user_meta_data->>'name', 'New User'),
		case new.raw_user_meta_data->>'role'
			when 'admin' then 'admin'
			when 'editor' then 'editor'
			when 'moderator' then 'moderator'
			else 'viewer'
		end
	)
	on conflict (id) do update set
		email = excluded.email,
		name = excluded.name,
		role = excluded.role,
		updated_at = timezone('utc'::text, now());

	return new;
end;
$$;

drop policy if exists "Admins and editors can insert products" on public.products;
drop policy if exists "Admins and editors can update products" on public.products;
drop policy if exists "Admins and editors can delete products" on public.products;

create policy "Admins, editors, and moderators can insert products"
on public.products
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

create policy "Admins, editors, and moderators can update products"
on public.products
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor', 'moderator'))
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

create policy "Admins, editors, and moderators can delete products"
on public.products
for delete
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

drop policy if exists "Admins and editors can insert product colors" on public.product_colors;
drop policy if exists "Admins and editors can update product colors" on public.product_colors;
drop policy if exists "Admins and editors can delete product colors" on public.product_colors;

create policy "Admins, editors, and moderators can insert product colors"
on public.product_colors
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

create policy "Admins, editors, and moderators can update product colors"
on public.product_colors
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor', 'moderator'))
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

create policy "Admins, editors, and moderators can delete product colors"
on public.product_colors
for delete
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

drop policy if exists "Admins and editors can insert clients" on public.clients;
drop policy if exists "Admins and editors can update clients" on public.clients;
drop policy if exists "Admins and editors can delete clients" on public.clients;

create policy "Admins, editors, and moderators can insert clients"
on public.clients
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

create policy "Admins, editors, and moderators can update clients"
on public.clients
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor', 'moderator'))
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));

create policy "Admins, editors, and moderators can delete clients"
on public.clients
for delete
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));
