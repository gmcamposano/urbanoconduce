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
				// Fallback if profiles trigger hasn't run or table is empty.
				// Persist the profile so admin and product policies see the same role.
				const seedProfile = {
					id: user.id,
					email: user.email || '',
					name: user.user_metadata?.name || 'Nuevo usuario',
					role: (user.user_metadata?.role as 'admin' | 'editor' | 'viewer') || 'viewer'
				};

				const { data: upsertedProfile } = await locals.supabase
					.from('profiles')
					.upsert(seedProfile, { onConflict: 'id' })
					.select('id, email, name, role')
					.single();

				profile = upsertedProfile || seedProfile;
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
