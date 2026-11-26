import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const VALID_STATUSES = ['paid'] as const;

async function loadData(locals: App.Locals, id: string) {
	try {
		const [invoiceResult, itemsResult, productsResult, modelsResult] = await Promise.all([
			// 1. Fetch Invoice Details
			locals.supabase
				.from('invoices')
				.select('*, profiles:created_by(name, email), clients:client_id(client_type, rnc)')
				.eq('id', id)
				.single(),
			// 2. Fetch Line Items
			locals.supabase
				.from('invoice_items')
				.select('*')
				.eq('invoice_id', id)
				.order('created_at', { ascending: true }),
			// 3. Fetch Products (for model info)
			locals.supabase
				.from('products')
				.select('id, title, model')
				.order('title', { ascending: true }),
			// 4. Fetch Models
			locals.supabase.from('product_models').select('id, model').order('model', { ascending: true })
		]);

		const { data: invoice, error: invoiceError } = invoiceResult;

		if (invoiceError || !invoice) {
			console.error('Error fetching invoice details:', invoiceError?.message);
			throw redirect(303, '/dashboard/invoices');
		}

		if (invoice.factura_tipo === 'proforma') {
			throw redirect(303, `/dashboard/proforma/${id}`);
		}

		if (itemsResult.error) {
			console.error('Error fetching invoice items:', itemsResult.error.message);
		}

		if (productsResult.error) {
			console.error('Error fetching products:', productsResult.error.message);
		}

		if (modelsResult.error) {
			console.error('Error fetching models:', modelsResult.error.message);
		}

		return {
			invoice,
			items: itemsResult.data || [],
			products: productsResult.data || [],
			models: modelsResult.data || []
		};
	} catch (e) {
		console.error('Invoice details load exception:', e);
		throw redirect(303, '/dashboard/invoices');
	}
}

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const dataPromise = loadData(locals, params.id);
	// Prevent an unhandled rejection if the guard below redirects before we await it.
	dataPromise.catch(() => {});

	const { profile } = await parent();

	if (profile?.role !== 'admin') {
		throw redirect(303, '/dashboard/proforma');
	}

	return await dataPromise;
};

export const actions: Actions = {
	updateStatus: async ({ request, params, locals }) => {
		const { id } = params;
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede editar facturas.' });
		}

		const formData = await request.formData();
		const status = formData.get('status') as string;

		if (!status) {
			return fail(400, { error: 'El estado es obligatorio.' });
		}

		if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
			return fail(400, { error: 'Las facturas solo pueden marcarse como pagadas.' });
		}

		try {
			// Enforced by RLS: Only Admins can update invoices
			const { error } = await locals.supabase.from('invoices').update({ status }).eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: unknown) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'No se pudo actualizar el estado.'
			});
		}
	},

	deleteInvoice: async ({ params, locals }) => {
		const { id } = params;
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede eliminar facturas.' });
		}

		try {
			// Enforced by RLS: Only Admins can delete invoices
			const { error } = await locals.supabase.from('invoices').delete().eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'No se pudo eliminar.' });
		}

		throw redirect(303, '/dashboard/invoices');
	}
};
