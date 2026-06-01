export type DocumentFamily = 'proforma' | 'invoice';

export type FacturaTipo = 'proforma' | 'valor_fiscal' | 'ninguna';

export const PROFORMA_ROUTE_BASE = '/dashboard/proforma';
export const INVOICE_ROUTE_BASE = '/dashboard/invoices';

export function getRouteBase(family: DocumentFamily) {
	return family === 'proforma' ? PROFORMA_ROUTE_BASE : INVOICE_ROUTE_BASE;
}

export function getListPath(family: DocumentFamily) {
	return getRouteBase(family);
}

export function getNewPath(family: DocumentFamily) {
	return `${getRouteBase(family)}/new`;
}

export function getDetailPath(family: DocumentFamily, id: string) {
	return `${getRouteBase(family)}/${id}`;
}

export function getEditPath(family: DocumentFamily, id: string) {
	return `${getRouteBase(family)}/${id}/edit`;
}

export function getFamilyFromFacturaTipo(facturaTipo: string | null | undefined): DocumentFamily {
	return facturaTipo === 'proforma' ? 'proforma' : 'invoice';
}

export function getFamilyFromInvoiceStatus(status: string | null | undefined): DocumentFamily {
	return status === 'paid' ? 'invoice' : 'proforma';
}

export function getAllowedFacturaTipos(family: DocumentFamily) {
	return family === 'proforma' ? (['proforma'] as const) : (['valor_fiscal', 'ninguna'] as const);
}

export function normalizeFacturaTipoForFamily(family: DocumentFamily, facturaTipo: string) {
	if (family === 'proforma') return 'proforma';
	if (facturaTipo === 'valor_fiscal' || facturaTipo === 'ninguna') return facturaTipo;
	return 'ninguna';
}

export function shouldMoveProformaToInvoices(facturaTipo: string | null | undefined, status: string) {
	return facturaTipo === 'proforma' && status === 'paid';
}
