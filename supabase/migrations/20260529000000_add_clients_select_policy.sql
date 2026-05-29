drop policy if exists "Authenticated users can read clients" on public.clients;

create policy "Authenticated users can read clients"
on public.clients
for select
to authenticated
using (true);