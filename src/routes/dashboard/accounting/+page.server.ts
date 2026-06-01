import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [paymentsResult, invoicesResult, clientsResult] = await Promise.all([
			locals.supabase
				.from('accounting')
				.select('*, profiles:created_by(name, email), invoices(invoice_number, client_name), clients(client_type, full_name, alias, company_name)')
				.order('payment_date', { ascending: false }),
			locals.supabase
				.from('invoices')
				.select('id, client_id, total_amount, status, due_date')
				.in('status', ['pending', 'overdue']),
			locals.supabase
				.from('clients')
				.select('id, client_type, full_name, alias, company_name')
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

		return {
			payments: paymentsResult.data || [],
			outstandingInvoices: invoicesResult.data || [],
			clients: clientsResult.data || []
		};
	} catch (e) {
		console.error('Unexpected exception in accounting load:', e);
		return { payments: [], outstandingInvoices: [], clients: [] };
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
			const { error } = await locals.supabase
				.from('accounting')
				.delete()
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Ocurrió un error al eliminar.' });
		}
	}
};