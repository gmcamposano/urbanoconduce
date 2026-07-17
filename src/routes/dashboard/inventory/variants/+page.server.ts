import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function canManage(role: string | null) {
	return role === 'admin' || role === 'editor';
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	const [{ data: variants }, { data: products }, { data: colors }, { data: models }] =
		await Promise.all([
			locals.supabase
				.from('product_variants')
				.select('*')
				.order('created_at', { ascending: false }),
			locals.supabase
				.from('products')
				.select('id, title, model')
				.order('title', { ascending: true }),
			locals.supabase.from('product_colors').select('*').order('color', { ascending: true }),
			locals.supabase.from('product_models').select('*').order('model', { ascending: true })
		]);

	return {
		variants: variants || [],
		products: products || [],
		colors: colors || [],
		models: models || []
	};
};

export const actions: Actions = {
	createVariant: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canManage(locals.role)) return fail(403, { error: 'No tienes permisos.' });

		const formData = await request.formData();
		const productId = String(formData.get('product_id') ?? '').trim();
		const color = String(formData.get('color') ?? '')
			.trim()
			.toLowerCase();
		const sku = String(formData.get('sku') ?? '').trim() || null;
		const minStock = Number(formData.get('min_stock') ?? 0);
		const purchasePrice = Number(formData.get('purchase_price') ?? 0) || null;

		if (!productId) return fail(400, { error: 'El producto es obligatorio.' });

		const { error } = await locals.supabase.from('product_variants').insert({
			product_id: productId,
			color,
			sku,
			min_stock: minStock,
			purchase_price: purchasePrice,
			created_by: user.id
		});

		if (error) {
			if (error.code === '23505') {
				return fail(400, { error: 'Ya existe una variante con ese color para este producto.' });
			}
			return fail(400, { error: error.message });
		}

		return { success: true, message: 'Variante creada.' };
	},
	deleteVariant: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canManage(locals.role)) return fail(403, { error: 'No tienes permisos.' });

		const formData = await request.formData();
		const id = String(formData.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'ID requerido.' });

		const { error } = await locals.supabase.from('product_variants').delete().eq('id', id);
		if (error) return fail(400, { error: error.message });

		return { success: true, message: 'Variante eliminada.' };
	}
};
