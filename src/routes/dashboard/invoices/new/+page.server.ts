import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();

	// Guard: Only Admin and Editor are permitted to access this page
	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard');
	}

	// Generate a unique invoice number preview
	const randomSuffix = Math.floor(1000 + Math.random() * 9000);
	const invoiceNumberPreview = `INV-2026-${randomSuffix}`;

	return {
		invoiceNumberPreview
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
		
		// Line items are serialized as JSON on the client side
		const itemsJson = formData.get('items') as string;

		if (!invoiceNumber || !clientName || !clientEmail || !invoiceDate || !dueDate || !status) {
			return fail(400, { error: 'Todos los datos principales son obligatorios.' });
		}

		let items: Array<{ description: string; quantity: number; unit_price: number }> = [];
		try {
			items = JSON.parse(itemsJson || '[]');
		} catch (e) {
			return fail(400, { error: 'No se pudieron procesar los conceptos.' });
		}

		if (items.length === 0) {
			return fail(400, { error: 'Debes agregar al menos un concepto.' });
		}

		// Validate items values
		for (const item of items) {
			if (!item.description || Number(item.quantity) <= 0 || Number(item.unit_price) < 0) {
				return fail(400, { error: 'Los conceptos deben tener una descripción válida, cantidad mayor que cero y precio unitario mayor o igual a cero.' });
			}
		}

		// Calculate total server-side
		const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
		const taxAmount = subtotal * (taxRate / 100);
		const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);

		try {
			// 1. Insert Invoice
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

			if (invoiceError) {
				return fail(400, { error: invoiceError.message });
			}

			// 2. Insert Invoice Items
			const invoiceItemsData = items.map((item) => ({
				invoice_id: invoice.id,
				description: item.description,
				quantity: Number(item.quantity),
				unit_price: Number(item.unit_price),
				amount: Number(item.quantity) * Number(item.unit_price)
			}));

			const { error: itemsError } = await locals.supabase
				.from('invoice_items')
				.insert(invoiceItemsData);

			if (itemsError) {
				// Cleanup orphaned invoice
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
