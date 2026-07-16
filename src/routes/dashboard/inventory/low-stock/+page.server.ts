import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getInventoryStock } from '$lib/server/inventory';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	const [{ data: items, error }, { data: models }] = await Promise.all([
		getInventoryStock(locals.supabase, { lowStockOnly: true }),
		locals.supabase.from('product_models').select('*').order('model', { ascending: true })
	]);

	if (error) {
		console.error('Low stock load error:', error.message);
	}

	return {
		items: items || [],
		models: models || []
	};
};
