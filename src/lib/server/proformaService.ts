import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import { changesAllocatedProforma } from '$lib/proformaPaymentGuard';
import { computeProformaTotals, type TaxMode } from '$lib/proformaTotals';
import {
	getProductVariantKey,
	resolveUnitPrices,
	resolveVariantIdsForItems
} from '$lib/server/inventory';
import { generateUniqueInvoiceNumber, isInvoiceNumberTaken } from '$lib/server/invoiceNumber';

type TypedSupabase = SupabaseClient<Database>;

export const PROFORMA_STATUSES = ['draft', 'pending', 'paid', 'overdue'] as const;
export type ProformaStatus = (typeof PROFORMA_STATUSES)[number];

export function isProformaStatus(value: string): value is ProformaStatus {
	return (PROFORMA_STATUSES as readonly string[]).includes(value);
}

export type ProformaItemInput = {
	product_id: string;
	color: string;
	/** Product model id. Defaults to the product's own model when omitted. */
	model?: string | null;
	quantity: number | string;
	/** Blank or 0 uses the client price, then the catalog price. */
	unit_price?: number | string | null;
};

export type NormalizedProformaItem = {
	product_id: string;
	product_variant_id: string;
	description: string;
	color: string | null;
	model: string | null;
	quantity: number;
	unit_price: number;
	amount: number;
};

export type MissingVariant = { productId: string; productTitle: string; color: string };

export type ServiceFailure = {
	ok: false;
	status: number;
	error: string;
	missingVariants?: MissingVariant[];
	/** The document exists but is not a proforma (already an invoice). */
	notProforma?: true;
};

export type ProformaHeaderInput = {
	invoiceNumber?: string;
	clientId: string;
	clientName: string;
	clientEmail?: string;
	invoiceDate: string;
	dueDate: string;
	status: string;
	notes?: string;
	taxMode: TaxMode;
	discountAmount: number;
};

export type ProformaInput = ProformaHeaderInput & {
	items: ProformaItemInput[];
	createMissingVariants?: boolean;
};

function failure(error: string, status = 400, extra: Partial<ServiceFailure> = {}): ServiceFailure {
	return { ok: false, status, error, ...extra };
}

/**
 * Validates proforma lines and turns them into invoice_items rows:
 * checks products and colors, resolves client prices and inventory variants,
 * and creates missing variants only when asked to.
 */
export async function normalizeProformaItems(
	supabase: TypedSupabase,
	params: {
		clientId: string;
		items: ProformaItemInput[];
		createMissingVariants?: boolean;
		userId: string;
	}
): Promise<{ ok: true; items: NormalizedProformaItem[] } | ServiceFailure> {
	const { items } = params;
	if (items.length === 0) return failure('Debes agregar al menos un concepto.');

	const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
	if (productIds.length === 0) return failure('Debes seleccionar al menos un producto válido.');

	const selectedColors = [
		...new Set(items.map((item) => (item.color || '').trim().toLowerCase()).filter(Boolean))
	];

	const [productsResult, colorsResult] = await Promise.all([
		supabase.from('products').select('id, title, price_without_taxes, model').in('id', productIds),
		selectedColors.length > 0
			? supabase.from('product_colors').select('color').in('color', selectedColors)
			: Promise.resolve({ data: [] as { color: string }[], error: null })
	]);

	if (productsResult.error) return failure(productsResult.error.message);
	if (colorsResult.error) return failure(colorsResult.error.message);

	const products = productsResult.data || [];
	if (selectedColors.length > 0) {
		const availableColors = new Set((colorsResult.data || []).map((entry) => entry.color));
		if (selectedColors.some((color) => !availableColors.has(color))) {
			return failure('Los conceptos deben tener un color válido.');
		}
	}

	const { prices: resolvedPrices } = await resolveUnitPrices(supabase, params.clientId, products);
	const productMap = new Map(products.map((product) => [product.id, product]));
	const { variants: variantIds, error: variantsError } = await resolveVariantIdsForItems(
		supabase,
		items
	);
	if (variantsError) return failure(variantsError.message);

	const missingVariantsByKey = new Map<string, MissingVariant>();
	for (const item of items) {
		const product = productMap.get(item.product_id);
		const color = (item.color || '').trim().toLowerCase();
		if (!product) continue;
		if (!variantIds.get(getProductVariantKey(item.product_id, color))) {
			missingVariantsByKey.set(`${item.product_id}:${color}`, {
				productId: item.product_id,
				productTitle: product.title,
				color
			});
		}
	}

	if (missingVariantsByKey.size > 0 && !params.createMissingVariants) {
		return failure('Faltan variantes de inventario.', 400, {
			missingVariants: Array.from(missingVariantsByKey.values())
		});
	}

	if (params.createMissingVariants && missingVariantsByKey.size > 0) {
		const { data: createdVariants, error: createVariantsError } = await supabase
			.from('product_variants')
			.insert(
				Array.from(missingVariantsByKey.values()).map((variant) => ({
					product_id: variant.productId,
					color: variant.color,
					min_stock: 0,
					created_by: params.userId
				}))
			)
			.select('id, product_id, color');

		if (createVariantsError) {
			return failure(`No se pudieron crear las variantes: ${createVariantsError.message}`);
		}
		for (const variant of createdVariants || []) {
			variantIds.set(getProductVariantKey(variant.product_id, variant.color), variant.id);
		}
	}

	const normalized: NormalizedProformaItem[] = [];
	for (const item of items) {
		const quantity = Number(item.quantity);
		const product = productMap.get(item.product_id);
		const color = (item.color || '').trim().toLowerCase();

		if (!product || !(quantity > 0)) {
			return failure('Los conceptos deben tener un producto válido y cantidad mayor que cero.');
		}

		const submittedPrice = Number(item.unit_price);
		const unitPrice =
			Number.isFinite(submittedPrice) && submittedPrice > 0
				? submittedPrice
				: (resolvedPrices.get(item.product_id) ?? Number(product.price_without_taxes));

		if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
			return failure('Los conceptos deben tener un precio unitario válido.');
		}

		const model = item.model === undefined ? product.model : (item.model || '').trim() || null;
		const variantId = variantIds.get(getProductVariantKey(item.product_id, color));
		if (!variantId) {
			return failure(
				`No existe una variante de inventario para "${product.title}" con color "${color || 'sin color'}". Crea la variante primero.`
			);
		}

		normalized.push({
			product_id: item.product_id,
			product_variant_id: variantId,
			description: product.title,
			color: color || null,
			model,
			quantity,
			unit_price: unitPrice,
			amount: quantity * unitPrice
		});
	}

	return { ok: true, items: normalized };
}

