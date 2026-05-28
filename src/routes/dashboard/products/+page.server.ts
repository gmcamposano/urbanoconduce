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
		const { data: products, error } = await locals.supabase
			.from('products')
			.select('*')
			.order('title', { ascending: true });

		if (error) {
			console.error('Supabase query error in products load:', error.message);
			return { products: [] };
		}

		return {
			products: products || []
		};
	} catch (e) {
		console.error('Unexpected exception in products load:', e);
		return { products: [] };
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
		const title = (formData.get('title') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() ?? '';
		const priceWithoutTaxes = Number(formData.get('price_without_taxes') || 0);

		if (!title) {
			return fail(400, { error: 'El título del producto es obligatorio.' });
		}

		if (Number.isNaN(priceWithoutTaxes) || priceWithoutTaxes < 0) {
			return fail(400, { error: 'El precio sin impuestos debe ser mayor o igual a cero.' });
		}

		try {
			const { error } = await locals.supabase.from('products').insert({
				title,
				description: description || null,
				price_without_taxes: priceWithoutTaxes,
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
		const title = (formData.get('title') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() ?? '';
		const priceWithoutTaxes = Number(formData.get('price_without_taxes') || 0);

		if (!productId) {
			return fail(400, { error: 'El ID del producto es obligatorio.' });
		}

		if (!title) {
			return fail(400, { error: 'El título del producto es obligatorio.' });
		}

		if (Number.isNaN(priceWithoutTaxes) || priceWithoutTaxes < 0) {
			return fail(400, { error: 'El precio sin impuestos debe ser mayor o igual a cero.' });
		}

		try {
			const { error } = await locals.supabase
				.from('products')
				.update({
					title,
					description: description || null,
					price_without_taxes: priceWithoutTaxes
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
