import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';

type TypedSupabase = SupabaseClient<Database>;

export type InventoryItem = {
	variant_id: string;
	product_id: string;
	product_title: string;
	product_description: string | null;
	model_id: string | null;
	model_name: string | null;
	color: string;
	sku: string | null;
	min_stock: number;
	purchase_price: number | null;
	stock: number;
	low_stock: boolean;
	image_url: string | null;
};

export async function getInventoryStock(
	supabase: TypedSupabase,
	options?: { lowStockOnly?: boolean }
) {
	const { data: variants, error } = await supabase
		.from('product_variants')
		.select(
			`
			id,
			color,
			sku,
			min_stock,
			purchase_price,
			image_url,
			created_at,
			products (
				id,
				title,
				description,
				model
			)
		`
		)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false });

	if (error || !variants) {
		return { data: [] as InventoryItem[], error };
	}

	const variantIds = variants.map((v) => v.id);
	const { data: movements, error: movError } = await supabase
		.from('inventory_movements')
		.select('product_variant_id, quantity')
		.in('product_variant_id', variantIds);

	if (movError) {
		return { data: [] as InventoryItem[], error: movError };
	}

	const stockByVariant: Record<string, number> = {};
	for (const m of movements || []) {
		stockByVariant[m.product_variant_id] = (stockByVariant[m.product_variant_id] || 0) + m.quantity;
	}

	const result = variants
		.map((v) => {
			const product = v.products as unknown as {
				id: string;
				title: string;
				description: string | null;
				model: string | null;
			};
			const stock = stockByVariant[v.id] || 0;
			return {
				variant_id: v.id,
				product_id: product?.id,
				product_title: product?.title || '',
				product_description: product?.description || null,
				model_id: product?.model,
				model_name: product?.model,
				color: v.color,
				sku: v.sku,
				min_stock: v.min_stock,
				purchase_price: v.purchase_price,
				stock,
				low_stock: stock <= v.min_stock,
				image_url: v.image_url
			};
		})
		.filter((item) => (options?.lowStockOnly ? item.low_stock : true));

	return { data: result, error: null };
}

export async function getVariantStock(supabase: TypedSupabase, variantId: string) {
	const { data, error } = await supabase
		.from('inventory_movements')
		.select('quantity')
		.eq('product_variant_id', variantId);
	if (error) return { stock: 0, error };
	const stock = (data || []).reduce((sum, m) => sum + m.quantity, 0);
	return { stock, error: null };
}

export async function getDefaultWarehouseId(supabase: TypedSupabase) {
	const { data, error } = await supabase
		.from('warehouses')
		.select('id')
		.eq('is_default', true)
		.single();
	if (error || !data) return { id: null, error };
	return { id: data.id, error: null };
}

export async function resolveVariantIdForItem(
	supabase: TypedSupabase,
	productId: string,
	color: string
) {
	const normalizedColor = (color || '').trim().toLowerCase();
	const { data, error } = await supabase
		.from('product_variants')
		.select('id')
		.eq('product_id', productId)
		.eq('color', normalizedColor)
		.single();
	if (error || !data) return { id: null, error };
	return { id: data.id, error: null };
}

export async function getClientProductPrices(
	supabase: TypedSupabase,
	clientId: string,
	productIds: string[]
) {
	if (productIds.length === 0) return { prices: new Map<string, number>(), error: null as null };
	const { data, error } = await supabase
		.from('client_product_prices')
		.select('product_id, unit_price')
		.eq('client_id', clientId)
		.in('product_id', productIds);
	if (error) return { prices: new Map<string, number>(), error };
	const prices = new Map<string, number>();
	for (const row of data || []) {
		prices.set(row.product_id, Number(row.unit_price));
	}
	return { prices, error: null };
}

/**
 * Resolve the effective unit price for every product for a given client.
 * Uses the client-specific price (precio por cliente) when it exists,
 * otherwise falls back to the catalog price (products.price_without_taxes).
 */
