import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { updateProforma } from '$lib/server/proformaService';
import { failFromService, readProformaForm } from '$lib/server/proformaForm';

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard/proforma');
	}

	const [
		invoiceResult,
		itemsResult,
		productsResult,
		colorsResult,
		modelsResult,
		clientsResult,
		clientPricesResult
	] = await Promise.all([
		locals.supabase
			.from('invoices')
			.select('*, profiles:created_by(name, email)')
			.eq('id', params.id)
			.single(),
		locals.supabase
			.from('invoice_items')
			.select('*')
			.eq('invoice_id', params.id)
			.order('created_at', { ascending: true }),
		locals.supabase
			.from('products')
			.select('id, title, price_without_taxes, model')
			.order('title', { ascending: true }),
		locals.supabase
			.from('product_colors')
			.select('id, color, sort_order')
			.order('sort_order', { ascending: true }),
		locals.supabase.from('product_models').select('id, model').order('model', { ascending: true }),
		locals.supabase
			.from('clients')
			.select('id, client_type, full_name, company_name, alias, email')
			.order('company_name', { ascending: true })
			.order('full_name', { ascending: true }),
		locals.supabase.from('client_product_prices').select('product_id, client_id, unit_price')
	]);

	if (invoiceResult.error || !invoiceResult.data) {
		console.error('Error fetching invoice for edit:', invoiceResult.error?.message);
		throw redirect(303, '/dashboard/proforma');
	}

	if (invoiceResult.data.factura_tipo !== 'proforma') {
		throw redirect(303, `/dashboard/invoices/${params.id}/edit`);
	}

	if (itemsResult.error) {
		console.error('Error fetching invoice items for edit:', itemsResult.error.message);
	}

	if (productsResult.error) {
		console.error('Error fetching products for edit:', productsResult.error.message);
	}

	if (colorsResult.error) {
		console.error('Error fetching colors for edit:', colorsResult.error.message);
	}

	if (modelsResult.error) {
		console.error('Error fetching models for edit:', modelsResult.error.message);
	}

	if (clientsResult.error) {
		console.error('Error fetching clients for edit:', clientsResult.error.message);
	}

	if (clientPricesResult.error) {
		console.error('Error fetching client prices for edit:', clientPricesResult.error.message);
	}

	const products = productsResult.data || [];
	const colors = colorsResult.data || [];
	const models = modelsResult.data || [];
	const clients = clientsResult.data || [];

	return {
		invoice: invoiceResult.data,
		items:
			itemsResult.data?.map((item) => {
				let product = products.find((entry) => entry.id === item.product_id);
				if (!product && item.product_id) {
					product = products.find((entry) => entry.id === item.product_id);
				}
				if (!product && item.description) {
					product = products.find((entry) => entry.title === item.description);
				}

				return {
					id: item.id,
					description: item.description,
					product_id: item.product_id || product?.id || '',
					color: item.color || '',
					model: product?.model ?? null,
					quantity: Number(item.quantity),
					unit_price: Number(item.unit_price)
				};
			}) || [],
		products,
		colors,
		models,
		clients,
		clientPrices: clientPricesResult.data || [],
		isAdmin: profile?.role === 'admin'
	};
};
export const actions: Actions = {
	updateInvoice: async ({ request, params, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'No tienes permisos para editar proformas.' });
		}

		const { items, ...input } = readProformaForm(await request.formData());
		if (!items) {
			return fail(400, { error: 'No se pudieron procesar los conceptos.' });
		}

		const result = await updateProforma(locals.supabase, user.id, params.id, { ...input, items });
		if (!result.ok) {
			if (result.notProforma) throw redirect(303, `/dashboard/invoices/${params.id}/edit`);
			return failFromService(result);
		}

		throw redirect(303, `/dashboard/proforma/${params.id}`);
	}
};
