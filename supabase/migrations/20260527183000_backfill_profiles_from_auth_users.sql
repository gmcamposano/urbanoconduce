insert into public.profiles (id, email, name, role)
select
	u.id,
	u.email,
	coalesce(u.raw_user_meta_data->>'name', 'Nuevo usuario') as name,
	case u.raw_user_meta_data->>'role'
		when 'admin' then 'admin'
		when 'editor' then 'editor'
		else 'viewer'
	end as role
from auth.users u
on conflict (id) do update set
	email = excluded.email,
	name = excluded.name,
	role = excluded.role,
	updated_at = timezone('utc'::text, now());
