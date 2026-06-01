import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildInvoiceBalances, toAmount } from '$lib/server/accounting';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin') {
		throw redirect(303, '/dashboard/proforma');
	}

	try {
		const [facturasResult, proformasResult, allocationsResult] = await Promise.all([
			locals.supabase
				.from('invoices')
				.select('*, profiles:created_by(name, email)')
				.eq('status', 'paid')
				.order('created_at', { ascending: false }),
			locals.supabase
				.from('invoices')
				.select('*, profiles:created_by(name, email)')
				.neq('status', 'paid')
				.order('created_at', { ascending: false }),
			locals.supabase
				.from('accounting_allocations')
				.select('id, payment_id, invoice_id, applied_amount')
		]);

		if (facturasResult.error) {
			console.error('Supabase query error in dashboard load:', facturasResult.error.message);
			return { invoices: [], proformas: [], totalPaid: 0 };
		}

		if (proformasResult.error) {
			console.error('Supabase query error in proformas load:', proformasResult.error.message);
		}

		if (allocationsResult.error) {
			console.error(
				'Supabase query error in dashboard allocations:',
				allocationsResult.error.message
			);
		}

		const allInvoiceIds = new Set([
			...(facturasResult.data || []).map((invoice) => invoice.id),
			...(proformasResult.data || []).map((invoice) => invoice.id)
		]);
		const allocations = (allocationsResult.data || []).filter((allocation) =>
			allInvoiceIds.has(allocation.invoice_id)
		);
		const invoices = buildInvoiceBalances(facturasResult.data || [], allocations);
		const proformas = buildInvoiceBalances(proformasResult.data || [], allocations);
		const facturaIds = new Set((facturasResult.data || []).map((inv) => inv.id));
		const totalPaid = allocations.reduce(
			(sum, allocation) =>
				sum + (facturaIds.has(allocation.invoice_id) ? toAmount(allocation.applied_amount) : 0),
			0
		);

		return {
			invoices,
			proformas,
			totalPaid
		};
	} catch (e) {
		console.error('Unexpected exception in dashboard load:', e);
		return { invoices: [], proformas: [], totalPaid: 0 };
	}
};

export const actions: Actions = {
	deleteInvoice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede eliminar facturas.' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'El ID de la factura es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('invoices').delete().eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error al eliminar.' });
		}
	}
};
