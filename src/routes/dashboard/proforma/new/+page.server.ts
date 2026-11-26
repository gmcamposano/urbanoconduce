import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { generateUniqueInvoiceNumber } from '$lib/server/invoiceNumber';
import { createProforma } from '$lib/server/proformaService';
import { failFromService, readProformaForm } from '$lib/server/proformaForm';

async function loadData(locals: App.Locals) {
	const [
		invoiceNumberPreview,
		{ data: products, error: productsError },
		{ data: colors, error: colorsError },
		{ data: models, error: modelsError },
		{ data: clients, error: clientsError },
		{ data: clientPrices, error: clientPricesError }
	] = await Promise.all([
		generateUniqueInvoiceNumber(locals.supabase, 'INV'),
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

	if (productsError) {
		console.error('Supabase query error in invoice load products:', productsError.message);
	}

	if (colorsError) {
		console.error('Supabase query error in invoice load colors:', colorsError.message);
	}

	if (modelsError) {
		console.error('Supabase query error in invoice load models:', modelsError.message);
	}

	if (clientsError) {
		console.error('Supabase query error in invoice load clients:', clientsError.message);
	}

	if (clientPricesError) {
		console.error('Supabase query error in client_prices load:', clientPricesError.message);
	}

	return {
		invoiceNumberPreview,
		products: products || [],
		colors: colors || [],
		models: models || [],
		clients: clients || [],
		clientPrices: clientPrices || []
	};
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const dataPromise = loadData(locals);
	// Prevent an unhandled rejection if the guard below redirects before we await it.
	dataPromise.catch(() => {});

	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard/proforma');
	}

	return { ...(await dataPromise), isAdmin: profile?.role === 'admin' };
};
export const actions: Actions = {
	createInvoice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const { items, ...input } = readProformaForm(await request.formData());
		if (!items) {
			return fail(400, { error: 'No se pudieron procesar los conceptos.' });
		}

		try {
			const result = await createProforma(locals.supabase, user.id, { ...input, items });
			if (!result.ok) return failFromService(result);
		} catch (e: unknown) {
			console.error('Invoice save exception:', e);
			const message = e instanceof Error ? e.message : String(e);
			return fail(500, { error: message || 'Ocurrió un error inesperado.' });
		}
		throw redirect(303, '/dashboard/proforma');
	}
};