export async function resolveUnitPrices(
	supabase: TypedSupabase,
	clientId: string,
	products: { id: string; price_without_taxes: number | string }[]
) {
	const ids = products.map((p) => p.id);
	const { prices, error } = await getClientProductPrices(supabase, clientId, ids);
	const resolved = new Map<string, number>();
	for (const p of products) {
		resolved.set(p.id, prices.get(p.id) ?? Number(p.price_without_taxes));
	}
	return { prices: resolved, error };
}

export async function recordInventoryMovement(
	supabase: TypedSupabase,
	params: {
		product_variant_id: string;
		warehouse_id?: string;
		type: Database['public']['Tables']['inventory_movements']['Insert']['type'];
		quantity: number;
		reference_type?: string | null;
		reference_id?: string | null;
		notes?: string | null;
		created_by?: string | null;
	}
) {
	let warehouseId = params.warehouse_id;
	if (!warehouseId) {
		const { id } = await getDefaultWarehouseId(supabase);
		warehouseId = id || undefined;
	}
	if (!warehouseId) {
		return { error: new Error('No se encontró una bodega por defecto.') };
	}

	const { error } = await supabase.from('inventory_movements').insert({
		product_variant_id: params.product_variant_id,
		warehouse_id: warehouseId,
		type: params.type,
		quantity: params.quantity,
		reference_type: params.reference_type || null,
		reference_id: params.reference_id || null,
		notes: params.notes || null,
		created_by: params.created_by || null
	});
	return { error };
}

export async function validateStockForInvoice(supabase: TypedSupabase, invoiceId: string) {
	const { data: items, error } = await supabase
		.from('invoice_items')
		.select('id, product_variant_id, quantity')
		.eq('invoice_id', invoiceId)
		.not('product_variant_id', 'is', null);

	if (error)
		return {
			ok: false,
			insufficient: [] as { title: string; color: string; stock: number; requested: number }[],
			error
		};

	const insufficient: { title: string; color: string; stock: number; requested: number }[] = [];
	for (const item of items || []) {
		const { stock } = await getVariantStock(supabase, item.product_variant_id!);
		if (stock < Number(item.quantity)) {
			const { data: pv } = await supabase
				.from('product_variants')
				.select('color, products(title)')
				.eq('id', item.product_variant_id!)
				.single();
			insufficient.push({
				title: (pv?.products as unknown as { title: string })?.title || 'Producto',
				color: pv?.color || '',
				stock,
				requested: Number(item.quantity)
			});
		}
	}
	if (insufficient.length > 0) {
		return { ok: false, insufficient, error: null };
	}
	return { ok: true, insufficient: [] as typeof insufficient, error: null };
}

export async function deductStockForInvoice(
	supabase: TypedSupabase,
	invoiceId: string,
	createdBy: string
) {
	const { data: invoice, error: invoiceError } = await supabase
		.from('invoices')
		.select('id, document_type, status')
		.eq('id', invoiceId)
		.single();
	if (invoiceError || !invoice)
		return { error: invoiceError || new Error('Documento no encontrado.') };

	const { data: items, error: itemsError } = await supabase
		.from('invoice_items')
		.select('id, product_variant_id, quantity')
		.eq('invoice_id', invoiceId)
		.not('product_variant_id', 'is', null);
	if (itemsError) return { error: itemsError };

	const movementType = invoice.document_type === 'interna' ? 'internal_transfer' : 'sale';

	for (const item of items || []) {
		const { error } = await recordInventoryMovement(supabase, {
			product_variant_id: item.product_variant_id!,
			type: movementType,
			quantity: -Number(item.quantity),
			reference_type: 'invoice',
			reference_id: invoiceId,
			created_by: createdBy
		});
		if (error) return { error };
	}
	return { error: null };
}

export function formatInventoryColor(color: string): string {
	if (!color) return 'Sin color';
	return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
}

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);
}

