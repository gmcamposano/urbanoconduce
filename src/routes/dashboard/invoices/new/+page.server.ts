import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard');
	}

	const randomSuffix = Math.floor(1000 + Math.random() * 9000);
	const invoiceNumberPreview = `INV-2026-${randomSuffix}`;

	const { data: products, error: productsError } = await locals.supabase
		.from('products')
		.select('id, title, price_without_taxes')
		.order('title', { ascending: true });

	if (productsError) {
		console.error('Supabase query error in invoice load products:', productsError.message);
	}

	return {
		invoiceNumberPreview,
		products: products || []
	};
};

export const actions: Actions = {
	createInvoice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const invoiceNumber = formData.get('invoice_number') as string;
		const clientName = formData.get('client_name') as string;
		const clientEmail = formData.get('client_email') as string;
		const invoiceDate = formData.get('invoice_date') as string;
		const dueDate = formData.get('due_date') as string;
		const status = formData.get('status') as string;
		const notes = formData.get('notes') as string;
		const taxRate = Number(formData.get('tax_rate') || 0);
		const discountAmount = Number(formData.get('discount_amount') || 0);
		const itemsJson = formData.get('items') as string;

		if (!invoiceNumber || !clientName || !clientEmail || !invoiceDate || !dueDate || !status) {
			return fail(400, { error: 'Todos los datos principales son obligatorios.' });
		}

		let items: Array<{ product_id: string; quantity: number }> = [];
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

		const { data: products, error: productsError } = await locals.supabase
			.from('products')
			.select('id, title, price_without_taxes')
			.in('id', productIds);

		if (productsError) {
			return fail(400, { error: productsError.message });
		}

		const productMap = new Map((products || []).map((product) => [product.id, product]));
		const normalizedItems: Array<{ description: string; quantity: number; unit_price: number; amount: number }> = [];

		for (const item of items) {
			const quantity = Number(item.quantity);
			const product = productMap.get(item.product_id);

			if (!product || quantity <= 0) {
				return fail(400, { error: 'Los conceptos deben tener un producto válido y cantidad mayor que cero.' });
			}

			const unitPrice = Number(product.price_without_taxes);
			normalizedItems.push({
				description: product.title,
				quantity,
				unit_price: unitPrice,
				amount: quantity * unitPrice
			});
		}

		const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
		const taxAmount = subtotal * (taxRate / 100);
		const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);

		try {
			const { data: invoice, error: invoiceError } = await locals.supabase
				.from('invoices')
				.insert({
					invoice_number: invoiceNumber,
					client_name: clientName,
					client_email: clientEmail,
					invoice_date: invoiceDate,
					due_date: dueDate,
					status,
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
				description: item.description,
				quantity: item.quantity,
				unit_price: item.unit_price,
				amount: item.amount
			}));

			const { error: itemsError } = await locals.supabase.from('invoice_items').insert(invoiceItemsData);

			if (itemsError) {
				await locals.supabase.from('invoices').delete().eq('id', invoice.id);
				return fail(400, { error: `Failed to save invoice items: ${itemsError.message}` });
			}
		} catch (e: any) {
			console.error('Invoice save exception:', e);
			return fail(500, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		throw redirect(303, '/dashboard');
	}
};
