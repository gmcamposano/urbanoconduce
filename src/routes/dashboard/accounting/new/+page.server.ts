import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildClientCreditSummary, buildInvoiceBalances } from '$lib/server/accounting';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard');
	}

	const { data: clients, error: clientsError } = await locals.supabase
		.from('clients')
		.select('id, client_type, full_name, company_name, alias, rnc, email')
		.order('company_name', { ascending: true })
		.order('full_name', { ascending: true });

	const [invoicesResult, allocationsResult] = await Promise.all([
		locals.supabase
			.from('invoices')
			.select(
				'id, client_id, invoice_number, total_amount, status, due_date, invoice_date, factura_tipo, created_at'
			)
			.in('status', ['pending', 'overdue'])
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('accounting_allocations')
			.select('id, payment_id, invoice_id, applied_amount')
	]);

	if (clientsError) {
		console.error('Supabase query error in payment load clients:', clientsError.message);
	}

	if (invoicesResult.error) {
		console.error('Supabase query error in payment load invoices:', invoicesResult.error.message);
	}

	if (allocationsResult.error) {
		console.error(
			'Supabase query error in payment load allocations:',
			allocationsResult.error.message
		);
	}

	const invoiceBalances = buildInvoiceBalances(
		invoicesResult.data || [],
		allocationsResult.data || []
	);
	const clientBalances = buildClientCreditSummary(invoiceBalances, clients || []);

	return {
		clients: clients || [],
		clientBalances
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
			const { error: paymentError } = await locals.supabase.rpc('record_accounting_payment', {
				p_client_id: clientId,
				p_amount: amount,
				p_payment_date: paymentDate,
				p_payment_method: paymentMethod,
				p_reference_number: referenceNumber || null,
				p_notes: notes || null,
				p_created_by: user.id
			});

			if (paymentError) {
				return fail(400, { error: paymentError.message });
			}
		} catch (e: unknown) {
			console.error('Payment save exception:', e);
			return fail(500, { error: e instanceof Error ? e.message : 'Ocurrió un error inesperado.' });
		}

		throw redirect(303, '/dashboard/accounting');
	}
};
