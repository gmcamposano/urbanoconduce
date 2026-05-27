import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	// Strict Guard: ONLY admins can access the admin layout
	if (profile?.role !== 'admin') {
		throw redirect(303, '/dashboard');
	}

	try {
		const { data: profiles, error } = await locals.supabase
			.from('profiles')
			.select('*')
			.order('name', { ascending: true });

		if (error) {
			console.error('Supabase query error in admin load:', error.message);
			return { profiles: [] };
		}

		return {
			profiles: profiles || []
		};
	} catch (e) {
		console.error('Unexpected exception in admin load:', e);
		return { profiles: [] };
	}
};

export const actions: Actions = {
	updateRole: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const targetProfileId = formData.get('id') as string;
		const targetRole = formData.get('role') as string;

		if (!targetProfileId || !targetRole) {
			return fail(400, { error: 'Target profile ID and new role are required.' });
		}

		// Prevent locking ourselves out: check if the admin is trying to demote themselves
		if (targetProfileId === user.id) {
			return fail(400, { error: 'Self-demotion is restricted to avoid locking out the system administrator.' });
		}

		if (!['admin', 'editor', 'viewer'].includes(targetRole)) {
			return fail(400, { error: 'Invalid role assigned.' });
		}

		try {
			// Enforced by RLS: Only profiles.role = 'admin' can execute updates on profiles where id != auth.uid()
			const { error } = await locals.supabase
				.from('profiles')
				.update({ role: targetRole })
				.eq('id', targetProfileId);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: any) {
			return fail(400, { error: e.message || 'An unexpected error occurred.' });
		}
	}
};
