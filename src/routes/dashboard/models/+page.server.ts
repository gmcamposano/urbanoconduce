import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function canManageCatalog(role: string | null) {
	return role === 'admin' || role === 'editor';
}

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	if (!canManageCatalog(profile.role)) {
		throw redirect(303, '/dashboard');
	}

	const sort = url.searchParams.get('sort') ?? 'model';
	const order = url.searchParams.get('order') ?? 'asc';
	const search = url.searchParams.get('search') ?? '';

	const sortColumn = sort === 'model' ? 'model' : 'created_at';
	const ascending = order === 'asc';

	try {
		let query = locals.supabase
			.from('product_models')
			.select('*')
			.order(sortColumn, { ascending });

		if (search) {
			query = query.ilike('model', `%${search}%`);
		}

		const { data: models, error } = await query;

		if (error) {
			console.error('Supabase query error in models load:', error.message);
			return { models: [], sort, order, search };
		}

		return {
			models: models || [],
			sort,
			order,
			search
		};
	} catch (e) {
		console.error('Unexpected exception in models load:', e);
		return { models: [], sort, order, search };
	}
};

export const actions: Actions = {
	createModel: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para crear modelos.' });
		}

		const formData = await request.formData();
		const model = (formData.get('model') as string)?.trim().toLowerCase() ?? '';

		if (!model) {
			return fail(400, { error: 'El modelo es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('product_models').insert({
				model,
				created_by: user.id,
				created_at: new Date().toISOString()
			});

			if (error) {
				if (error.code === '23505') {
					return fail(400, { error: 'No se pudo guardar el modelo. Ya existe un modelo con ese nombre.' });
				}
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Modelo guardado.' };
	},
	updateModel: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para editar modelos.' });
		}

		const formData = await request.formData();
		const modelId = (formData.get('id') as string)?.trim() ?? '';
		const model = (formData.get('model') as string)?.trim().toLowerCase() ?? '';

		if (!modelId) {
			return fail(400, { error: 'El ID del modelo es obligatorio.' });
		}

		if (!model) {
			return fail(400, { error: 'El modelo es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase
				.from('product_models')
				.update({ model })
				.eq('id', modelId);

			if (error) {
				if (error.code === '23505') {
					return fail(400, { error: 'No se pudo guardar el modelo. Ya existe un modelo con ese nombre.' });
				}
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Modelo actualizado.' };
	},
	deleteModel: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para borrar modelos.' });
		}

		const formData = await request.formData();
		const modelId = (formData.get('id') as string)?.trim() ?? '';

		if (!modelId) {
			return fail(400, { error: 'El ID del modelo es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('product_models').delete().eq('id', modelId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Modelo borrado.' };
	}
};