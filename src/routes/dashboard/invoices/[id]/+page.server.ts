import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	try {
		// 1. Fetch Invoice Details
		const { data: invoice, error: invoiceError } = await locals.supabase
			.from('invoices')
			.select('*, profiles:created_by(name, email)')
			.eq('id', id)
			.single();

		if (invoiceError || !invoice) {
			console.error('Error fetching invoice details:', invoiceError?.message);
			throw redirect(303, '/dashboard');
		}

		// 2. Fetch Line Items
		const { data: items, error: itemsError } = await locals.supabase
			.from('invoice_items')
			.select('*')
			.eq('invoice_id', id)
			.order('created_at', { ascending: true });

		if (itemsError) {
			console.error('Error fetching invoice items:', itemsError.message);
		}

		return {
			invoice,
			items: items || []
		};
	} catch (e) {
		console.error('Invoice details load exception:', e);
		throw redirect(303, '/dashboard');
	}
};

export const actions: Actions = {
	updateStatus: async ({ request, params, locals }) => {
		const { id } = params;
		const formData = await request.formData();
		const status = formData.get('status') as string;

		if (!status) {
			return fail(400, { error: 'Status is required.' });
		}

		try {
			// Enforced by RLS: Admins & Editors can update invoices
			const { error } = await locals.supabase
				.from('invoices')
				.update({ status })
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: any) {
			return fail(400, { error: e.message || 'Failed to update status.' });
		}
	},

	deleteInvoice: async ({ params, locals }) => {
		const { id } = params;

		try {
			// Enforced by RLS: Only Admins can delete invoices
			const { error } = await locals.supabase
				.from('invoices')
				.delete()
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Failed to delete.' });
		}

		throw redirect(303, '/dashboard');
	}
};
