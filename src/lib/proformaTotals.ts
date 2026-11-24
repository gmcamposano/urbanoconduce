export type TaxMode = 'none' | 'included' | 'added';

export const TAX_RATE = 18;

export function parseTaxMode(raw: string | null | undefined): TaxMode {
	const value = (raw ?? '').trim();
	return value === 'included' || value === 'added' ? value : 'none';
}

/** Same formula the proforma forms always used: included tax is removed from line totals first. */
export function computeProformaTotals(lineTotal: number, taxMode: TaxMode, discountAmount: number) {
	const taxRate = taxMode === 'none' ? 0 : TAX_RATE;
	const subtotal = taxMode === 'included' ? lineTotal / (1 + TAX_RATE / 100) : lineTotal;
	const taxableBase = Math.max(0, subtotal - discountAmount);
	const taxAmount = taxMode === 'none' ? 0 : taxableBase * (taxRate / 100);
	const totalAmount = taxMode === 'none' ? taxableBase : taxableBase + taxAmount;
	return { taxRate, subtotal, taxableBase, taxAmount, totalAmount };
}
