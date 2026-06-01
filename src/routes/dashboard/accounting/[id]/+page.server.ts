import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildPaymentSummaries } from '$lib/server/accounting';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user } = await locals.safeGetUser();

	if (!user) {
		throw redirect(303, '/login');
	}

	const { id } = params;

	try {
		const [paymentResult, allocationsResult] = await Promise.all([
			locals.supabase
				.from('accounting')
				.select(
					'*, profiles:created_by(name, email), clients(client_type, full_name, alias, company_name, rnc), invoices:invoice_id(invoice_number, client_name, total_amount, due_date, invoice_date, status, factura_tipo)'
				)
				.eq('id', id)
				.single(),
			locals.supabase
				.from('accounting_allocations')
				.select(
					'id, payment_id, invoice_id, applied_amount, invoices(invoice_number, client_name, total_amount, due_date, invoice_date, status, factura_tipo)'
				)
				.eq('payment_id', id)
		]);

		if (paymentResult.error || !paymentResult.data) {
			console.error('Error fetching payment details:', paymentResult.error?.message);
			throw redirect(303, '/dashboard/accounting');
		}

		if (allocationsResult.error) {
			console.error('Error fetching payment allocations:', allocationsResult.error.message);
		}

		const payment = buildPaymentSummaries([paymentResult.data], allocationsResult.data || [])[0];

		return {
			payment
		};
	} catch (e) {
		console.error('Payment details load exception:', e);
		throw redirect(303, '/dashboard/accounting');
	}
};

export const actions: Actions = {
	deletePayment: async ({ params, locals }) => {
		const { id } = params;
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede eliminar pagos.' });
		}

		try {
			const { error } = await locals.supabase.rpc('delete_accounting_payment', {
				p_payment_id: id
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'No se pudo eliminar.' });
		}

		throw redirect(303, '/dashboard/accounting');
	}
};
