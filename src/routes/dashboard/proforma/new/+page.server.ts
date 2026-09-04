import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveVariantIdForItem, resolveUnitPrices } from '$lib/server/inventory';
import { generateUniqueInvoiceNumber, isInvoiceNumberTaken } from '$lib/server/invoiceNumber';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard/proforma');
	}

	const invoiceNumberPreview = await generateUniqueInvoiceNumber(locals.supabase, 'INV');

	const { data: products, error: productsError } = await locals.supabase
		.from('products')
		.select('id, title, price_without_taxes, model')
		.order('title', { ascending: true });

	const { data: colors, error: colorsError } = await locals.supabase
		.from('product_colors')
		.select('id, color, sort_order')
		.order('sort_order', { ascending: true });

	const { data: models, error: modelsError } = await locals.supabase
		.from('product_models')
		.select('id, model')
		.order('model', { ascending: true });

	const { data: clients, error: clientsError } = await locals.supabase
		.from('clients')
		.select('id, client_type, full_name, company_name, alias, email')
		.order('company_name', { ascending: true })
		.order('full_name', { ascending: true });

	const { data: clientPrices, error: clientPricesError } = await locals.supabase
		.from('client_product_prices')
		.select('product_id, client_id, unit_price');

	if (productsError) {
		console.error('Supabase query error in invoice load products:', productsError.message);
	}

	if (colorsError) {
		console.error('Supabase query error in invoice load colors:', colorsError.message);
	}

	if (modelsError) {
		console.error('Supabase query error in invoice load models:', modelsError.message);
	}

	if (clientsError) {
		console.error('Supabase query error in invoice load clients:', clientsError.message);
	}

	if (clientPricesError) {
		console.error('Supabase query error in client_prices load:', clientPricesError.message);
	}

	return {
		invoiceNumberPreview,
		products: products || [],
		colors: colors || [],
		models: models || [],
		clients: clients || [],
		clientPrices: clientPrices || [],
		isAdmin: profile?.role === 'admin'
	};
};

