// Orden de presentación del desglose: modelos en alfabético;
// dentro de cada modelo, elite > ahumado > mate > fibra.

export function descriptionRank(description: string | null | undefined): number {
	const normalized = (description ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
	if (normalized.includes('elite')) return 0;
	if (normalized.includes('ahumado')) return 1;
	if (normalized.includes('mate')) return 2;
	if (normalized.includes('fibra')) return 3;
	return 4;
}

export type DisplayItem = {
	description: string | null | undefined;
	model: string | null;
	color?: string | null | undefined;
};

export function compareDisplayItems<T extends DisplayItem>(
	a: T,
	b: T,
	getModelName: (modelId: string | null) => string
): number {
	const modelA = getModelName(a.model ?? null).toLowerCase();
	const modelB = getModelName(b.model ?? null).toLowerCase();
	if (modelA === '-') {
		if (modelB !== '-') return 1;
	} else if (modelB === '-') {
		return -1;
	} else {
		const byModel = modelA.localeCompare(modelB);
		if (byModel !== 0) return byModel;
	}
	const byRank = descriptionRank(a.description) - descriptionRank(b.description);
	if (byRank !== 0) return byRank;
	const byDescription = (a.description ?? '').localeCompare(b.description ?? '', 'es', {
		sensitivity: 'base'
	});
	if (byDescription !== 0) return byDescription;
	return (a.color ?? '').localeCompare(b.color ?? '', 'es', { sensitivity: 'base' });
}

export function sortInvoiceDisplayItems<T extends DisplayItem>(
	items: T[],
	getModelName: (modelId: string | null) => string
): T[] {
	return [...items].sort((a, b) => compareDisplayItems(a, b, getModelName));
}
