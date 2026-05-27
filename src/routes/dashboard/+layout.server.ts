import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { user, profile } = await parent();

	// Guard: If there is no authenticated user, kick the user out to the login page
	if (!user) {
		throw redirect(303, '/login');
	}

	return {
		user,
		profile
	};
};
