type ClientRecord = {
	id: string;
	client_type: string;
	full_name: string;
	alias?: string | null;
	company_name?: string | null;
};

type InvoiceRecord = {
	id: string;
	client_id: string;
	invoice_number: string;
	total_amount: number | string;
	status: string;
	due_date: string;
	invoice_date: string;
	factura_tipo?: string | null;
	created_at?: string;
	client_name?: string | null;
	client_email?: string | null;
	profiles?: { name?: string | null; email?: string | null } | null;
};

type InvoiceRelation = {
	id?: string;
	client_id?: string;
	invoice_number?: string | null;
	total_amount?: number | string | null;
	due_date?: string | null;
	invoice_date?: string | null;
	status?: string | null;
	factura_tipo?: string | null;
	client_name?: string | null;
	client_email?: string | null;
	profiles?: { name?: string | null; email?: string | null } | null;
};

type PaymentRecord = {
	id: string;
	client_id: string;
	amount: number | string;
	payment_date: string;
	payment_method: string;
	reference_number?: string | null;
	notes?: string | null;
	created_at: string;
	invoice_id?: string | null;
	invoices?: unknown;
	profiles?: { name?: string | null; email?: string | null } | null;
	clients?: ClientRecord | null;
};

type AllocationRecord = {
	id: string;
	payment_id: string;
	invoice_id: string;
	applied_amount: number | string;
	invoices?: unknown;
};

export type InvoiceBalanceRow = InvoiceRecord & {
	paidAmount: number;
	balanceDue: number;
	isFullyPaid: boolean;
};

export type PaymentAllocationRow = {
	id: string;
	invoice_id: string;
	applied_amount: number;
	invoice_number: string;
	invoice_total_amount: number;
	invoice_date: string;
	due_date: string;
	status?: string | null;
	factura_tipo?: string | null;
};

export type PaymentSummaryRow = PaymentRecord & {
	allocations: PaymentAllocationRow[];
	allocationCount: number;
	invoiceSummary: string;
	searchText: string;
};

export type ClientCreditRow = {
	clientId: string;
	name: string;
	creditBalance: number;
	invoiceCount: number;
	overdueBalance: number;
	totalBalance: number;
};

export function toAmount(value: number | string | null | undefined) {
	const amount = Number(value ?? 0);
	return Number.isFinite(amount) ? amount : 0;
}

export function getClientDisplay(client: ClientRecord | null | undefined) {
	if (!client) return 'Cliente desconocido';

	return client.client_type === 'company'
		? client.company_name || client.full_name
		: client.full_name;
}

function firstInvoiceRelation(invoice: unknown): InvoiceRelation | null {
	if (Array.isArray(invoice)) {
		return firstInvoiceRelation(invoice[0]);
	}

	if (invoice && typeof invoice === 'object') {
		return invoice as InvoiceRelation;
	}

	return null;
}

function groupAllocationsByInvoice(allocations: AllocationRecord[]) {
	const grouped = new Map<string, number>();

	for (const allocation of allocations) {
		grouped.set(
			allocation.invoice_id,
			(grouped.get(allocation.invoice_id) ?? 0) + toAmount(allocation.applied_amount)
		);
	}

	return grouped;
}

function groupAllocationsByPayment(allocations: AllocationRecord[]) {
	const grouped = new Map<string, AllocationRecord[]>();

	for (const allocation of allocations) {
		const current = grouped.get(allocation.payment_id) ?? [];
		current.push(allocation);
		grouped.set(allocation.payment_id, current);
	}

	return grouped;
}

export function buildInvoiceBalances(invoices: InvoiceRecord[], allocations: AllocationRecord[]) {
	const paidByInvoice = groupAllocationsByInvoice(allocations);

	return invoices.map<InvoiceBalanceRow>((invoice) => {
		const paidAmount = paidByInvoice.get(invoice.id) ?? 0;
		const balanceDue = Math.max(toAmount(invoice.total_amount) - paidAmount, 0);

		return {
			...invoice,
			paidAmount,
			balanceDue,
			isFullyPaid: balanceDue <= 0
		};
	});
}

export function buildPaymentSummaries(payments: PaymentRecord[], allocations: AllocationRecord[]) {
	const allocationsByPayment = groupAllocationsByPayment(allocations);

	return payments.map<PaymentSummaryRow>((payment) => {
		const rawAllocations = allocationsByPayment.get(payment.id) ?? [];
		const normalizedAllocations = rawAllocations.length
			? rawAllocations
			: payment.invoice_id
				? [
						{
							id: payment.id,
							payment_id: payment.id,
							invoice_id: payment.invoice_id,
							applied_amount: payment.amount,
							invoices: firstInvoiceRelation(payment.invoices)
						}
					]
				: [];

		const allocations = normalizedAllocations.map<PaymentAllocationRow>((allocation) => {
			const invoice = firstInvoiceRelation(allocation.invoices);

			return {
				id: allocation.id,
				invoice_id: allocation.invoice_id,
				applied_amount: toAmount(allocation.applied_amount),
				invoice_number: invoice?.invoice_number || allocation.invoice_id,
				invoice_total_amount: toAmount(invoice?.total_amount),
				invoice_date: invoice?.invoice_date || '',
				due_date: invoice?.due_date || '',
				status: invoice?.status || null,
				factura_tipo: invoice?.factura_tipo || null
			};
		});

		const invoiceNumbers = allocations.map((allocation) => allocation.invoice_number);
		const firstInvoice = invoiceNumbers[0] || null;
		const invoiceSummary =
			invoiceNumbers.length === 0
				? 'Sin factura'
				: invoiceNumbers.length === 1
					? invoiceNumbers[0]
					: `${firstInvoice} +${invoiceNumbers.length - 1}`;
		const searchText = [
			payment.reference_number,
			payment.notes,
			payment.clients ? getClientDisplay(payment.clients) : '',
			...invoiceNumbers,
			payment.amount.toString()
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return {
			...payment,
			allocations,
			allocationCount: allocations.length,
			invoiceSummary,
			searchText
		};
	});
}

export function buildClientCreditSummary(invoices: InvoiceBalanceRow[], clients: ClientRecord[]) {
	const clientsById = new Map(clients.map((client) => [client.id, client]));
	const grouped = new Map<string, ClientCreditRow>();

	for (const invoice of invoices) {
		if (invoice.balanceDue <= 0) continue;

		const client = clientsById.get(invoice.client_id);
		const current = grouped.get(invoice.client_id) ?? {
			clientId: invoice.client_id,
			name: getClientDisplay(client),
			creditBalance: 0,
			invoiceCount: 0,
			overdueBalance: 0,
			totalBalance: 0
		};

		if (invoice.status === 'pending' || invoice.status === 'overdue') {
			current.totalBalance += invoice.balanceDue;
		}

		if (invoice.factura_tipo === 'proforma') {
			if (invoice.status === 'pending' || invoice.status === 'overdue') {
				current.creditBalance += invoice.balanceDue;
				current.invoiceCount += 1;
			}
			if (invoice.status === 'overdue') {
				current.overdueBalance += invoice.balanceDue;
			}
		}

		grouped.set(invoice.client_id, current);
	}

	return [...grouped.values()].sort((a, b) => b.totalBalance - a.totalBalance);
}
