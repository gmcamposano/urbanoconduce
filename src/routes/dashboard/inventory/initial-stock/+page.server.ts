import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getInventoryStock, getDefaultWarehouseId } from '$lib/server/inventory';

function canManage(role: string | null) {
	return role === 'admin' || role === 'editor';
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	const [{ data: items, error }, { data: models }, { data: warehouses }] = await Promise.all([
		getInventoryStock(locals.supabase),
		locals.supabase.from('product_models').select('*').order('model', { ascending: true }),
		locals.supabase.from('warehouses').select('*').order('name', { ascending: true })
	]);

	if (error) {
		console.error('Initial stock load error:', error.message);
	}

	return {
		items: items || [],
		models: models || [],
		warehouses: warehouses || []
	};
};

export const actions: Actions = {
	recordInitialStock: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManage(locals.role)) {
			return fail(403, { error: 'No tienes permisos para registrar inventario.' });
		}

		const formData = await request.formData();
		const notes = String(formData.get('notes') ?? '').trim() || null;
		const warehouseId = String(formData.get('warehouse_id') ?? '').trim();

		const entries: { variantId: string; quantity: number }[] = [];
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('quantity_')) {
				const variantId = key.slice('quantity_'.length);
				const qty = Number(value);
				if (!Number.isNaN(qty) && qty > 0) {
					entries.push({ variantId, quantity: qty });
				}
			}
		}

		if (entries.length === 0) {
			return fail(400, { error: 'Ingresa al menos una cantidad mayor a cero.' });
		}

		let targetWarehouseId = warehouseId || null;
		if (!targetWarehouseId) {
			const { id } = await getDefaultWarehouseId(locals.supabase);
			targetWarehouseId = id;
		}

		if (!targetWarehouseId) {
			return fail(500, { error: 'No se encontró una bodega por defecto.' });
		}

		for (const entry of entries) {
			const { error } = await locals.supabase.from('inventory_movements').insert({
				product_variant_id: entry.variantId,
				warehouse_id: targetWarehouseId,
				type: 'initial',
				quantity: entry.quantity,
				notes,
				created_by: user.id
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		}

		return { success: true, message: `${entries.length} entrada(s) registrada(s).` };
	}
};
