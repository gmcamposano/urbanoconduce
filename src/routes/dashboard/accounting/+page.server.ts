import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	buildClientCreditSummary,
	buildInvoiceBalances,
	buildPaymentSummaries
} from '$lib/server/accounting';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetUser();

	if (!user) {
		throw redirect(303, '/login');
	}

	try {
		const [paymentsResult, invoicesResult, clientsResult, allocationsResult] = await Promise.all([
			locals.supabase
				.from('accounting')
				.select(
					'*, profiles:created_by(name, email), clients(client_type, full_name, alias, company_name), invoices:invoice_id(invoice_number, total_amount, due_date, invoice_date, status, client_id, client_name, factura_tipo)'
				)
				.order('payment_date', { ascending: false }),
			locals.supabase
				.from('invoices')
				.select(
					'id, client_id, invoice_number, total_amount, status, due_date, invoice_date, factura_tipo, created_at'
				)
				.in('status', ['pending', 'overdue']),
			locals.supabase.from('clients').select('id, client_type, full_name, alias, company_name'),
			locals.supabase
				.from('accounting_allocations')
				.select(
					'id, payment_id, invoice_id, applied_amount, invoices(invoice_number, total_amount, due_date, invoice_date, factura_tipo)'
				)
		]);

		if (paymentsResult.error) {
			console.error('Supabase query error for payments:', paymentsResult.error.message);
		}

		if (invoicesResult.error) {
			console.error('Supabase query error for invoices:', invoicesResult.error.message);
		}

		if (clientsResult.error) {
			console.error('Supabase query error for clients:', clientsResult.error.message);
		}

		if (allocationsResult.error) {
			console.error('Supabase query error for allocations:', allocationsResult.error.message);
		}

		const outstandingInvoices = buildInvoiceBalances(
			invoicesResult.data || [],
			allocationsResult.data || []
		);
		const payments = buildPaymentSummaries(paymentsResult.data || [], allocationsResult.data || []);
		const clientBalances = buildClientCreditSummary(outstandingInvoices, clientsResult.data || []);

		return {
			payments,
			outstandingInvoices,
			clients: clientsResult.data || [],
			clientBalances
		};
	} catch (e) {
		console.error('Unexpected exception in accounting load:', e);
		return { payments: [], outstandingInvoices: [], clients: [], clientBalances: [] };
	}
};

export const actions: Actions = {
	deletePayment: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede eliminar pagos.' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'El ID del pago es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.rpc('delete_accounting_payment', {
				p_payment_id: id
			});

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Ocurrió un error al eliminar.' });
		}
	}
};
