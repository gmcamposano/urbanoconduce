import type { PageServerLoad } from './$types';

const DEFAULT_DAYS = 30;

function toISODate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function isValidDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const now = new Date();
	const defaultFrom = new Date(now);
	defaultFrom.setDate(now.getDate() - DEFAULT_DAYS);

	let from = url.searchParams.get('from') || toISODate(defaultFrom);
	let to = url.searchParams.get('to') || toISODate(now);
	if (!isValidDate(from)) from = toISODate(defaultFrom);
	if (!isValidDate(to)) to = toISODate(now);
	if (from > to) [from, to] = [to, from];

	const clientParam = url.searchParams.get('client');
	const clientId = clientParam && clientParam !== 'all' ? clientParam : null;

	const tipoParam = url.searchParams.get('tipo');
	const tipo = tipoParam === 'proforma' || tipoParam === 'factura' ? tipoParam : 'all';

	const { data: clients, error: clientsError } = await locals.supabase
		.from('clients')
		.select('id, client_type, full_name, company_name, alias')
		.order('full_name', { ascending: true });

	if (clientsError) {
		console.error('Stats load error (clients):', clientsError.message);
	}

	let invoiceTypes = ['ninguna', 'proforma'];
	if (tipo === 'proforma') invoiceTypes = ['proforma'];
	if (tipo === 'factura') invoiceTypes = ['ninguna'];

	const [conversionsResult, invoicesResult] = await Promise.all([
		locals.supabase
			.from('invoices')
			.select('source_proforma_id')
			.not('source_proforma_id', 'is', null),
		locals.supabase
			.from('invoices')
			.select('id, client_id, factura_tipo')
			.in('factura_tipo', invoiceTypes)
			.gte('invoice_date', from)
			.lte('invoice_date', to)
			.order('invoice_date', { ascending: true })
	]);

	if (invoicesResult.error) {
		console.error('Stats load error (invoices):', invoicesResult.error.message);
		return {
			clients: clients || [],
			itemsByDescription: [],
			unitsSold: 0,
			totalAmount: 0,
			from,
			to,
			clientId,
			tipo
		};
	}

	const convertedProformaIds = new Set(
		(conversionsResult.data || [])
			.map((invoice) => invoice.source_proforma_id)
			.filter((id): id is string => id !== null)
	);

	let invoices = (invoicesResult.data || []).filter((invoice) => {
		if (invoice.factura_tipo === 'proforma' && convertedProformaIds.has(invoice.id)) {
			return false;
		}
		if (clientId && invoice.client_id !== clientId) {
			return false;
		}
		return true;
	});

	let itemsByDescription: { description: string; quantity: number; amount: number }[] = [];
	let unitsSold = 0;
	let totalAmount = 0;
	if (invoices && invoices.length > 0) {
		const { data: items, error: itemsError } = await locals.supabase
			.from('invoice_items')
			.select('description, quantity, amount')
			.in(
				'invoice_id',
				invoices.map((invoice) => invoice.id)
			);
		if (itemsError) {
			console.error('Stats load error (items):', itemsError.message);
		} else {
			const quantities = new Map<string, number>();
			const amounts = new Map<string, number>();
			for (const item of items || []) {
				const description = (item.description || '').trim() || 'Sin descripción';
				quantities.set(description, (quantities.get(description) || 0) + Number(item.quantity));
				amounts.set(description, (amounts.get(description) || 0) + Number(item.amount || 0));
			}
			itemsByDescription = [...quantities.entries()]
				.map(([description, quantity]) => ({
					description,
					quantity,
					amount: amounts.get(description) || 0
				}))
				.sort((a, b) => b.quantity - a.quantity);
			unitsSold = itemsByDescription.reduce((sum, item) => sum + item.quantity, 0);
			totalAmount = itemsByDescription.reduce((sum, item) => sum + item.amount, 0);
		}
	}

	return {
		clients: clients || [],
		itemsByDescription,
		unitsSold,
		totalAmount,
		from,
		to,
		clientId,
		tipo
	};
};