export function totalsForItems(
	items: NormalizedProformaItem[],
	taxMode: TaxMode,
	discountAmount: number
) {
	const lineTotal = items.reduce((sum, item) => sum + item.amount, 0);
	return { lineTotal, ...computeProformaTotals(lineTotal, taxMode, discountAmount) };
}

async function checkStockForItems(supabase: TypedSupabase, items: NormalizedProformaItem[]) {
	const { data, error } = await supabase
		.from('inventory_movements')
		.select('product_variant_id, quantity')
		.in(
			'product_variant_id',
			items.map((i) => i.product_variant_id)
		);
	if (error) return failure(error.message);
	const stock: Record<string, number> = {};
	for (const m of data || []) {
		stock[m.product_variant_id] = (stock[m.product_variant_id] || 0) + m.quantity;
	}
	const demand: Record<string, number> = {};
	for (const i of items)
		demand[i.product_variant_id] = (demand[i.product_variant_id] || 0) + i.quantity;
	const insufficient = Object.entries(demand).filter(([vid, qty]) => (stock[vid] || 0) < qty);
	if (insufficient.length > 0) {
		return failure(`Stock insuficiente para ${insufficient.length} variante(s).`);
	}
	return null;
}

function validateHeader(input: ProformaHeaderInput) {
	if (
		!input.clientId ||
		!input.clientName ||
		!input.invoiceDate ||
		!input.dueDate ||
		!input.status ||
		!isProformaStatus(input.status)
	) {
		return failure('Todos los datos principales son obligatorios.');
	}
	if (!Number.isFinite(input.discountAmount) || input.discountAmount < 0) {
		return failure('El descuento no es válido.');
	}
	return null;
}

export async function createProforma(
	supabase: TypedSupabase,
	userId: string,
	input: ProformaInput
): Promise<{ ok: true; id: string; invoiceNumber: string; totalAmount: number } | ServiceFailure> {
	const headerError = validateHeader(input);
	if (headerError) return headerError;

	const requestedNumber = (input.invoiceNumber ?? '').trim();
	if (requestedNumber && (await isInvoiceNumberTaken(supabase, requestedNumber))) {
		return failure(`El número de proforma "${requestedNumber}" ya está en uso.`);
	}
	const invoiceNumber = requestedNumber || (await generateUniqueInvoiceNumber(supabase, 'INV'));

	const normalized = await normalizeProformaItems(supabase, {
		clientId: input.clientId,
		items: input.items,
		createMissingVariants: input.createMissingVariants,
		userId
	});
	if (!normalized.ok) return normalized;

	if (input.status === 'paid') {
		const stockError = await checkStockForItems(supabase, normalized.items);
		if (stockError) return stockError;
	}

	const totals = totalsForItems(normalized.items, input.taxMode, input.discountAmount);

	const { data: invoice, error: invoiceError } = await supabase
		.from('invoices')
		.insert({
			invoice_number: invoiceNumber,
			factura_tipo: 'proforma',
			document_type: 'proforma',
			ncf: null,
			client_id: input.clientId,
			client_name: input.clientName,
			client_email: input.clientEmail ?? '',
			invoice_date: input.invoiceDate,
			due_date: input.dueDate,
			status: 'pending',
			notes: input.notes ?? '',
			tax_rate: totals.taxRate,
			discount_amount: input.discountAmount,
			total_amount: totals.totalAmount,
			created_by: userId
		})
		.select('id')
		.single();

	if (invoiceError || !invoice) {
		return failure(invoiceError?.message || 'No se pudo guardar la proforma.');
	}

	const { error: itemsError } = await supabase
		.from('invoice_items')
		.insert(normalized.items.map((item) => ({ invoice_id: invoice.id, ...item })));

	if (itemsError) {
		await supabase.from('invoices').delete().eq('id', invoice.id);
		return failure(`No se pudieron guardar los conceptos: ${itemsError.message}`);
	}

	if (input.status !== 'pending') {
		const { error: statusError } = await supabase
			.from('invoices')
			.update({ status: input.status })
			.eq('id', invoice.id);
		if (statusError) {
			await supabase.from('invoices').delete().eq('id', invoice.id);
			return failure(statusError.message);
		}
	}

	return { ok: true, id: invoice.id, invoiceNumber, totalAmount: totals.totalAmount };
}

