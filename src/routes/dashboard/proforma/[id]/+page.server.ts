import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const VALID_STATUSES = ['draft', 'pending', 'paid', 'overdue'] as const;

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	try {
		// 1. Fetch Invoice Details
		const { data: invoice, error: invoiceError } = await locals.supabase
			.from('invoices')
			.select('*, profiles:created_by(name, email), clients:client_id(client_type, rnc)')
			.eq('id', id)
			.single();

		if (invoiceError || !invoice) {
			console.error('Error fetching invoice details:', invoiceError?.message);
			throw redirect(303, '/dashboard/proforma');
		}

		if (invoice.status === 'paid') {
			throw redirect(303, `/dashboard/invoices/${id}`);
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

		// 3. Fetch Products (for model info)
		const { data: products, error: productsError } = await locals.supabase
			.from('products')
			.select('id, title, model')
			.order('title', { ascending: true });

		if (productsError) {
			console.error('Error fetching products:', productsError.message);
		}

		// 4. Fetch Models
		const { data: models, error: modelsError } = await locals.supabase
			.from('product_models')
			.select('id, model')
			.order('model', { ascending: true });

		if (modelsError) {
			console.error('Error fetching models:', modelsError.message);
		}

		return {
			invoice,
			items: items || [],
			products: products || [],
			models: models || []
		};
	} catch (e) {
		console.error('Invoice details load exception:', e);
		throw redirect(303, '/dashboard/proforma');
	}
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
			return fail(400, { error: 'El estado seleccionado no es válido.' });
		}

		try {
			// Enforced by RLS: Only Admins can update invoices
			const { error } = await locals.supabase
				.from('invoices')
				.update({
					status,
					factura_tipo: status === 'paid' ? 'ninguna' : 'proforma'
				})
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'No se pudo actualizar el estado.' });
		}

		throw redirect(303, status === 'paid' ? `/dashboard/invoices/${id}` : `/dashboard/proforma/${id}`);
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
			const { error } = await locals.supabase
				.from('invoices')
				.delete()
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'No se pudo eliminar.' });
		}

		throw redirect(303, '/dashboard/proforma');
	}
};
