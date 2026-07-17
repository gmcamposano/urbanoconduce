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
		const [
			{ data: products, error: productsError },
			{ data: models, error: modelsError },
			{ data: clients, error: clientsError },
			{ data: clientPrices, error: clientPricesError }
		] = await Promise.all([
			locals.supabase
				.from('products')
				.select('*, clients(client_type, full_name, company_name, alias)')
				.order('title', { ascending: true }),
			locals.supabase.from('product_models').select('*').order('model', { ascending: true }),
			locals.supabase
				.from('clients')
				.select('id, client_type, full_name, company_name, alias')
				.order('company_name', { ascending: true })
				.order('full_name', { ascending: true }),
			locals.supabase.from('client_product_prices').select('product_id, client_id, unit_price')
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

		if (clientPricesError) {
			console.error('Supabase query error in client_prices load:', clientPricesError.message);
		}

		return {
			products: products || [],
			models: models || [],
			clients: clients || [],
			clientPrices: clientPrices || []
		};
	} catch (e) {
		console.error('Unexpected exception in products load:', e);
		return { products: [], models: [], clients: [], clientPrices: [] };
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
		const title = (formData.get('title') as string)?.trim()?.toLowerCase() ?? '';
		const description = (formData.get('description') as string)?.trim()?.toLowerCase() ?? '';
		const priceWithoutTaxes = Number(formData.get('price_without_taxes') || 0);
		const modelId = (formData.get('model') as string)?.trim()?.toLowerCase() || null;

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
				client_id: clientId || null,
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
		const title = (formData.get('title') as string)?.trim()?.toLowerCase() ?? '';
		const description = (formData.get('description') as string)?.trim()?.toLowerCase() ?? '';
		const priceWithoutTaxes = Number(formData.get('price_without_taxes') || 0);
		const modelId = (formData.get('model') as string)?.trim()?.toLowerCase() || null;

		if (!productId) {
			return fail(400, { error: 'El ID del producto es obligatorio.' });
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
					client_id: clientId || null,
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
	},
	duplicateProductForModels: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para duplicar productos.' });
		}

		const formData = await request.formData();
		const productId = (formData.get('product_id') as string)?.trim() ?? '';
		const modelIdsRaw = (formData.get('model_ids') as string)?.trim() ?? '';

		if (!productId) {
			return fail(400, { error: 'El producto es obligatorio.' });
		}

		if (!modelIdsRaw) {
			return fail(400, { error: 'No se seleccionaron modelos.' });
		}

		let modelIds: string[];
		try {
			modelIds = JSON.parse(modelIdsRaw);
			if (!Array.isArray(modelIds) || modelIds.length === 0) {
				return fail(400, { error: 'No se seleccionaron modelos.' });
			}
		} catch {
			return fail(400, { error: 'Formato de modelos inválido.' });
		}

		try {
			const { data: sourceProduct, error: fetchError } = await locals.supabase
				.from('products')
				.select('*')
				.eq('id', productId)
				.single();

			if (fetchError) {
				return fail(400, { error: fetchError.message });
			}

			if (!sourceProduct) {
				return fail(400, { error: 'No se encontró el producto.' });
			}

			const productsToInsert = modelIds.map((modelId) => ({
				title: sourceProduct.title.toLowerCase(),
				description: sourceProduct.description?.toLowerCase() || null,
				price_without_taxes: sourceProduct.price_without_taxes,
				model: modelId.toLowerCase(),
				created_by: user.id
			}));

			const { error: insertError } = await locals.supabase
				.from('products')
				.insert(productsToInsert);

			if (insertError) {
				if (insertError.code === '23505') {
					return fail(400, {
						error:
							'Ya existe un producto con el mismo nombre y modelo. Elige un modelo diferente o cambia el nombre del producto.'
					});
				}
				return fail(400, { error: insertError.message });
			}

			return { success: true, message: `${productsToInsert.length} producto(s) creado(s).` };
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}
	},
	upsertClientPrice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para gestionar precios por cliente.' });
		}

		const formData = await request.formData();
		const productId = (formData.get('product_id') as string)?.trim() ?? '';
		const clientId = (formData.get('client_id') as string)?.trim() ?? '';
		const unitPrice = Number(formData.get('unit_price') ?? 0);

		if (!productId || !clientId) {
			return fail(400, { error: 'El producto y el cliente son obligatorios.' });
		}

		if (Number.isNaN(unitPrice) || unitPrice < 0) {
			return fail(400, { error: 'El precio por cliente debe ser mayor o igual a cero.' });
		}

		try {
			const { error } = await locals.supabase.from('client_product_prices').upsert(
				{
					product_id: productId,
					client_id: clientId,
					unit_price: unitPrice,
					created_by: user.id
				},
				{ onConflict: 'client_id,product_id' }
			);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Precio por cliente guardado.' };
	},
	deleteClientPrice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para gestionar precios por cliente.' });
		}

		const formData = await request.formData();
		const productId = (formData.get('product_id') as string)?.trim() ?? '';
		const clientId = (formData.get('client_id') as string)?.trim() ?? '';

		if (!productId || !clientId) {
			return fail(400, { error: 'El producto y el cliente son obligatorios.' });
		}

		try {
			const { error } = await locals.supabase
				.from('client_product_prices')
				.delete()
				.eq('product_id', productId)
				.eq('client_id', clientId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Precio por cliente eliminado.' };
	}
};