export async function updateProforma(
	supabase: TypedSupabase,
	userId: string,
	proformaId: string,
	input: ProformaInput & { invoiceNumber: string }
): Promise<{ ok: true; id: string; totalAmount: number } | ServiceFailure> {
	if (!input.invoiceNumber?.trim())
		return failure('Los datos principales de la factura son obligatorios.');
	const headerError = validateHeader(input);
	if (headerError) return headerError;

	const [invoiceResult, existingItemsResult, allocationsResult] = await Promise.all([
		supabase.from('invoices').select('*').eq('id', proformaId).single(),
		supabase.from('invoice_items').select('*').eq('invoice_id', proformaId),
		supabase.from('accounting_allocations').select('id').eq('invoice_id', proformaId).limit(1)
	]);

	if (invoiceResult.error || !invoiceResult.data) {
		return failure('No se encontró la factura que intentas editar.', 404);
	}
	const current = invoiceResult.data;
	if (current.factura_tipo !== 'proforma') {
		return failure('Este documento ya es una factura, no una proforma.', 400, {
			notProforma: true
		});
	}
	if (input.status === 'paid' && current.status !== 'paid') {
		return failure('Las proformas se saldan automáticamente cuando los abonos cubren el total.');
	}
	if (existingItemsResult.error) return failure(existingItemsResult.error.message);
	if (allocationsResult.error)
		return failure('No se pudieron verificar los abonos de la proforma.');

	const normalized = await normalizeProformaItems(supabase, {
		clientId: input.clientId,
		items: input.items,
		createMissingVariants: input.createMissingVariants,
		userId
	});
	if (!normalized.ok) return normalized;

	const { totalAmount, taxRate } = totalsForItems(
		normalized.items,
		input.taxMode,
		input.discountAmount
	);

	if (
		changesAllocatedProforma(
			{
				clientId: current.client_id || '',
				invoiceDate: current.invoice_date,
				dueDate: current.due_date,
				status: current.status,
				totalAmount: Number(current.total_amount)
			},
			{
				clientId: input.clientId,
				invoiceDate: input.invoiceDate,
				dueDate: input.dueDate,
				status: input.status,
				totalAmount
			},
			(allocationsResult.data || []).length > 0
		)
	) {
		return failure(
			'No se puede cambiar el cliente, las fechas, el estado o el total de una proforma con abonos registrados.'
		);
	}

	const previousInvoice = {
		invoice_number: current.invoice_number,
		client_name: current.client_name,
		client_email: current.client_email,
		invoice_date: current.invoice_date,
		due_date: current.due_date,
		status: current.status,
		notes: current.notes,
		tax_rate: current.tax_rate,
		discount_amount: current.discount_amount,
		total_amount: current.total_amount,
		factura_tipo: current.factura_tipo,
		ncf: current.ncf
	};
	const previousItems = existingItemsResult.data || [];

	const { error: updateError } = await supabase
		.from('invoices')
		.update({
			invoice_number: input.invoiceNumber.trim(),
			factura_tipo: 'proforma',
			document_type: 'proforma',
			ncf: null,
			client_id: input.clientId,
			client_name: input.clientName,
			client_email: input.clientEmail ?? '',
			invoice_date: input.invoiceDate,
			due_date: input.dueDate,
			status: input.status,
			notes: input.notes ?? '',
			tax_rate: taxRate,
			discount_amount: input.discountAmount,
			total_amount: totalAmount
		})
		.eq('id', proformaId);

	if (updateError) return failure(updateError.message);

	const { error: deleteItemsError } = await supabase
		.from('invoice_items')
		.delete()
		.eq('invoice_id', proformaId);

	if (deleteItemsError) {
		await supabase.from('invoices').update(previousInvoice).eq('id', proformaId);
		return failure(deleteItemsError.message);
	}

	const { error: insertItemsError } = await supabase
		.from('invoice_items')
		.insert(normalized.items.map((item) => ({ invoice_id: proformaId, ...item })));

	if (insertItemsError) {
		await supabase.from('invoice_items').insert(previousItems);
		await supabase.from('invoices').update(previousInvoice).eq('id', proformaId);
		return failure(insertItemsError.message);
	}

	return { ok: true, id: proformaId, totalAmount };
}
