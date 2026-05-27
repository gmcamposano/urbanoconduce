import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	if (profile.role !== 'admin' && profile.role !== 'editor') {
		throw redirect(303, '/dashboard');
	}

	try {
		const { data: colors, error } = await locals.supabase
			.from('product_colors')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Supabase query error in colors load:', error.message);
			return { colors: [] };
		}

		return {
			colors: colors || []
		};
	} catch (e) {
		console.error('Unexpected exception in colors load:', e);
		return { colors: [] };
	}
};

export const actions: Actions = {
	createColor: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const { data: profile, error: profileError } = await locals.supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'editor')) {
			return fail(403, { error: 'No tienes permisos para crear colores.' });
		}

		const formData = await request.formData();
		const color = (formData.get('color') as string)?.trim().toLowerCase() ?? '';

		if (!color) {
			return fail(400, { error: 'El color es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('product_colors').insert({
				color,
				created_by: user.id
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true };
	}
};
