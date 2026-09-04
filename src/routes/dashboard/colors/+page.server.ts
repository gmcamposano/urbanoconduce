import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function canManageCatalog(role: string | null) {
	return role === 'admin' || role === 'editor';
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	if (!canManageCatalog(profile.role)) {
		throw redirect(303, '/dashboard');
	}

	try {
		const { data: colors, error } = await locals.supabase
			.from('product_colors')
			.select('*')
			.order('sort_order', { ascending: true });

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

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para crear colores.' });
		}

		const formData = await request.formData();
		const color = (formData.get('color') as string)?.trim().toLowerCase() ?? '';

		if (!color) {
			return fail(400, { error: 'El color es obligatorio.' });
		}

		try {
			const { data: existing } = await locals.supabase
				.from('product_colors')
				.select('id')
				.ilike('color', color)
				.single();

			if (existing) {
				return fail(400, { error: 'Este color ya existe.' });
			}

			const { error } = await locals.supabase.from('product_colors').insert({
				color,
				created_by: user.id
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : '';
			return fail(400, { error: message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Color guardado.' };
	},
	updateColor: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para editar colores.' });
		}

		const formData = await request.formData();
		const colorId = (formData.get('id') as string)?.trim() ?? '';
		const color = (formData.get('color') as string)?.trim().toLowerCase() ?? '';

		if (!colorId) {
			return fail(400, { error: 'El ID del color es obligatorio.' });
		}

		if (!color) {
			return fail(400, { error: 'El color es obligatorio.' });
		}

		try {
			const { data: existing } = await locals.supabase
				.from('product_colors')
				.select('id')
				.ilike('color', color)
				.neq('id', colorId)
				.single();

			if (existing) {
				return fail(400, { error: 'Este color ya existe.' });
			}

			const { error } = await locals.supabase
				.from('product_colors')
				.update({ color })
				.eq('id', colorId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : '';
			return fail(400, { error: message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Color actualizado.' };
	},
	deleteColor: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para borrar colores.' });
		}

		const formData = await request.formData();
		const colorId = (formData.get('id') as string)?.trim() ?? '';

		if (!colorId) {
			return fail(400, { error: 'El ID del color es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('product_colors').delete().eq('id', colorId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : '';
			return fail(400, { error: message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Color borrado.' };
	},
	reorderColors: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para ordenar colores.' });
		}

		const formData = await request.formData();
		const rawColorIds = String(formData.get('color_ids') ?? '');
		let colorIds: string[];

		try {
			const parsed: unknown = JSON.parse(rawColorIds);
			if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
				return fail(400, { error: 'El orden de colores no es válido.' });
			}
			colorIds = parsed;
		} catch {
			return fail(400, { error: 'El orden de colores no se pudo procesar.' });
		}

		if (new Set(colorIds).size !== colorIds.length) {
			return fail(400, { error: 'El orden contiene colores duplicados.' });
		}

		const { error } = await locals.supabase.rpc('reorder_product_colors', {
			p_color_ids: colorIds
		});

		if (error) {
			console.error('Supabase error reordering colors:', error.message);
			return fail(400, {
				error: 'No se pudo guardar el orden. Recarga la página e inténtalo de nuevo.'
			});
		}

		return { success: true, message: 'Orden de colores guardado.' };
	}
};
