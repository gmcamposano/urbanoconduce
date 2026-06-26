import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildInvoiceBalances } from '$lib/server/accounting';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [invoicesResult, allocationsResult] = await Promise.all([
			locals.supabase
				.from('invoices')
				.select('*, profiles:created_by(name, email)')
				.eq('factura_tipo', 'proforma')
				.order('created_at', { ascending: false }),
			locals.supabase
				.from('accounting_allocations')
				.select('id, payment_id, invoice_id, applied_amount')
		]);

		if (invoicesResult.error) {
			console.error('Supabase query error in dashboard load:', invoicesResult.error.message);
			return { invoices: [] };
		}

		if (allocationsResult.error) {
			console.error(
				'Supabase query error in dashboard allocations:',
				allocationsResult.error.message
			);
		}

		const allInvoiceIds = new Set((invoicesResult.data || []).map((invoice) => invoice.id));
		const allocations = (allocationsResult.data || []).filter((allocation) =>
			allInvoiceIds.has(allocation.invoice_id)
		);
		const invoices = buildInvoiceBalances(invoicesResult.data || [], allocations);

		return {
			invoices
		};
	} catch (e) {
		console.error('Unexpected exception in dashboard load:', e);
		return { invoices: [] };
	}
};

export const actions: Actions = {
	deleteInvoice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'Solo administradores y editores pueden eliminar proformas.' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'El ID de la factura es obligatorio.' });
		}

		try {
			const { data: invoice, error: invoiceError } = await locals.supabase
				.from('invoices')
				.select('id, factura_tipo')
				.eq('id', id)
				.single();

			if (invoiceError || !invoice) {
				return fail(404, { error: 'No se encontró la proforma.' });
			}

			if (invoice.factura_tipo !== 'proforma') {
				return fail(403, { error: 'Solo se pueden eliminar proformas desde este módulo.' });
			}

			const { error } = await locals.supabase.from('invoices').delete().eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Ocurrió un error al eliminar.' });
		}
	}
};
