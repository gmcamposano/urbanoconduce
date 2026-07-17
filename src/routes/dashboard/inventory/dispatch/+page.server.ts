import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveVariantIdForItem } from '$lib/server/inventory';

function generateInvoiceNumber() {
	const year = new Date().getUTCFullYear();
	const randomSuffix = Math.floor(1000 + Math.random() * 9000);
	return `DES-${year}-${randomSuffix}`;
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin' && profile?.role !== 'editor') {
		throw redirect(303, '/dashboard/inventory');
	}

	const invoiceNumberPreview = generateInvoiceNumber();

	const [
		{ data: products },
		{ data: colors },
		{ data: models },
		{ data: clients },
		{ data: warehouses }
	] = await Promise.all([
		locals.supabase.from('products').select('id, title, model').order('title', { ascending: true }),
		locals.supabase.from('product_colors').select('id, color').order('color', { ascending: true }),
		locals.supabase.from('product_models').select('id, model').order('model', { ascending: true }),
		locals.supabase
			.from('clients')
			.select('id, client_type, full_name, company_name, alias, email')
			.order('company_name', { ascending: true })
			.order('full_name', { ascending: true }),
		locals.supabase.from('warehouses').select('*').order('name', { ascending: true })
	]);

	return {
		invoiceNumberPreview,
		products: products || [],
		colors: colors || [],
		models: models || [],
		clients: clients || [],
		warehouses: warehouses || []
	};
};

export const actions: Actions = {
	createDispatch: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin' && locals.role !== 'editor') {
			return fail(403, { error: 'No tienes permisos para crear despachos.' });
		}

		const formData = await request.formData();
		const invoiceNumber =
			String(formData.get('invoice_number') ?? '').trim() || generateInvoiceNumber();
		const clientId = String(formData.get('client_id') ?? '').trim();
		const clientName = String(formData.get('client_name') ?? '').trim();
		const clientEmail = String(formData.get('client_email') ?? '').trim();
		const invoiceDate = String(formData.get('invoice_date') ?? '').trim();
		const notes = String(formData.get('notes') ?? '').trim();
		const itemsJson = String(formData.get('items') ?? '[]');

		if (!clientId || !clientName || !invoiceDate) {
			return fail(400, { error: 'Cliente y fecha son obligatorios.' });
		}

		let items: Array<{ product_id: string; color: string; quantity: number }>;
		try {
			items = JSON.parse(itemsJson || '[]');
		} catch {
			return fail(400, { error: 'No se pudieron procesar los conceptos.' });
		}

		if (items.length === 0) {
			return fail(400, { error: 'Debes agregar al menos un producto.' });
		}

		const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
		if (productIds.length === 0) {
			return fail(400, { error: 'Debes seleccionar al menos un producto válido.' });
		}

		const { data: products, error: productsError } = await locals.supabase
			.from('products')
			.select('id, title')
			.in('id', productIds);

		if (productsError) {
			return fail(400, { error: productsError.message });
		}

		const productMap = new Map((products || []).map((p) => [p.id, p]));
		const normalizedItems: Array<{
			product_id: string;
			product_variant_id: string | null;
			description: string;
			color: string | null;
			model: string | null;
			quantity: number;
			unit_price: number;
			amount: number;
		}> = [];

		for (const item of items) {
			const quantity = Number(item.quantity);
			const product = productMap.get(item.product_id);
			const color = (item.color || '').trim().toLowerCase();

			if (!product || quantity <= 0) {
				return fail(400, {
					error: 'Los conceptos deben tener un producto válido y cantidad mayor que cero.'
				});
			}

			const { id: variantId } = await resolveVariantIdForItem(
				locals.supabase,
				item.product_id,
				color
			);
			if (!variantId) {
				return fail(400, {
					error: `No existe variante de inventario para "${product.title}" con color "${color || 'sin color'}". Crea la variante primero.`
				});
			}

			normalizedItems.push({
				product_id: item.product_id,
				product_variant_id: variantId,
				description: product.title,
				color: color || null,
				model: null,
				quantity,
				unit_price: 0,
				amount: 0
			});
		}

		try {
			const { data: invoice, error: invoiceError } = await locals.supabase
				.from('invoices')
				.insert({
					invoice_number: invoiceNumber,
					factura_tipo: 'proforma',
					document_type: 'interna',
					ncf: null,
					client_id: clientId,
					client_name: clientName,
					client_email: clientEmail,
					invoice_date: invoiceDate,
					due_date: invoiceDate,
					status: 'pending',
					notes,
					tax_rate: 0,
					discount_amount: 0,
					total_amount: 0,
					created_by: user.id
				})
				.select('id')
				.single();

			if (invoiceError || !invoice) {
				return fail(400, { error: invoiceError?.message || 'No se pudo guardar el despacho.' });
			}

			const { error: itemsError } = await locals.supabase.from('invoice_items').insert(
				normalizedItems.map((item) => ({
					invoice_id: invoice.id,
					product_id: item.product_id,
					product_variant_id: item.product_variant_id,
					description: item.description,
					color: item.color,
					model: item.model,
					quantity: item.quantity,
					unit_price: 0,
					amount: 0
				}))
			);

			if (itemsError) {
				await locals.supabase.from('invoices').delete().eq('id', invoice.id);
				return fail(400, { error: itemsError.message });
			}

			const { error: statusError } = await locals.supabase
				.from('invoices')
				.update({ status: 'paid' })
				.eq('id', invoice.id);

			if (statusError) {
				await locals.supabase.from('invoices').delete().eq('id', invoice.id);
				return fail(400, { error: statusError.message });
			}

			throw redirect(303, `/dashboard/proforma/${invoice.id}`);
		} catch (e: unknown) {
			if (e && typeof e === 'object' && 'status' in e && e.status === 303) throw e;
			console.error('Dispatch save exception:', e);
			const message = e instanceof Error ? e.message : String(e);
			return fail(500, { error: message || 'Ocurrió un error inesperado.' });
		}
	}
};
