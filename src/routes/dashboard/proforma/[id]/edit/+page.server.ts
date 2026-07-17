import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveUnitPrices } from '$lib/server/inventory';

const VALID_STATUSES = ['draft', 'pending', 'paid', 'overdue'] as const;

function isValidStatus(status: string): status is (typeof VALID_STATUSES)[number] {
	return VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]);
}

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard/proforma');
	}

	const [invoiceResult, itemsResult, productsResult, colorsResult, modelsResult, clientsResult] =
		await Promise.all([
			locals.supabase
				.from('invoices')
				.select('*, profiles:created_by(name, email)')
				.eq('id', params.id)
				.single(),
			locals.supabase
				.from('invoice_items')
				.select('*')
				.eq('invoice_id', params.id)
				.order('created_at', { ascending: true }),
			locals.supabase
				.from('products')
				.select('id, title, price_without_taxes, model')
				.order('title', { ascending: true }),
			locals.supabase
				.from('product_colors')
				.select('id, color')
				.order('color', { ascending: true }),
			locals.supabase
				.from('product_models')
				.select('id, model')
				.order('model', { ascending: true }),
			locals.supabase
				.from('clients')
				.select('id, client_type, full_name, company_name, alias, email')
				.order('company_name', { ascending: true })
				.order('full_name', { ascending: true })
		]);

	if (invoiceResult.error || !invoiceResult.data) {
		console.error('Error fetching invoice for edit:', invoiceResult.error?.message);
		throw redirect(303, '/dashboard/proforma');
	}

	if (invoiceResult.data.factura_tipo !== 'proforma') {
		throw redirect(303, `/dashboard/invoices/${params.id}/edit`);
	}

	if (itemsResult.error) {
		console.error('Error fetching invoice items for edit:', itemsResult.error.message);
	}

	if (productsResult.error) {
		console.error('Error fetching products for edit:', productsResult.error.message);
	}

	if (colorsResult.error) {
		console.error('Error fetching colors for edit:', colorsResult.error.message);
	}

	if (modelsResult.error) {
		console.error('Error fetching models for edit:', modelsResult.error.message);
	}

	if (clientsResult.error) {
		console.error('Error fetching clients for edit:', clientsResult.error.message);
	}

	const products = productsResult.data || [];
	const colors = colorsResult.data || [];
	const models = modelsResult.data || [];
	const clients = clientsResult.data || [];

	return {
		invoice: invoiceResult.data,
		items:
			itemsResult.data?.map((item) => {
				let product = products.find((entry) => entry.id === item.product_id);
				if (!product && item.product_id) {
					product = products.find((entry) => entry.id === item.product_id);
				}
				if (!product && item.description) {
					product = products.find((entry) => entry.title === item.description);
				}

				return {
					id: item.id,
					description: item.description,
					product_id: item.product_id || product?.id || '',
					color: item.color || '',
					model: product?.model ?? null,
					quantity: Number(item.quantity),
					unit_price: Number(item.unit_price)
				};
			}) || [],
		products,
		colors,
		models,
		clients,
		isAdmin: profile?.role === 'admin'
	};
};

