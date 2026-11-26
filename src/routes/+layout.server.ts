import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetUser();

	let profile = null;
	if (user) {
		const seedProfile = {
			id: user.id,
			email: user.email || '',
			name: user.user_metadata?.name || 'Nuevo usuario',
			role: (user.user_metadata?.role as 'admin' | 'editor' | 'viewer') || 'viewer'
		};

		try {
			// Already fetched by safeGetUser in hooks.server.ts.
			const data = locals.profile;

			if (data) {
				profile = data;
			} else {
				const { data: upsertedProfile, error: upsertError } = await locals.supabase
					.from('profiles')
					.upsert(seedProfile, { onConflict: 'id' })
					.select('id, email, name, role')
					.maybeSingle();

				profile = upsertedProfile || (upsertError ? seedProfile : null);
			}
		} catch (e) {
			console.error('Error fetching user profile in layout.server:', e);
			profile = seedProfile;
		}
	}

	return {
		user,
		profile
	};
};
