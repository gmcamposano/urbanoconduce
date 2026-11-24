import { fail } from '@sveltejs/kit';
import { parseTaxMode } from '$lib/proformaTotals';
import type { ProformaItemInput, ServiceFailure } from '$lib/server/proformaService';

export function readProformaForm(formData: FormData) {
	const str = (key: string) => String(formData.get(key) ?? '').trim();
	let items: ProformaItemInput[] | null;
	try {
		items = JSON.parse(String(formData.get('items') ?? '[]') || '[]');
	} catch {
		items = null;
	}
	return {
		invoiceNumber: str('invoice_number'),
		clientId: str('client_id'),
		clientName: str('client_name'),
		clientEmail: str('client_email'),
		invoiceDate: str('invoice_date'),
		dueDate: str('due_date'),
		status: str('status'),
		notes: str('notes'),
		taxMode: parseTaxMode(str('tax_mode') || 'none'),
		discountAmount: Number(formData.get('discount_amount') || 0),
		createMissingVariants: str('create_missing_variants') === 'true',
		items
	};
}

export function failFromService(result: ServiceFailure) {
	if (result.missingVariants) return fail(400, { missingVariants: result.missingVariants });
	return fail(result.status, { error: result.error });
}
