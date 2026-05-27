-- ==========================================
-- Clients insert permission moved to server action
-- ==========================================

drop policy if exists "Admins and editors can insert clients" on public.clients;

create policy "Authenticated users can insert clients"
on public.clients
for insert
to authenticated
with check (true);
