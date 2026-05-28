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
		const [{ data: products, error: productsError }, { data: models, error: modelsError }, { data: clients, error: clientsError }] =
			await Promise.all([
				locals.supabase.from('products').select('*, clients(client_type, full_name, company_name, alias)').order('title', { ascending: true }),
				locals.supabase.from('product_models').select('*').order('model', { ascending: true }),
				locals.supabase.from('clients').select('id, client_type, full_name, company_name, alias').order('company_name', { ascending: true }).order('full_name', { ascending: true })
			]);

		if (productsError) {
			console.error('Supabase query error in products load:', productsError.message);
		}

		if (modelsError) {
			console.error('Supabase query error in models load:', modelsError.message);
		}

		if (clientsError) {
			console.error('Supabase query error in clients load:', clientsError.message);
		}

		return {
			products: products || [],
			models: models || [],
			clients: clients || []
		};
	} catch (e) {
		console.error('Unexpected exception in products load:', e);
		return { products: [], models: [], clients: [] };
	}
};

export const actions: Actions = {
	createProduct: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para crear productos.' });
		}

		const formData = await request.formData();
		const clientId = (formData.get('client_id') as string)?.trim() ?? '';
		const title = (formData.get('title') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() ?? '';
		const priceWithoutTaxes = Number(formData.get('price_without_taxes') || 0);
		const modelId = (formData.get('model') as string)?.trim() || null;

		if (!clientId) {
			return fail(400, { error: 'El cliente es obligatorio.' });
		}

		if (!title) {
			return fail(400, { error: 'El título del producto es obligatorio.' });
		}

		if (!modelId) {
			return fail(400, { error: 'El modelo es obligatorio.' });
		}

		if (Number.isNaN(priceWithoutTaxes) || priceWithoutTaxes < 0) {
			return fail(400, { error: 'El precio sin impuestos debe ser mayor o igual a cero.' });
		}

		try {
			const { error } = await locals.supabase.from('products').insert({
				client_id: clientId,
				title,
				description: description || null,
				price_without_taxes: priceWithoutTaxes,
				model: modelId,
				created_by: user.id
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Producto guardado.' };
	},
	updateProduct: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para editar productos.' });
		}

		const formData = await request.formData();
		const productId = (formData.get('id') as string)?.trim() ?? '';
		const clientId = (formData.get('client_id') as string)?.trim() ?? '';
		const title = (formData.get('title') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() ?? '';
		const priceWithoutTaxes = Number(formData.get('price_without_taxes') || 0);
		const modelId = (formData.get('model') as string)?.trim() || null;

		if (!productId) {
			return fail(400, { error: 'El ID del producto es obligatorio.' });
		}

		if (!clientId) {
			return fail(400, { error: 'El cliente es obligatorio.' });
		}

		if (!title) {
			return fail(400, { error: 'El título del producto es obligatorio.' });
		}

		if (!modelId) {
			return fail(400, { error: 'El modelo es obligatorio.' });
		}

		if (Number.isNaN(priceWithoutTaxes) || priceWithoutTaxes < 0) {
			return fail(400, { error: 'El precio sin impuestos debe ser mayor o igual a cero.' });
		}

		try {
			const { error } = await locals.supabase
				.from('products')
				.update({
					client_id: clientId,
					title,
					description: description || null,
					price_without_taxes: priceWithoutTaxes,
					model: modelId || null
				})
				.eq('id', productId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Producto actualizado.' };
	},
	deleteProduct: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para borrar productos.' });
		}

		const formData = await request.formData();
		const productId = (formData.get('id') as string)?.trim() ?? '';

		if (!productId) {
			return fail(400, { error: 'El ID del producto es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('products').delete().eq('id', productId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Producto borrado.' };
	}
};
