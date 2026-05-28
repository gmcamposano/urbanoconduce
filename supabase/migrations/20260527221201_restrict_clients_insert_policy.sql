drop policy if exists "Authenticated users can insert clients" on public.clients;
do $$
declare
	policy_name text;
begin
	for policy_name in
		select policyname
		from pg_policies
		where schemaname = 'public' and tablename = 'clients'
	loop
		execute format('drop policy %I on public.clients', policy_name);
	end loop;
end;
$$;

create policy "Admins and editors can insert clients"
on public.clients
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));
