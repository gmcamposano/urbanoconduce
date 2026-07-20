import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getInventoryStock,
	getDefaultWarehouseId,
	recordInventoryMovement,
	getOrCreateModelId,
	resolveOrCreateProduct,
	resolveOrCreateVariant
} from '$lib/server/inventory';
import type { BulkParsedRow } from '$lib/inventory/bulk';

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
		console.error('Stock entry load error:', error.message);
	}

	return {
		items: items || [],
		models: models || [],
		warehouses: warehouses || []
	};
};

export const actions: Actions = {
	recordStockEntry: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManage(locals.role)) {
			return fail(403, { error: 'No tienes permisos para registrar entradas de mercancía.' });
		}

		const formData = await request.formData();
		const notes = String(formData.get('notes') ?? '').trim() || null;
		const warehouseId = String(formData.get('warehouse_id') ?? '').trim();

		const entries: { variantId: string; quantity: number; purchasePrice: number | null }[] = [];
		const priceUpdates: { variantId: string; price: number }[] = [];

		for (const [key, value] of formData.entries()) {
			if (key.startsWith('quantity_')) {
				const variantId = key.slice('quantity_'.length);
				const qty = Number(value);
				if (!Number.isNaN(qty) && qty > 0) {
					const priceRaw = String(formData.get(`price_${variantId}`) ?? '').trim();
					let price: number | null = null;
					if (priceRaw) {
						const parsed = Number(priceRaw);
						if (!Number.isNaN(parsed) && parsed >= 0) {
							price = parsed;
						}
					}
					entries.push({ variantId, quantity: qty, purchasePrice: price });
					if (price !== null) {
						priceUpdates.push({ variantId, price });
					}
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
				type: 'purchase',
				quantity: entry.quantity,
				notes,
				created_by: user.id
			});

			if (error) {
				return fail(400, { error: error.message });
			}

			if (entry.purchasePrice !== null) {
				const { error: priceError } = await locals.supabase
					.from('product_variants')
					.update({ purchase_price: entry.purchasePrice })
					.eq('id', entry.variantId);

				if (priceError) {
					console.error(
						'Failed to update purchase_price for variant',
						entry.variantId,
						priceError.message
					);
				}
			}
		}

		const priceNote =
			priceUpdates.length > 0 ? ` ${priceUpdates.length} costo(s) actualizado(s).` : '';

		return {
			success: true,
			message: `${entries.length} entrada(s) de mercancía registrada(s).${priceNote}`
		};
	},
	recordStockEntryBulk: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManage(locals.role)) {
			return fail(403, { error: 'No tienes permisos para registrar entradas de mercancía.' });
		}

		const formData = await request.formData();
		const notes = String(formData.get('notes') ?? '').trim() || null;
		const warehouseId = String(formData.get('warehouse_id') ?? '').trim();
		const entriesRaw = String(formData.get('entries') ?? '').trim();

		if (!entriesRaw) {
			return fail(400, { error: 'No se recibieron filas del archivo.' });
		}

		let rows: BulkParsedRow[];
		try {
			rows = JSON.parse(entriesRaw);
			if (!Array.isArray(rows)) {
				return fail(400, { error: 'El formato de las filas no es válido.' });
			}
		} catch {
			return fail(400, { error: 'El archivo no se pudo interpretar.' });
		}

		const validRows = rows.filter((r) => r.quantity !== null && r.quantity > 0);
		if (validRows.length === 0) {
			return fail(400, { error: 'Ingresa al menos una cantidad mayor a cero.' });
		}

		const seen = new Set<string>();
		for (const row of validRows) {
			const key = `${row.product.trim().toLowerCase()}|${row.model.trim().toLowerCase()}|${row.color.trim().toLowerCase()}`;
			if (seen.has(key)) {
				return fail(400, {
					error: `La fila del producto "${row.product} / ${row.model} / ${row.color}" está duplicada en el archivo.`
				});
			}
			seen.add(key);
		}

		let targetWarehouseId = warehouseId || null;
		if (!targetWarehouseId) {
			const { id } = await getDefaultWarehouseId(locals.supabase);
			targetWarehouseId = id;
		}

		if (!targetWarehouseId) {
			return fail(500, { error: 'No se encontró una bodega por defecto.' });
		}

		let processed = 0;
		let priceUpdates = 0;
		let newProducts = 0;
		let newVariants = 0;

		for (const row of validRows) {
			const { id: modelId, error: modelError } = await getOrCreateModelId(
				locals.supabase,
				row.model,
				user.id
			);
			if (modelError || !modelId) {
				return fail(400, { error: modelError?.message || 'No se pudo resolver el modelo.' });
			}

			const { data: existingProduct } = await locals.supabase
				.from('products')
				.select('id')
				.eq('title', row.product.trim().toLowerCase())
				.eq('model', modelId)
				.single();
			const isNewProduct = !existingProduct;

			const { id: productId, error: productError } = await resolveOrCreateProduct(locals.supabase, {
				title: row.product,
				modelId,
				catalogPrice: 0,
				userId: user.id
			});
			if (productError || !productId) {
				return fail(400, {
					error: productError?.message || 'No se pudo resolver el producto.'
				});
			}
			if (isNewProduct) newProducts++;

			const { data: existingVariant } = await locals.supabase
				.from('product_variants')
				.select('id')
				.eq('product_id', productId)
				.eq('color', (row.color || '').trim().toLowerCase() || 'sin color')
				.single();
			const isNewVariant = !existingVariant;

			const { id: variantId, error: variantError } = await resolveOrCreateVariant(locals.supabase, {
				productId,
				color: row.color,
				sku: '',
				purchasePrice: row.newCost,
				userId: user.id
			});
			if (variantError || !variantId) {
				return fail(400, {
					error: variantError?.message || 'No se pudo resolver la variante.'
				});
			}
			if (isNewVariant) newVariants++;

			const { error: movementError } = await recordInventoryMovement(locals.supabase, {
				product_variant_id: variantId,
				warehouse_id: targetWarehouseId,
				type: 'purchase',
				quantity: row.quantity!,
				notes,
				created_by: user.id
			});
			if (movementError) {
				return fail(400, { error: movementError.message });
			}

			if (row.newCost !== null && row.newCost >= 0) {
				priceUpdates++;
			}
			processed++;
		}

		const priceNote = priceUpdates > 0 ? ` ${priceUpdates} costo(s) actualizado(s).` : '';
		return {
			success: true,
			message: `${processed} entrada(s) registrada(s).${priceNote} ${newProducts} producto(s) nuevo(s), ${newVariants} variante(s) nueva(s).`
		};
	}
};
