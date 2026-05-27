drop policy if exists "Authenticated users can insert clients" on public.clients;
drop policy if exists "Admins, editors, and moderators can insert clients" on public.clients;

create policy "Admins, editors, and moderators can insert clients"
on public.clients
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor', 'moderator'));
