import { fail, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Actions, PageServerLoad } from './$types';
import type { Database } from '$lib/database.types';
import { buildClientCreditSummary, buildInvoiceBalances } from '$lib/server/accounting';

type StockWarning = {
	invoiceNumber: string;
	title: string;
	color: string;
	available: number;
	requested: number;
};

async function getStockWarningsForPayment(
	supabase: SupabaseClient<Database>,
	paymentId: string
): Promise<StockWarning[]> {
	const { data: allocations, error: allocationsError } = await supabase
		.from('accounting_allocations')
		.select('invoice_id')
		.eq('payment_id', paymentId);

	if (allocationsError || !allocations?.length) return [];

	const invoiceIds = [...new Set(allocations.map((allocation) => allocation.invoice_id))];
	const { data: items, error: itemsError } = await supabase
		.from('invoice_items')
		.select('invoice_id, product_variant_id, quantity')
		.in('invoice_id', invoiceIds)
		.not('product_variant_id', 'is', null);

	if (itemsError || !items?.length) return [];

	const variantIds = [
		...new Set(items.map((item) => item.product_variant_id).filter(Boolean))
	] as string[];
	const [
		{ data: movements, error: movementsError },
		{ data: invoices, error: invoicesError },
		{ data: variants, error: variantsError }
	] = await Promise.all([
		supabase
			.from('inventory_movements')
			.select('product_variant_id, quantity, reference_type, reference_id')
			.in('product_variant_id', variantIds),
		supabase.from('invoices').select('id, invoice_number').in('id', invoiceIds),
		supabase.from('product_variants').select('id, color, products(title)').in('id', variantIds)
	]);

	if (movementsError || invoicesError || variantsError) return [];

	const movedByInvoiceVariant = new Set(
		(movements || [])
			.filter((movement) => movement.reference_type === 'invoice' && movement.reference_id)
			.map((movement) => `${movement.reference_id}:${movement.product_variant_id}`)
	);
	const stockByVariant = new Map<string, number>();
	for (const movement of movements || []) {
		stockByVariant.set(
			movement.product_variant_id,
			(stockByVariant.get(movement.product_variant_id) || 0) + movement.quantity
		);
	}
	const invoiceNumbers = new Map(
		(invoices || []).map((invoice) => [invoice.id, invoice.invoice_number])
	);
	const variantDetails = new Map(
		(variants || []).map((variant) => {
			const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
			return [
				variant.id,
				{ title: product?.title || 'Producto', color: variant.color || 'sin color' }
			];
		})
	);
	const requestedByInvoiceVariant = new Map<
		string,
		{ invoiceId: string; variantId: string; requested: number }
	>();

	for (const item of items) {
		if (!item.product_variant_id) continue;
		const key = `${item.invoice_id}:${item.product_variant_id}`;
		const current = requestedByInvoiceVariant.get(key);
		requestedByInvoiceVariant.set(key, {
			invoiceId: item.invoice_id,
			variantId: item.product_variant_id,
			requested: (current?.requested || 0) + Number(item.quantity)
		});
	}

	return [...requestedByInvoiceVariant.values()]
		.filter(({ invoiceId, variantId, requested }) => {
			const available = Math.max(stockByVariant.get(variantId) || 0, 0);
			return available < requested && !movedByInvoiceVariant.has(`${invoiceId}:${variantId}`);
		})
		.map(({ invoiceId, variantId, requested }) => ({
			invoiceNumber: invoiceNumbers.get(invoiceId) || invoiceId,
			title: variantDetails.get(variantId)?.title || 'Producto',
			color: variantDetails.get(variantId)?.color || 'sin color',
			available: Math.max(stockByVariant.get(variantId) || 0, 0),
			requested
		}));
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard');
	}

	const { data: clients, error: clientsError } = await locals.supabase
		.from('clients')
		.select('id, client_type, full_name, company_name, alias, rnc, email')
		.order('company_name', { ascending: true })
		.order('full_name', { ascending: true });

	const [invoicesResult, allocationsResult] = await Promise.all([
		locals.supabase
			.from('invoices')
			.select(
				'id, client_id, invoice_number, total_amount, status, due_date, invoice_date, factura_tipo, created_at'
			)
			.in('status', ['pending', 'overdue'])
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('accounting_allocations')
			.select('id, payment_id, invoice_id, applied_amount')
	]);

	if (clientsError) {
		console.error('Supabase query error in payment load clients:', clientsError.message);
	}

	if (invoicesResult.error) {
		console.error('Supabase query error in payment load invoices:', invoicesResult.error.message);
	}

	if (allocationsResult.error) {
		console.error(
			'Supabase query error in payment load allocations:',
			allocationsResult.error.message
		);
	}

	const invoiceBalances = buildInvoiceBalances(
		invoicesResult.data || [],
		allocationsResult.data || []
	);
	const clientBalances = buildClientCreditSummary(invoiceBalances, clients || []);

	return {
		clients: clients || [],
		clientBalances
	};
};

export const actions: Actions = {
	createPayment: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'No tienes permisos para registrar pagos.' });
		}

		const formData = await request.formData();
		const clientId = String(formData.get('client_id') ?? '').trim();
		const amount = Number(formData.get('amount') ?? 0);
		const paymentDate = String(formData.get('payment_date') ?? '').trim();
		const paymentMethod = String(formData.get('payment_method') ?? '').trim();
		const referenceNumber = String(formData.get('reference_number') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();

		if (!clientId || !amount || !paymentDate || !paymentMethod) {
			return fail(400, { error: 'Cliente, monto, fecha y método son obligatorios.' });
		}

		if (amount <= 0) {
			return fail(400, { error: 'El monto debe ser mayor que cero.' });
		}

		const validMethods = ['cash', 'transfer', 'check', 'card', 'other'];
		if (!validMethods.includes(paymentMethod)) {
			return fail(400, { error: 'Método de pago inválido.' });
		}

		try {
			const { data: paymentResult, error: paymentError } = await locals.supabase.rpc(
				'record_accounting_payment',
				{
					p_client_id: clientId,
					p_amount: amount,
					p_payment_date: paymentDate,
					p_payment_method: paymentMethod,
					p_reference_number: referenceNumber || null,
					p_notes: notes || null,
					p_created_by: user.id
				}
			);

			if (paymentError) {
				return fail(400, { error: paymentError.message });
			}

			const paymentId = (paymentResult as { payment_id?: string } | null)?.payment_id;
			const stockWarnings = paymentId
				? await getStockWarningsForPayment(locals.supabase, paymentId)
				: [];
			if (stockWarnings.length > 0) {
				const warningText = stockWarnings
					.map(
						(warning) =>
							`${warning.invoiceNumber}: ${warning.title} (${warning.color}), disponible ${warning.available}, requerido ${warning.requested}`
					)
					.join('; ');
				return {
					success: true,
					warning: `Alerta de inventario: ${warningText}.`
				};
			}
		} catch (e: unknown) {
			console.error('Payment save exception:', e);
			return fail(500, { error: e instanceof Error ? e.message : 'Ocurrió un error inesperado.' });
		}

		throw redirect(303, '/dashboard/accounting');
	}
};
