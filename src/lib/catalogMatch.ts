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

/** Words that tell two device models apart (iPhone 15 vs 15 Pro vs 15 Pro Max). */
const VARIANT_WORDS = new Set(['pro', 'max', 'plus', 'mini', 'ultra', 'fe', 'air', 'lite', 'edge']);

function isIdentifying(token: string) {
	return VARIANT_WORDS.has(token) || /\d/.test(token);
}

/**
 * Score by words instead of characters, for catalogs where the product title is the
 * line ("Elite colors") and the model is the device ("iphone 15 pro"), while the file
 * may say "cover iPhone 15 Pro" with "Elite" apart. Every model word must appear in
 * the line, and the line must not name another model number or variant word.
 */
function tokenScore(product: MatchProduct, productText: string, modelText?: string | null) {
	if (!product.modelName) return 0;
	const query = new Set(tokens([productText, modelText].filter(Boolean).join(' ')));
	const modelTokens = tokens(product.modelName);
	if (!modelTokens.length) return 0;
	const covered = modelTokens.filter((t) => query.has(t)).length / modelTokens.length;
	let modelScore = covered * 0.5;
	if (covered === 1) {
		const known = new Set([...modelTokens, ...tokens(product.title)]);
		const extra = [...query].some((t) => isIdentifying(t) && !known.has(t));
		modelScore = extra ? 0.6 : 1;
	}
	const titleTokens = tokens(product.title);
	const titleShare = titleTokens.length
		? titleTokens.filter((t) => query.has(t)).length / titleTokens.length
		: 0;
	const titleScore = Math.max(
		titleShare,
		similarity(productText, product.title),
		modelText ? similarity(modelText, product.title) : 0
	);
	return 0.6 * modelScore + 0.4 * titleScore;
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
			score = Math.max(score, tokenScore(product, productText, modelText));
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

/** Common names for catalog colors. Used only when the name itself is not in the catalog. */
const COLOR_SYNONYMS: Record<string, string[]> = {
	'azul marino': ['azul oscuro'],
	marino: ['azul oscuro'],
	navy: ['azul oscuro'],
	'azul navy': ['azul oscuro'],
	'azul cielo': ['azul claro'],
	celeste: ['azul claro'],
	black: ['negro'],
	white: ['blanco'],
	gray: ['gris'],
	grey: ['gris'],
	purple: ['morado'],
	pink: ['rosado'],
	rosa: ['rosado'],
	red: ['rojo'],
	green: ['verde'],
	transparent: ['transparente', 'clear'],
	dorado: ['gold'],
	plum: ['ciruela']
};

export function matchColor(
	colors: string[],
	colorText: string | null | undefined
): { color: string | null; exact: boolean; candidates: string[] } {
	const wanted = normalizeText(colorText);
	if (!wanted) return { color: null, exact: false, candidates: [] };
	const exact = colors.find((c) => normalizeText(c) === wanted);
	if (exact) return { color: exact, exact: true, candidates: [exact] };

	const inCatalog = (names: string[]) =>
		names
			.map((n) => colors.find((c) => normalizeText(c) === normalizeText(n)))
			.filter((c): c is string => !!c);
	const synonyms = [...new Set(inCatalog(COLOR_SYNONYMS[wanted] ?? []))];
	if (synonyms.length === 1) return { color: synonyms[0], exact: false, candidates: synonyms };

	// "Clear / Transparente": each part is a name; one catalog color is a match, several is a question.
	const raw = String(colorText ?? '');
	if (/[/|,]/.test(raw)) {
		const parts = raw
			.split(/[/|,]/)
			.map((p) => p.trim())
			.filter(Boolean);
		const found = [
			...new Set(parts.flatMap((p) => inCatalog([p, ...(COLOR_SYNONYMS[normalizeText(p)] ?? [])])))
		];
		if (found.length === 1) return { color: found[0], exact: false, candidates: found };
		if (found.length > 1) return { color: null, exact: false, candidates: found };
	}
	if (synonyms.length > 1) return { color: null, exact: false, candidates: synonyms };
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