export const actions: Actions = {
	updateInvoice: async ({ request, params, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'No tienes permisos para editar proformas.' });
		}

		const formData = await request.formData();
		const invoiceNumber = String(formData.get('invoice_number') ?? '').trim();
		const clientId = String(formData.get('client_id') ?? '').trim();
		const clientName = String(formData.get('client_name') ?? '').trim();
		const clientEmail = String(formData.get('client_email') ?? '').trim();
		const invoiceDate = String(formData.get('invoice_date') ?? '').trim();
		const dueDate = String(formData.get('due_date') ?? '').trim();
		const status = String(formData.get('status') ?? '').trim();
		const facturaTipo = 'proforma';
		const ncf = null;
		const notes = String(formData.get('notes') ?? '').trim();
		const rawTaxMode = String(formData.get('tax_mode') ?? 'none').trim();
		const taxMode = rawTaxMode === 'included' || rawTaxMode === 'added' ? rawTaxMode : 'none';
		const taxRate = taxMode === 'none' ? 0 : 18;
		const discountAmount = Number(formData.get('discount_amount') || 0);
		const itemsJson = String(formData.get('items') ?? '[]');

		if (
			!invoiceNumber ||
			!clientId ||
			!clientName ||
			!invoiceDate ||
			!dueDate ||
			!status ||
			!isValidStatus(status)
		) {
			return fail(400, { error: 'Los datos principales de la factura son obligatorios.' });
		}

		let items: Array<{
			product_id: string;
			color: string;
			model: string | null;
			quantity: number;
		}>;
		try {
			items = JSON.parse(itemsJson);
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

		const [productsResult, colorsResult, invoiceResult, existingItemsResult] = await Promise.all([
			locals.supabase
				.from('products')
				.select('id, title, price_without_taxes')
				.in('id', productIds),
			locals.supabase
				.from('product_colors')
				.select('id, color')
				.in('color', selectedColors.length ? selectedColors : ['__no_color__']),
			locals.supabase.from('invoices').select('*').eq('id', params.id).single(),
			locals.supabase.from('invoice_items').select('*').eq('invoice_id', params.id)
		]);

		if (invoiceResult.error || !invoiceResult.data) {
			return fail(404, { error: 'No se encontró la factura que intentas editar.' });
		}

		if (invoiceResult.data.factura_tipo !== 'proforma') {
			throw redirect(303, `/dashboard/invoices/${params.id}/edit`);
		}

		if (status === 'paid' && invoiceResult.data.status !== 'paid') {
			return fail(400, {
				error: 'Las proformas se saldan automáticamente cuando los abonos cubren el total.'
			});
		}

		if (productsResult.error) {
			return fail(400, { error: productsResult.error.message });
		}

		if (colorsResult.error) {
			return fail(400, { error: colorsResult.error.message });
		}

		if (existingItemsResult.error) {
			return fail(400, { error: existingItemsResult.error.message });
		}

		const products = productsResult.data || [];
		const colors = colorsResult.data || [];

		if (selectedColors.length > 0) {
			const availableColors = new Set(colors.map((entry) => entry.color));
			if (selectedColors.some((color) => !availableColors.has(color))) {
				return fail(400, { error: 'Los conceptos deben tener un color válido.' });
			}
		}

		const { prices: resolvedPrices } = await resolveUnitPrices(locals.supabase, clientId, products);
		const productMap = new Map(products.map((product) => [product.id, product]));
		const normalizedItems: Array<{
			product_id: string;
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
			const model = (item.model || '').trim() || null;
			const unitPrice =
				resolvedPrices.get(item.product_id) ?? Number((item as { unit_price?: number }).unit_price);

			if (!product || quantity <= 0) {
				return fail(400, {
					error: 'Los conceptos deben tener un producto válido y cantidad mayor que cero.'
				});
			}

			if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
				return fail(400, { error: 'Los conceptos deben tener un precio unitario válido.' });
			}

			normalizedItems.push({
				product_id: item.product_id,
				description: product.title,
				color: color || null,
				model,
				quantity,
				unit_price: unitPrice,
				amount: quantity * unitPrice
			});
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

		const previousInvoice = {
			invoice_number: invoiceResult.data.invoice_number,
			client_name: invoiceResult.data.client_name,
			client_email: invoiceResult.data.client_email,
			invoice_date: invoiceResult.data.invoice_date,
			due_date: invoiceResult.data.due_date,
			status: invoiceResult.data.status,
			notes: invoiceResult.data.notes,
			tax_rate: invoiceResult.data.tax_rate,
			discount_amount: invoiceResult.data.discount_amount,
			total_amount: invoiceResult.data.total_amount,
			factura_tipo: invoiceResult.data.factura_tipo,
			ncf: invoiceResult.data.ncf
		};

		const previousItems = existingItemsResult.data || [];

		const { error: updateError } = await locals.supabase
			.from('invoices')
			.update({
				invoice_number: invoiceNumber,
				factura_tipo: facturaTipo,
				document_type: 'proforma',
				ncf,
				client_id: clientId,
				client_name: clientName,
				client_email: clientEmail,
				invoice_date: invoiceDate,
				due_date: dueDate,
				status,
				notes,
				tax_rate: taxRate,
				discount_amount: discountAmount,
				total_amount: totalAmount
			})
			.eq('id', params.id);

		if (updateError) {
			return fail(400, { error: updateError.message });
		}

		const { error: deleteItemsError } = await locals.supabase
			.from('invoice_items')
			.delete()
			.eq('invoice_id', params.id);

		if (deleteItemsError) {
			await locals.supabase.from('invoices').update(previousInvoice).eq('id', params.id);
			return fail(400, { error: deleteItemsError.message });
		}

		const { error: insertItemsError } = await locals.supabase.from('invoice_items').insert(
			normalizedItems.map((item) => ({
				invoice_id: params.id,
				product_id: item.product_id,
				description: item.description,
				color: item.color,
				model: item.model,
				quantity: item.quantity,
				unit_price: item.unit_price,
				amount: item.amount
			}))
		);

		if (insertItemsError) {
			await locals.supabase.from('invoice_items').insert(previousItems);
			await locals.supabase.from('invoices').update(previousInvoice).eq('id', params.id);
			return fail(400, { error: insertItemsError.message });
		}

		throw redirect(303, `/dashboard/proforma/${params.id}`);
	}
};
