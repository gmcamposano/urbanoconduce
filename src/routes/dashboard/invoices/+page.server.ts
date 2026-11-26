import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildInvoiceBalances, toAmount } from '$lib/server/accounting';

async function loadData(locals: App.Locals) {
	try {
		const embeddedSelect =
			'*, profiles:created_by(name, email), accounting_allocations(id, payment_id, invoice_id, applied_amount)';
		const [facturasResult, proformasResult] = await Promise.all([
			locals.supabase
				.from('invoices')
				.select(embeddedSelect)
				.neq('factura_tipo', 'proforma')
				.order('created_at', { ascending: false }),
			locals.supabase
				.from('invoices')
				.select(embeddedSelect)
				.eq('factura_tipo', 'proforma')
				.order('created_at', { ascending: false })
		]);

		if (facturasResult.error) {
			console.error('Supabase query error in dashboard load:', facturasResult.error.message);
			return { invoices: [], proformas: [], totalPaid: 0 };
		}

		if (proformasResult.error) {
			console.error('Supabase query error in proformas load:', proformasResult.error.message);
		}

		const allocations = [
			...(facturasResult.data || []).flatMap((row) => row.accounting_allocations || []),
			...(proformasResult.data || []).flatMap((row) => row.accounting_allocations || [])
		];
		// Strip the embedded allocations so they are not sent to the client.
		const facturaRows = (facturasResult.data || []).map((row) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { accounting_allocations, ...invoice } = row;
			return invoice;
		});
		const proformaRows = (proformasResult.data || []).map((row) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { accounting_allocations, ...invoice } = row;
			return invoice;
		});
		const invoices = buildInvoiceBalances(facturaRows, allocations);
		const proformas = buildInvoiceBalances(proformaRows, allocations);
		const facturaIds = new Set(facturaRows.map((inv) => inv.id));
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
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const dataPromise = loadData(locals);
	// Prevent an unhandled rejection if the guard below redirects before we await it.
	dataPromise.catch(() => {});

	const { profile } = await parent();

	if (profile?.role !== 'admin') {
		throw redirect(303, '/dashboard/proforma');
	}

	return await dataPromise;
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
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'Ocurrió un error al eliminar.' });
		}
	}
};
