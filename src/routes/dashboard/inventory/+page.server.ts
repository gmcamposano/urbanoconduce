import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getInventoryStock } from '$lib/server/inventory';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	const [{ data: items, error }, { data: models }] = await Promise.all([
		getInventoryStock(locals.supabase),
		locals.supabase.from('product_models').select('*').order('model', { ascending: true })
	]);

	if (error) {
		console.error('Inventory load error:', error.message);
	}

	const lowStockCount = items?.filter((i) => i.low_stock).length || 0;

	return {
		items: items || [],
		models: models || [],
		lowStockCount
	};
};