export const actions: Actions = {
	createInvoice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const invoiceNumberInput = String(formData.get('invoice_number') ?? '').trim();
		const invoiceNumber =
			invoiceNumberInput || (await generateUniqueInvoiceNumber(locals.supabase, 'INV'));
		if (invoiceNumberInput && (await isInvoiceNumberTaken(locals.supabase, invoiceNumberInput))) {
			return fail(400, { error: `El número de proforma "${invoiceNumberInput}" ya está en uso.` });
		}
		const facturaTipo = 'proforma';
		const clientId = String(formData.get('client_id') ?? '').trim();
		const clientName = String(formData.get('client_name') ?? '').trim();
		const clientEmail = String(formData.get('client_email') ?? '').trim();
		const invoiceDate = String(formData.get('invoice_date') ?? '').trim();
		const dueDate = String(formData.get('due_date') ?? '').trim();
		const status = String(formData.get('status') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();
		const rawTaxMode = String(formData.get('tax_mode') ?? 'none').trim();
		const taxMode = rawTaxMode === 'included' || rawTaxMode === 'added' ? rawTaxMode : 'none';
		const taxRate = taxMode === 'none' ? 0 : 18;
		const discountAmount = Number(formData.get('discount_amount') || 0);
		const itemsJson = formData.get('items') as string;

		if (!clientId || !clientName || !invoiceDate || !dueDate || !status) {
			return fail(400, { error: 'Todos los datos principales son obligatorios.' });
		}

		let items: Array<{
			product_id: string;
			color: string;
			model: string;
			quantity: number;
			unit_price: number;
		}>;
		try {
			items = JSON.parse(itemsJson || '[]');
		} catch {
			return fail(400, { error: 'No se pudieron procesar los conceptos.' });
		}

		if (items.length === 0) {
			return fail(400, { error: 'Debes agregar al menos un concepto.' });
		}

		const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
		if (productIds.length === 0) {
			return fail(400, { error: 'Debes seleccionar al menos un producto válido.' });
		}

		const selectedColors = [
			...new Set(items.map((item) => (item.color || '').trim().toLowerCase()).filter(Boolean))
		];

		const { data: products, error: productsError } = await locals.supabase
			.from('products')
			.select('id, title, price_without_taxes')
			.in('id', productIds);

		if (productsError) {
			return fail(400, { error: productsError.message });
		}

		const { prices: resolvedPrices } = await resolveUnitPrices(
			locals.supabase,
			clientId,
			products || []
		);

		if (selectedColors.length > 0) {
			const { data: colors, error: colorsError } = await locals.supabase
				.from('product_colors')
				.select('color')
				.in('color', selectedColors);

			if (colorsError) {
				return fail(400, { error: colorsError.message });
			}

			const availableColors = new Set((colors || []).map((color) => color.color));
			if (selectedColors.some((color) => !availableColors.has(color))) {
				return fail(400, { error: 'Los conceptos deben tener un color válido.' });
			}
		}

		const shouldCreateMissing =
			String(formData.get('create_missing_variants') ?? '').trim() === 'true';

		const productMap = new Map((products || []).map((product) => [product.id, product]));

		// Detect items that still lack an inventory variant.
		const missingVariantsByKey = new Map<
			string,
			{ productId: string; productTitle: string; color: string }
		>();
		for (const item of items) {
			const product = productMap.get(item.product_id);
			const color = (item.color || '').trim().toLowerCase();
			if (!product) continue;
			const { id: variantId } = await resolveVariantIdForItem(
				locals.supabase,
				item.product_id,
				color
			);
			if (!variantId) {
				const key = `${item.product_id}:${color}`;
				missingVariantsByKey.set(key, {
					productId: item.product_id,
					productTitle: product.title,
					color
				});
			}
		}

		if (missingVariantsByKey.size > 0 && !shouldCreateMissing) {
			return fail(400, {
				missingVariants: Array.from(missingVariantsByKey.values())
			});
		}

		if (shouldCreateMissing && missingVariantsByKey.size > 0) {
			const variantsToCreate = Array.from(missingVariantsByKey.values()).map((v) => ({
				product_id: v.productId,
				color: v.color,
				min_stock: 0,
				created_by: user.id
			}));

			const { error: createVariantsError } = await locals.supabase
				.from('product_variants')
				.insert(variantsToCreate);

			if (createVariantsError) {
				return fail(400, {
					error: `No se pudieron crear las variantes: ${createVariantsError.message}`
				});
			}
		}

		const normalizedItems: Array<{
			product_id: string;
			product_variant_id: string | null;
			description: string;
			color: string | null;
			model: string | null;
			quantity: number;
			unit_price: number;
			amount: number;
		}> = [];

		for (const item of items) {
			const quantity = Number(item.quantity);
			const product = productMap.get(item.product_id);
			const color = (item.color || '').trim().toLowerCase();

			if (!product || quantity <= 0) {
				return fail(400, {
					error: 'Los conceptos deben tener un producto válido y cantidad mayor que cero.'
				});
			}

			const submittedPrice = Number(item.unit_price);
			const unitPrice =
				Number.isFinite(submittedPrice) && submittedPrice > 0
					? submittedPrice
					: (resolvedPrices.get(item.product_id) ?? Number(product.price_without_taxes));

			if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
				return fail(400, { error: 'Los conceptos deben tener un precio unitario válido.' });
			}

			const model = (item.model || '').trim() || null;
			const { id: variantId } = await resolveVariantIdForItem(
				locals.supabase,
				item.product_id,
				color
			);
			if (!variantId) {
				return fail(400, {
					error: `No existe una variante de inventario para "${product.title}" con color "${color || 'sin color'}". Crea la variante primero.`
				});
			}

			normalizedItems.push({
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

		if (status === 'paid') {
			const { data: stockData, error: stockError } = await locals.supabase
				.from('inventory_movements')
				.select('product_variant_id, quantity')
				.in(
					'product_variant_id',
					normalizedItems.map((i) => i.product_variant_id)
				);
			if (stockError) {
				return fail(400, { error: stockError.message });
			}
			const stockByVariant: Record<string, number> = {};
			for (const m of stockData || []) {
				stockByVariant[m.product_variant_id] =
					(stockByVariant[m.product_variant_id] || 0) + m.quantity;
			}
			const demandByVariant: Record<string, number> = {};
			for (const i of normalizedItems) {
				const vid = i.product_variant_id || '';
				demandByVariant[vid] = (demandByVariant[vid] || 0) + i.quantity;
			}
			const insufficient = Object.entries(demandByVariant).filter(
				([vid, demand]) => (stockByVariant[vid] || 0) < demand
			);
			if (insufficient.length > 0) {
				return fail(400, {
					error: `Stock insuficiente para ${insufficient.length} variante(s).`
				});
			}
		}

		const lineTotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
		const subtotal = taxMode === 'included' ? lineTotal / 1.18 : lineTotal;
		const taxAmount =
			taxMode === 'none'
				? 0
				: taxMode === 'included'
					? lineTotal - subtotal
					: subtotal * (taxRate / 100);
		const totalAmount = Math.max(
			0,
			taxMode === 'none' ? subtotal - discountAmount : subtotal + taxAmount - discountAmount
		);

		const targetStatus = status;

		try {
			const { data: invoice, error: invoiceError } = await locals.supabase
				.from('invoices')
				.insert({
					invoice_number: invoiceNumber,
					factura_tipo: facturaTipo,
					document_type: 'proforma',
					ncf: null,
					client_id: clientId,
					client_name: clientName,
					client_email: clientEmail,
					invoice_date: invoiceDate,
					due_date: dueDate,
					status: 'pending',
					notes,
					tax_rate: taxRate,
					discount_amount: discountAmount,
					total_amount: totalAmount,
					created_by: user.id
				})
				.select('id')
				.single();

			if (invoiceError || !invoice) {
				return fail(400, { error: invoiceError?.message || 'No se pudo guardar la factura.' });
			}

			const invoiceItemsData = normalizedItems.map((item) => ({
				invoice_id: invoice.id,
				product_id: item.product_id,
				product_variant_id: item.product_variant_id,
				description: item.description,
				color: item.color,
				model: item.model,
				quantity: item.quantity,
				unit_price: item.unit_price,
				amount: item.amount
			}));

			const { error: itemsError } = await locals.supabase
				.from('invoice_items')
				.insert(invoiceItemsData);

			if (itemsError) {
				await locals.supabase.from('invoices').delete().eq('id', invoice.id);
				return fail(400, { error: `Failed to save invoice items: ${itemsError.message}` });
			}

			if (targetStatus !== 'pending') {
				const { error: statusError } = await locals.supabase
					.from('invoices')
					.update({ status: targetStatus })
					.eq('id', invoice.id);

				if (statusError) {
					await locals.supabase.from('invoices').delete().eq('id', invoice.id);
					return fail(400, { error: statusError.message });
				}
			}
		} catch (e: unknown) {
			console.error('Invoice save exception:', e);
			const message = e instanceof Error ? e.message : String(e);
			return fail(500, { error: message || 'Ocurrió un error inesperado.' });
		}

		throw redirect(303, '/dashboard/proforma');
	}
};
