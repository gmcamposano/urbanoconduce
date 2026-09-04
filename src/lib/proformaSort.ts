export type ProformaSortKey =
	| 'producto'
	| 'producto_color'
	| 'modelo'
	| 'cantidad'
	| 'precio'
	| 'reciente';
export type ProformaSortDir = 'asc' | 'desc';
export type ProformaSortState = { key: ProformaSortKey; dir: ProformaSortDir } | null;

export type SortableItem = {
	id: string;
	product_id: string;
	color: string;
	quantity: number;
	unit_price: number;
};

export type ProformaSortResolvers = {
	productTitle: (productId: string) => string;
	modelName: (productId: string) => string;
	colorRank: (color: string) => number;
	seqOf: (id: string) => number;
};

export function nextSortState(current: ProformaSortState, key: ProformaSortKey): ProformaSortState {
	if (current?.key === key) {
		return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
	}
	return { key, dir: key === 'reciente' ? 'desc' : 'asc' };
}

function compareText(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortProformaItems<T extends SortableItem>(
	items: T[],
	state: ProformaSortState,
	resolvers: ProformaSortResolvers
): T[] {
	if (!state) return items;
	// Filas vacías (plantilla nueva) siempre al final, fuera del orden.
	const filled = items.filter((i) => i.product_id);
	const empty = items.filter((i) => !i.product_id);
	const dir = state.dir === 'asc' ? 1 : -1;

	const cmp = (a: T, b: T): number => {
		switch (state.key) {
			case 'producto': {
				const t =
					compareText(resolvers.productTitle(a.product_id), resolvers.productTitle(b.product_id)) ||
					compareText(resolvers.modelName(a.product_id), resolvers.modelName(b.product_id));
				if (t !== 0) return t * dir;
				break;
			}
			case 'producto_color': {
				const productComparison = compareText(
					resolvers.productTitle(a.product_id),
					resolvers.productTitle(b.product_id)
				);
				if (productComparison !== 0) return productComparison * dir;

				const aColorRank = resolvers.colorRank(a.color);
				const bColorRank = resolvers.colorRank(b.color);
				const aColorKnown = Number.isFinite(aColorRank);
				const bColorKnown = Number.isFinite(bColorRank);
				if (aColorKnown !== bColorKnown) return aColorKnown ? -1 : 1;
				if (aColorKnown && bColorKnown && aColorRank !== bColorRank) {
					return (aColorRank - bColorRank) * dir;
				}

				const modelComparison = compareText(
					resolvers.modelName(a.product_id),
					resolvers.modelName(b.product_id)
				);
				if (modelComparison !== 0) return modelComparison * dir;
				break;
			}
			case 'modelo': {
				const t =
					compareText(resolvers.modelName(a.product_id), resolvers.modelName(b.product_id)) ||
					compareText(resolvers.productTitle(a.product_id), resolvers.productTitle(b.product_id));
				if (t !== 0) return t * dir;
				break;
			}
			case 'cantidad': {
				const t = (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
				if (t !== 0) return t * dir;
				break;
			}
			case 'precio': {
				const t = (Number(a.unit_price) || 0) - (Number(b.unit_price) || 0);
				if (t !== 0) return t * dir;
				break;
			}
			case 'reciente': {
				const t = resolvers.seqOf(a.id) - resolvers.seqOf(b.id);
				if (t !== 0) return t * dir;
				break;
			}
		}
		// Desempate estable: orden de llegada.
		return resolvers.seqOf(a.id) - resolvers.seqOf(b.id);
	};

	return [...filled.sort(cmp), ...empty];
}
