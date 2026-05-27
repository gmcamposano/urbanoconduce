import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetUser();

	let profile = null;
	if (user) {
		try {
			const { data, error } = await locals.supabase
				.from('profiles')
				.select('id, email, name, role')
				.eq('id', user.id)
				.single();

			if (!error && data) {
				profile = data;
			} else {
				// Fallback if profiles trigger hasn't run or table is empty
				profile = {
					id: user.id,
					email: user.email || '',
					name: user.user_metadata?.name || 'Nuevo usuario',
					role: (user.user_metadata?.role as 'admin' | 'editor' | 'viewer') || 'viewer'
				};
			}
		} catch (e) {
			console.error('Error fetching user profile in layout.server:', e);
			profile = {
				id: user.id,
				email: user.email || '',
				name: user.user_metadata?.name || 'Nuevo usuario',
				role: (user.user_metadata?.role as 'admin' | 'editor' | 'viewer') || 'viewer'
			};
		}
	}

	return {
		user,
		profile
	};
};
