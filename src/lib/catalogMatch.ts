/**
 * Fuzzy matching of free-form order lines (from a CSV or Excel the client sent)
 * against the product catalog. Pure: callers pass catalog data in.
 */

export type MatchProduct = { id: string; title: string; modelName: string | null };

export type MatchConfidence = 'exacto' | 'probable' | 'ambiguo' | 'sin_coincidencia';

export type ProductCandidate = { productId: string; label: string; score: number };

export function normalizeText(value: string | null | undefined): string {
	return (value ?? '')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

function tokens(value: string): string[] {
	return normalizeText(value).split(' ').filter(Boolean);
}

function bigrams(value: string): string[] {
	const s = normalizeText(value).replace(/ /g, '');
	const out: string[] = [];
	for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
	return out;
}

/** Dice coefficient over character bigrams: tolerant to typos and missing spaces. */
export function similarity(a: string, b: string): number {
	const na = normalizeText(a);
	const nb = normalizeText(b);
	if (!na || !nb) return 0;
	if (na === nb) return 1;
	const ba = bigrams(na);
	const bb = bigrams(nb);
	if (ba.length === 0 || bb.length === 0) return 0;
	const counts = new Map<string, number>();
	for (const g of ba) counts.set(g, (counts.get(g) ?? 0) + 1);
	let hits = 0;
	for (const g of bb) {
		const c = counts.get(g) ?? 0;
		if (c > 0) {
			hits++;
			counts.set(g, c - 1);
		}
	}
	const dice = (2 * hits) / (ba.length + bb.length);
	// Reward lines whose every word appears in the candidate (e.g. "gorra" vs "gorra plana").
	const ta = tokens(na);
	const tb = new Set(tokens(nb));
	const contained = ta.length > 0 && ta.every((t) => tb.has(t));
	return contained ? Math.max(dice, 0.85) : dice;
}

export function productLabel(product: MatchProduct): string {
	return product.modelName ? `${product.title} - ${product.modelName}` : product.title;
}

export function matchProduct(
	products: MatchProduct[],
	productText: string,
	modelText?: string | null
): { confidence: MatchConfidence; productId: string | null; candidates: ProductCandidate[] } {
	const query = [productText, modelText].filter(Boolean).join(' ');
	const normalizedQuery = normalizeText(query);
	if (!normalizedQuery) return { confidence: 'sin_coincidencia', productId: null, candidates: [] };

	const scored = products
		.map((product) => {
			const full = productLabel(product);
			const titleScore = similarity(productText, product.title);
			const fullScore = similarity(query, full);
			let score = Math.max(fullScore, modelText ? 0 : titleScore);
			// When a model is given, it must agree with the product's model.
			if (modelText && product.modelName) {
				const modelScore = similarity(modelText, product.modelName);
				score = modelScore >= 0.8 ? Math.max(score, (titleScore + modelScore) / 2) : score * 0.6;
			} else if (modelText && !product.modelName) {
				score *= 0.7;
			}
			return { productId: product.id, label: full, score: Math.round(score * 1000) / 1000 };
		})
		.filter((c) => c.score >= 0.35)
		.sort((a, b) => b.score - a.score);

	const candidates = scored.slice(0, 5);
	const [best, second] = candidates;
	if (!best) return { confidence: 'sin_coincidencia', productId: null, candidates: [] };

	const exact = products.find(
		(p) =>
			normalizeText(productLabel(p)) === normalizedQuery ||
			(!modelText && normalizeText(p.title) === normalizedQuery && !p.modelName)
	);
	if (exact) return { confidence: 'exacto', productId: exact.id, candidates };

	const margin = best.score - (second?.score ?? 0);
	if (best.score >= 0.8 && margin >= 0.1) {
		return { confidence: 'probable', productId: best.productId, candidates };
	}
	return { confidence: 'ambiguo', productId: null, candidates };
}

export function matchColor(
	colors: string[],
	colorText: string | null | undefined
): { color: string | null; exact: boolean; candidates: string[] } {
	const wanted = normalizeText(colorText);
	if (!wanted) return { color: null, exact: false, candidates: [] };
	const exact = colors.find((c) => normalizeText(c) === wanted);
	if (exact) return { color: exact, exact: true, candidates: [exact] };
	const ranked = colors
		.map((c) => ({ c, s: similarity(wanted, c) }))
		.filter((x) => x.s >= 0.5)
		.sort((a, b) => b.s - a.s);
	const [best, second] = ranked;
	const clear = best && best.s >= 0.8 && best.s - (second?.s ?? 0) >= 0.1;
	return {
		color: clear ? best.c : null,
		exact: false,
		candidates: ranked.slice(0, 5).map((x) => x.c)
	};
}
