import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildInvoiceBalances, toAmount } from '$lib/server/accounting';

const VALID_STATUSES = ['draft', 'pending', 'paid', 'overdue'] as const;

type PaymentRelation = {
	id?: string;
	payment_date?: string | null;
	payment_method?: string | null;
	reference_number?: string | null;
	notes?: string | null;
	created_at?: string | null;
	profiles?: { name?: string | null; email?: string | null } | null;
};

function firstPaymentRelation(payment: unknown): PaymentRelation | null {
	if (Array.isArray(payment)) {
		return firstPaymentRelation(payment[0]);
	}

	if (payment && typeof payment === 'object') {
		return payment as PaymentRelation;
	}

	return null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	try {
		const { data: invoice, error: invoiceError } = await locals.supabase
			.from('invoices')
			.select('*, profiles:created_by(name, email), clients:client_id(client_type, rnc)')
			.eq('id', id)
			.single();

		if (invoiceError || !invoice) {
			console.error('Error fetching invoice details:', invoiceError?.message);
			throw redirect(303, '/dashboard/proforma');
		}

		if (invoice.factura_tipo !== 'proforma') {
			throw redirect(303, `/dashboard/invoices/${id}`);
		}

		const [itemsResult, productsResult, modelsResult, allocationsResult] = await Promise.all([
			locals.supabase
				.from('invoice_items')
				.select('*')
				.eq('invoice_id', id)
				.order('created_at', { ascending: true }),
			locals.supabase
				.from('products')
				.select('id, title, model')
				.order('title', { ascending: true }),
			locals.supabase
				.from('product_models')
				.select('id, model')
				.order('model', { ascending: true }),
			locals.supabase
				.from('accounting_allocations')
				.select(
					'id, payment_id, invoice_id, applied_amount, created_at, payment:payment_id(id, payment_date, payment_method, reference_number, notes, created_at, profiles:created_by(name, email))'
				)
				.eq('invoice_id', id)
				.order('created_at', { ascending: false })
		]);

		if (itemsResult.error) {
			console.error('Error fetching invoice items:', itemsResult.error.message);
		}

		if (productsResult.error) {
			console.error('Error fetching products:', productsResult.error.message);
		}

		if (modelsResult.error) {
			console.error('Error fetching models:', modelsResult.error.message);
		}

		if (allocationsResult.error) {
			console.error('Error fetching payment allocations:', allocationsResult.error.message);
		}

		const allocations = allocationsResult.data || [];
		const invoiceWithBalance = buildInvoiceBalances([invoice], allocations)[0] ?? {
			...invoice,
			paidAmount: 0,
			balanceDue: toAmount(invoice.total_amount),
			isFullyPaid: false
		};
		const paymentBreakdown = allocations
			.map((allocation) => {
				const payment = firstPaymentRelation((allocation as { payment?: unknown }).payment);

				return {
					id: allocation.id,
					payment_id: allocation.payment_id,
					applied_amount: toAmount(allocation.applied_amount),
					payment_date: payment?.payment_date || '',
					payment_method: payment?.payment_method || '',
					reference_number: payment?.reference_number || null,
					notes: payment?.notes || null,
					created_at: payment?.created_at || allocation.created_at,
					created_by_name: payment?.profiles?.name || null
				};
			})
			.sort((a, b) => {
				const left = new Date(b.payment_date || b.created_at || 0).getTime();
				const right = new Date(a.payment_date || a.created_at || 0).getTime();
				return left - right;
			});

		return {
			invoice: invoiceWithBalance,
			items: itemsResult.data || [],
			products: productsResult.data || [],
			models: modelsResult.data || [],
			paymentBreakdown
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

		const { data: currentInvoice, error: currentInvoiceError } = await locals.supabase
			.from('invoices')
			.select('status, factura_tipo')
			.eq('id', id)
			.single();

		if (currentInvoiceError || !currentInvoice) {
			return fail(404, { error: 'No se encontró la proforma.' });
		}

		if (currentInvoice.factura_tipo !== 'proforma') {
			throw redirect(303, `/dashboard/invoices/${id}`);
		}

		if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
			return fail(400, { error: 'El estado seleccionado no es válido.' });
		}

		if (status === 'paid' && currentInvoice.status !== 'paid') {
			return fail(400, {
				error: 'Las proformas se saldan automáticamente cuando los abonos cubren el total.'
			});
		}

		try {
			const { error } = await locals.supabase
				.from('invoices')
				.update({
					status,
					factura_tipo: 'proforma'
				})
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'No se pudo actualizar el estado.'
			});
		}

		throw redirect(303, `/dashboard/proforma/${id}`);
	},

	deleteInvoice: async ({ params, locals }) => {
		const { id } = params;
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'Solo administradores y editores pueden eliminar proformas.' });
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

			// Enforced by RLS: admins can delete any invoice, editors only proformas
			const { error } = await locals.supabase.from('invoices').delete().eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'No se pudo eliminar.' });
		}

		throw redirect(303, '/dashboard/proforma');
	}
};
