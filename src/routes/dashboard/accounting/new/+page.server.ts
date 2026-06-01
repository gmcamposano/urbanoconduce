import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard/accounting');
	}

	const { data: clients, error: clientsError } = await locals.supabase
		.from('clients')
		.select('id, client_type, full_name, company_name, alias, rnc, email')
		.order('company_name', { ascending: true })
		.order('full_name', { ascending: true });

	const { data: invoices, error: invoicesError } = await locals.supabase
		.from('invoices')
		.select('id, invoice_number, client_id, client_name, total_amount, status, due_date')
		.in('status', ['pending', 'overdue'])
		.order('created_at', { ascending: false });

	if (clientsError) {
		console.error('Supabase query error in payment load clients:', clientsError.message);
	}

	if (invoicesError) {
		console.error('Supabase query error in payment load invoices:', invoicesError.message);
	}

	return {
		clients: clients || [],
		invoices: invoices || []
	};
};

export const actions: Actions = {
	createPayment: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'No tienes permisos para registrar pagos.' });
		}

		const formData = await request.formData();
		const clientId = String(formData.get('client_id') ?? '').trim();
		const invoiceId = String(formData.get('invoice_id') ?? '').trim() || null;
		const amount = Number(formData.get('amount') ?? 0);
		const paymentDate = String(formData.get('payment_date') ?? '').trim();
		const paymentMethod = String(formData.get('payment_method') ?? '').trim();
		const referenceNumber = String(formData.get('reference_number') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();

		if (!clientId || !amount || !paymentDate || !paymentMethod) {
			return fail(400, { error: 'Cliente, monto, fecha y método son obligatorios.' });
		}

		if (amount <= 0) {
			return fail(400, { error: 'El monto debe ser mayor que cero.' });
		}

		const validMethods = ['cash', 'transfer', 'check', 'card', 'other'];
		if (!validMethods.includes(paymentMethod)) {
			return fail(400, { error: 'Método de pago inválido.' });
		}

		try {
			const { error: paymentError } = await locals.supabase
				.from('accounting')
				.insert({
					client_id: clientId,
					invoice_id: invoiceId || null,
					amount,
					payment_date: paymentDate,
					payment_method: paymentMethod,
					reference_number: referenceNumber || null,
					notes: notes || null,
					created_by: user.id
				})
				.select('id')
				.single();

			if (paymentError) {
				return fail(400, { error: paymentError.message });
			}

			if (invoiceId) {
				const { data: invoicePayments } = await locals.supabase
					.from('accounting')
					.select('amount')
					.eq('invoice_id', invoiceId);

				const totalPaid = (invoicePayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

				const { data: invoice } = await locals.supabase
					.from('invoices')
					.select('total_amount')
					.eq('id', invoiceId)
					.single();

				if (invoice && totalPaid >= Number(invoice.total_amount)) {
					await locals.supabase
						.from('invoices')
						.update({ status: 'paid' })
						.eq('id', invoiceId);
				}
			}
		} catch (e: unknown) {
			console.error('Payment save exception:', e);
			return fail(500, { error: e instanceof Error ? e.message : 'Ocurrió un error inesperado.' });
		}

		throw redirect(303, '/dashboard/accounting');
	}
};