export async function getOrCreateModelId(
	supabase: TypedSupabase,
	modelName: string,
	userId: string
) {
	const normalized = modelName.trim().toLowerCase();
	if (!normalized) {
		return { id: null, error: new Error('El modelo es obligatorio.') };
	}

	const { data: existing } = await supabase
		.from('product_models')
		.select('id')
		.eq('model', normalized)
		.single();

	if (existing) return { id: existing.id, error: null as null };

	const { data: inserted, error } = await supabase
		.from('product_models')
		.insert({ model: normalized, created_by: userId })
		.select('id')
		.single();

	if (error) {
		if (error.code === '23505') {
			const { data: retry } = await supabase
				.from('product_models')
				.select('id')
				.eq('model', normalized)
				.single();
			if (retry) return { id: retry.id, error: null };
		}
		return { id: null, error };
	}

	return { id: inserted.id, error: null };
}

export async function resolveOrCreateProduct(
	supabase: TypedSupabase,
	params: {
		title: string;
		modelId: string;
		catalogPrice: number | null;
		userId: string;
	}
) {
	const normalizedTitle = params.title.trim().toLowerCase();
	if (!normalizedTitle) {
		return { id: null, error: new Error('El producto es obligatorio.') };
	}

	const { data: existing } = await supabase
		.from('products')
		.select('id')
		.eq('title', normalizedTitle)
		.eq('model', params.modelId)
		.single();

	if (existing) return { id: existing.id, error: null as null };

	const catalogPrice = params.catalogPrice ?? 0;

	const { data: inserted, error } = await supabase
		.from('products')
		.insert({
			title: normalizedTitle,
			model: params.modelId,
			price_without_taxes: catalogPrice,
			created_by: params.userId
		})
		.select('id')
		.single();

	if (error) {
		if (error.code === '23505') {
			const { data: retry } = await supabase
				.from('products')
				.select('id')
				.eq('title', normalizedTitle)
				.eq('model', params.modelId)
				.single();
			if (retry) return { id: retry.id, error: null };
		}
		return { id: null, error };
	}

	return { id: inserted.id, error: null };
}

export async function resolveOrCreateVariant(
	supabase: TypedSupabase,
	params: {
		productId: string;
		color: string;
		sku: string;
		purchasePrice: number | null;
		userId: string;
	}
) {
	const normalizedColor = (params.color || '').trim().toLowerCase();
	const sku = params.sku.trim() || null;

	const { data: existing } = await supabase
		.from('product_variants')
		.select('id, purchase_price')
		.eq('product_id', params.productId)
		.eq('color', normalizedColor)
		.single();

	if (existing) {
		if (params.purchasePrice !== null && params.purchasePrice >= 0) {
			const { error } = await supabase
				.from('product_variants')
				.update({ purchase_price: params.purchasePrice })
				.eq('id', existing.id);
			if (error) return { id: null, error };
		}
		return { id: existing.id, error: null as null };
	}

	const { data: inserted, error } = await supabase
		.from('product_variants')
		.insert({
			product_id: params.productId,
			color: normalizedColor,
			sku,
			min_stock: 0,
			purchase_price:
				params.purchasePrice !== null && params.purchasePrice >= 0 ? params.purchasePrice : null,
			created_by: params.userId
		})
		.select('id')
		.single();

	if (error) {
		if (error.code === '23505') {
			const { data: retry } = await supabase
				.from('product_variants')
				.select('id, purchase_price')
				.eq('product_id', params.productId)
				.eq('color', normalizedColor)
				.single();
			if (retry) {
				if (params.purchasePrice !== null && params.purchasePrice >= 0) {
					await supabase
						.from('product_variants')
						.update({ purchase_price: params.purchasePrice })
						.eq('id', retry.id);
				}
				return { id: retry.id, error: null };
			}
		}
		return { id: null, error };
	}

	return { id: inserted.id, error: null };
}
