import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	const { data: movements, error } = await locals.supabase
		.from('inventory_movements')
		.select(
			`
			id,
			type,
			quantity,
			notes,
			created_at,
			created_by,
			reference_id,
			product_variants (
				id,
				color,
				products (id, title, model, clients(client_type, full_name, company_name, alias))
			)
		`
		)
		.order('created_at', { ascending: false })
		.limit(200);

	if (error) {
		console.error('Inventory movements load error:', error.message);
	}

	const { data: models } = await locals.supabase
		.from('product_models')
		.select('*')
		.order('model', { ascending: true });

	return {
		movements: movements || [],
		models: models || []
	};
};
