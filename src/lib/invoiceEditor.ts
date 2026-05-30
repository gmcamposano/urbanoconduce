export type InvoiceEditorData = {
	invoice: {
		id: string;
		invoice_number: string;
		client_name: string;
		client_email: string;
		invoice_date: string;
		due_date: string;
		status: 'draft' | 'pending' | 'paid' | 'overdue';
		notes: string | null;
		tax_rate: number | string;
		discount_amount: number | string;
	};
	items: Array<{
		id: string;
		description: string;
		product_id: string;
		color: string;
		model: string | null;
		quantity: number | string;
		unit_price: number | string;
	}>;
	products: Array<{
		id: string;
		title: string;
		price_without_taxes: number | string;
		model: string | null;
		client_id: string;
	}>;
	colors: Array<{
		id: string;
		color: string;
	}>;
	models: Array<{
		id: string;
		model: string;
	}>;
};

export type InvoiceEditorState = {
	invoiceNumber: string;
	selectedClientId: string;
	clientName: string;
	clientEmail: string;
	invoiceDate: string;
	dueDate: string;
	status: 'draft' | 'pending' | 'paid' | 'overdue';
	notes: string;
	includeTax: boolean;
	discountAmount: number;
	items: Array<{
		id: string;
		product_id: string;
		color: string;
		model: string | null;
		quantity: number;
		unit_price: number;
	}>;
};

export function buildInvoiceEditorState(data: InvoiceEditorData): InvoiceEditorState {
	const products = new Map(data.products.map((product) => [product.id, product]));

	const items = data.items.length
		? data.items.map((item) => {
			const product = products.get(item.product_id) || data.products.find((entry) => entry.title === item.description);

			return {
				id: item.id,
				product_id: product?.id ?? item.product_id ?? '',
				color: item.color || '',
				model: product?.model ?? null,
				quantity: Number(item.quantity),
				unit_price: Number(item.unit_price)
			};
		})
		: [
			{
				id: crypto.randomUUID(),
				product_id: '',
				color: '',
				model: null,
				quantity: 1,
				unit_price: 0
			}
		];

	const firstProductWithClient = data.items.length
		? data.products.find((p) => p.id === data.items[0].product_id || p.title === data.items[0].description)
		: null;

	return {
		invoiceNumber: data.invoice.invoice_number || '',
		selectedClientId: firstProductWithClient?.client_id || '',
		clientName: data.invoice.client_name || '',
		clientEmail: data.invoice.client_email || '',
		invoiceDate: data.invoice.invoice_date || '',
		dueDate: data.invoice.due_date || '',
		status: data.invoice.status,
		notes: data.invoice.notes || '',
		includeTax: Number(data.invoice.tax_rate || 0) > 0,
		discountAmount: Number(data.invoice.discount_amount || 0),
		items
	};
}
