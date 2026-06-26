import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildClientCreditSummary, buildInvoiceBalances } from '$lib/server/accounting';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin') {
		throw redirect(303, `/dashboard/accounting/${params.id}`);
	}

	const [paymentResult, clientsResult, invoicesResult, allocationsResult] = await Promise.all([
		locals.supabase
			.from('accounting')
			.select('id, client_id, amount, payment_date, payment_method, reference_number, notes')
			.eq('id', params.id)
			.single(),
		locals.supabase
			.from('clients')
			.select('id, client_type, full_name, company_name, alias, rnc, email')
			.order('company_name', { ascending: true })
			.order('full_name', { ascending: true }),
		locals.supabase
			.from('invoices')
			.select(
				'id, client_id, invoice_number, total_amount, status, due_date, invoice_date, factura_tipo, created_at'
			)
			.eq('factura_tipo', 'proforma')
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('accounting_allocations')
			.select('id, payment_id, invoice_id, applied_amount')
	]);

	if (paymentResult.error || !paymentResult.data) {
		console.error('Supabase query error in payment edit load:', paymentResult.error?.message);
		throw redirect(303, '/dashboard/accounting');
	}

	if (clientsResult.error) {
		console.error('Supabase query error in payment edit clients:', clientsResult.error.message);
	}

	if (invoicesResult.error) {
		console.error('Supabase query error in payment edit invoices:', invoicesResult.error.message);
	}

	if (allocationsResult.error) {
		console.error(
			'Supabase query error in payment edit allocations:',
			allocationsResult.error.message
		);
	}

	const allocationsExcludingCurrentPayment = (allocationsResult.data || []).filter(
		(allocation) => allocation.payment_id !== paymentResult.data.id
	);
	const invoiceBalances = buildInvoiceBalances(
		invoicesResult.data || [],
		allocationsExcludingCurrentPayment
	);
	const clientBalances = buildClientCreditSummary(invoiceBalances, clientsResult.data || []);

	return {
		clients: clientsResult.data || [],
		clientBalances,
		initialPayment: paymentResult.data,
		actionUrl: '?/updatePayment'
	};
};

export const actions: Actions = {
	updatePayment: async ({ request, params, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede editar pagos.' });
		}

		const formData = await request.formData();
		const submittedId = String(formData.get('id') ?? '').trim();
		const paymentId = params.id;
		const clientId = String(formData.get('client_id') ?? '').trim();
		const amount = Number(formData.get('amount') ?? 0);
		const paymentDate = String(formData.get('payment_date') ?? '').trim();
		const paymentMethod = String(formData.get('payment_method') ?? '').trim();
		const referenceNumber = String(formData.get('reference_number') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();

		if (submittedId && submittedId !== paymentId) {
			return fail(400, { error: 'El pago enviado no coincide con la ruta.' });
		}

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
			const { error } = await locals.supabase.rpc('update_accounting_payment', {
				p_payment_id: paymentId,
				p_client_id: clientId,
				p_amount: amount,
				p_payment_date: paymentDate,
				p_payment_method: paymentMethod,
				p_reference_number: referenceNumber || null,
				p_notes: notes || null
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			console.error('Payment update exception:', e);
			return fail(500, { error: e instanceof Error ? e.message : 'Ocurrió un error inesperado.' });
		}

		throw redirect(303, `/dashboard/accounting/${paymentId}`);
	}
};
