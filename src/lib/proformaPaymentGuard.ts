type ProformaFinancialFields = {
	clientId: string;
	invoiceDate: string;
	dueDate: string;
	status: string;
	totalAmount: number;
};

/** Prevent edits from silently invalidating existing payment allocations. */
export function changesAllocatedProforma(
	previous: ProformaFinancialFields,
	next: ProformaFinancialFields,
	hasAllocations: boolean
): boolean {
	if (!hasAllocations) return false;
	return (
		previous.clientId !== next.clientId ||
		previous.invoiceDate !== next.invoiceDate ||
		previous.dueDate !== next.dueDate ||
		previous.status !== next.status ||
		Math.round(previous.totalAmount * 100) !== Math.round(next.totalAmount * 100)
	);
}
