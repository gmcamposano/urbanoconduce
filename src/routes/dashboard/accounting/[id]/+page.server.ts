import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { data: payment, error: paymentError } = await locals.supabase
			.from('accounting')
			.select('*, profiles:created_by(name, email), invoices(invoice_number, client_name, total_amount), clients(client_type, full_name, alias, company_name, rnc)')
			.eq('id', id)
			.single();

		if (paymentError || !payment) {
			console.error('Error fetching payment details:', paymentError?.message);
			throw redirect(303, '/dashboard/accounting');
		}

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
			const { error } = await locals.supabase
				.from('accounting')
				.delete()
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'No se pudo eliminar.' });
		}

		throw redirect(303, '/dashboard/accounting');
	}
};