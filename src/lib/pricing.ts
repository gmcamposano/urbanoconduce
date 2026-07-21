/**
 * Client-side 3-level price resolution (mirrors server-side resolveUnitPrices).
 * Most specific wins:
 *   1. client_product_prices (precio por cliente) — per-(client, product) exception
 *   2. price_list_entries      (entrada de tarifa) — per-(assigned list, product)
 *   3. products.price_without_taxes (precio de catálogo) — global default
 *
 * Entries can be absolute (unit_price) OR live % off catalog (discount_percentage).
 */

export type ClientPriceRow = { client_id: string; product_id: string; unit_price: number };
export type PriceListEntryRow = {
	price_list_id: string;
	product_id: string;
	unit_price: number | null;
	discount_percentage: number | null;
};
export type ClientAssignmentRow = {
	client_id: string;
	price_list_id: string;
	valid_from: string;
	valid_to: string | null;
};

function isVigente(assignment: ClientAssignmentRow, today: string): boolean {
	return (
		assignment.valid_from <= today && (assignment.valid_to === null || assignment.valid_to >= today)
	);
}

export function resolveEffectivePrice(params: {
	productId: string;
	catalogPrice: number;
	clientId: string | null;
	clientPrices: ClientPriceRow[];
	priceListEntries: PriceListEntryRow[];
	assignments: ClientAssignmentRow[];
}): number {
	const { productId, catalogPrice, clientId, clientPrices, priceListEntries, assignments } = params;
	if (clientId) {
		const override = clientPrices.find(
			(cp) => cp.client_id === clientId && cp.product_id === productId
		);
		if (override) return Number(override.unit_price);

		if (assignments.length > 0) {
			const today = new Date().toISOString().slice(0, 10);
			const vigente = assignments
				.filter((a) => a.client_id === clientId && isVigente(a, today))
				.sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
			if (vigente) {
				const entry = priceListEntries.find(
					(e) => e.price_list_id === vigente.price_list_id && e.product_id === productId
				);
				if (entry) {
					if (entry.unit_price !== null) return Number(entry.unit_price);
					if (entry.discount_percentage !== null) {
						return (
							Math.round(catalogPrice * (1 - Number(entry.discount_percentage) / 100) * 100) / 100
						);
					}
				}
			}
		}
	}
	return Number(catalogPrice);
}
