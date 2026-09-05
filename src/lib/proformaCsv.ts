import { sortProformaItems } from './proformaSort.ts';

export type CsvProductOption = {
	id: string;
	title: string;
	model: string | null;
};

export type CsvModelOption = { id: string; model: string };

export type CsvColorOption = { id: string; color: string; sort_order?: number };

export type CsvImportRow = {
	productId: string;
	productTitle: string;
	color: string;
	quantity: number;
};

export type CsvCurrentRow = {
	product_id: string;
	color: string;
	quantity: number | string;
};

export type CsvRowError = {
	line: number;
	reason: string;
	raw: string;
};

export type CsvParseResult = {
	rows: CsvImportRow[];
	errors: CsvRowError[];
};

export const CSV_HEADERS = ['producto', 'modelo', 'color', 'cantidad'] as const;

function norm(s: string | null | undefined): string {
	return (s ?? '').trim().toLowerCase();
}

function splitLine(line: string, delimiter: string): string[] {
	// Minimal CSV split supporting quoted fields with "" escapes.
	const out: string[] = [];
	let cur = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === delimiter && !inQuotes) {
			out.push(cur);
			cur = '';
		} else {
			cur += ch;
		}
	}
	out.push(cur);
	return out.map((v) => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
}

const HEADER_ALIASES: Record<string, 'producto' | 'modelo' | 'color' | 'cantidad'> = {
	producto: 'producto',
	product: 'producto',
	titulo: 'producto',
	title: 'producto',
	nombre: 'producto',
	modelo: 'modelo',
	model: 'modelo',
	color: 'color',
	colour: 'color',
	cantidad: 'cantidad',
	quantity: 'cantidad',
	qty: 'cantidad',
	cant: 'cantidad'
};

export function parseProformaCsv(
	text: string,
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[],
	existingPairs?: Set<string>
): CsvParseResult {
	const rows: CsvImportRow[] = [];
	const errors: CsvRowError[] = [];

	const cleaned = text
		.replace(/^\uFEFF/, '')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');
	const lines = cleaned
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length === 0) {
		return { rows, errors: [{ line: 0, reason: 'Archivo vacío.', raw: '' }] };
	}

	const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
	const headerCells = splitLine(lines[0], delimiter).map((h) => norm(h));
	const colIndex: Record<string, number> = {};
	headerCells.forEach((h, i) => {
		const key = HEADER_ALIASES[h];
		if (key && colIndex[key] === undefined) colIndex[key] = i;
	});

	const missing = CSV_HEADERS.filter((h) => colIndex[h] === undefined);
	if (missing.length > 0) {
		return {
			rows,
			errors: [
				{
					line: 1,
					reason: `Cabecera inválida. Faltan columnas: ${missing.join(', ')}. Usa: ${CSV_HEADERS.join(', ')}.`,
					raw: lines[0]
				}
			]
		};
	}

	const productsByTitle = new Map<string, CsvProductOption[]>();
	for (const p of products) {
		const key = norm(p.title);
		const arr = productsByTitle.get(key) ?? [];
		arr.push(p);
		productsByTitle.set(key, arr);
	}

	const modelIdByName = new Map(models.map((m) => [norm(m.model), m.id]));
	const modelNameById = new Map(models.map((m) => [m.id, m.model]));
	const colorSet = new Set(colors.map((c) => norm(c.color)));
	const colorCanonical = new Map(colors.map((c) => [norm(c.color), c.color]));

	const seenInFile = new Map<string, CsvImportRow>();

	for (let li = 1; li < lines.length; li++) {
		const lineNo = li + 1;
		const cells = splitLine(lines[li], delimiter);
		const get = (key: 'producto' | 'modelo' | 'color' | 'cantidad') =>
			(cells[colIndex[key]] ?? '').trim();
		const rawProducto = get('producto');
		const rawModelo = get('modelo');
		const rawColor = get('color');
		const rawCantidad = get('cantidad');

		const fail = (reason: string) => errors.push({ line: lineNo, reason, raw: lines[li] });

		if (!rawProducto) {
			fail('Producto vacío.');
			continue;
		}

		const candidates = productsByTitle.get(norm(rawProducto)) ?? [];
		if (candidates.length === 0) {
			fail(`Producto "${rawProducto}" no existe.`);
			continue;
		}

		let product: CsvProductOption | undefined;
		if (rawModelo) {
			const modelId = modelIdByName.get(norm(rawModelo));
			if (!modelId) {
				fail(`Modelo "${rawModelo}" no existe.`);
				continue;
			}
			product = candidates.find((p) => p.model === modelId);
			if (!product) {
				const available = candidates
					.map((p) => (p.model ? (modelNameById.get(p.model) ?? '') : '(sin modelo)'))
					.filter(Boolean)
					.join(', ');
				fail(
					`"${rawProducto}" no tiene modelo "${rawModelo}". Modelos: ${available || '(sin modelo)'}.`
				);
				continue;
			}
		} else {
			if (candidates.length > 1) {
				const available = candidates
					.map((p) => (p.model ? (modelNameById.get(p.model) ?? '') : '(sin modelo)'))
					.filter(Boolean)
					.join(', ');
				fail(`"${rawProducto}" tiene varios modelos. Especifica modelo: ${available}.`);
				continue;
			}
			product = candidates[0];
		}

		let color = '';
		if (rawColor) {
			const key = norm(rawColor);
			if (!colorSet.has(key)) {
				fail(`Color "${rawColor}" no existe.`);
				continue;
			}
			color = colorCanonical.get(key) ?? rawColor.trim().toLowerCase();
		}

		const quantity = Number(String(rawCantidad).replace(',', '.'));
		if (!rawCantidad || !Number.isFinite(quantity) || quantity <= 0) {
			fail(`Cantidad "${rawCantidad || 'vacía'}" inválida. Usa número mayor que 0.`);
			continue;
		}

		const pairKey = `${product.id}|${color}`;
		if (existingPairs?.has(pairKey)) {
			fail(`"${rawProducto} · ${color || 'sin color'}" ya está en la proforma. Omitida.`);
			continue;
		}

		const prev = seenInFile.get(pairKey);
		if (prev) {
			prev.quantity += quantity;
		} else {
			seenInFile.set(pairKey, {
				productId: product.id,
				productTitle: product.title,
				color,
				quantity
			});
		}
	}

	return { rows: [...seenInFile.values()], errors };
}

function csvEscape(v: string | number): string {
	const s = String(v);
	return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCurrentRowsCsv(
	rows: CsvCurrentRow[],
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[]
): string {
	const productsById = new Map(products.map((product) => [product.id, product]));
	const modelNameById = new Map(models.map((model) => [model.id, model.model]));
	const lines = [CSV_HEADERS.join(',')];
	const sortableRows = rows.flatMap((row, index) => {
		if (!row.product_id || !productsById.has(row.product_id)) return [];
		return [
			{
				id: String(index),
				product_id: row.product_id,
				color: row.color,
				quantity: Number(row.quantity) || 0,
				unit_price: 0,
				source: row
			}
		];
	});
	const sortedRows = sortProformaItems(
		sortableRows,
		{ key: 'producto_color', dir: 'asc' },
		{
			productTitle: (productId) => productsById.get(productId)?.title ?? '',
			modelName: (productId) => {
				const modelId = productsById.get(productId)?.model;
				return modelId ? (modelNameById.get(modelId) ?? '') : '';
			},
			colorRank: (color) => {
				const normalizedColor = color.trim().toLocaleLowerCase();
				if (!normalizedColor) return Number.POSITIVE_INFINITY;
				const matchedColor = colors.find(
					(entry) => entry.color.trim().toLocaleLowerCase() === normalizedColor
				);
				const rank = Number(matchedColor?.sort_order);
				return Number.isFinite(rank) ? rank : Number.POSITIVE_INFINITY;
			},
			seqOf: (id) => Number(id)
		}
	);

	for (const sortableRow of sortedRows) {
		const row = sortableRow.source;
		const product = productsById.get(row.product_id);
		if (!product) continue;

		const modelName = product.model ? (modelNameById.get(product.model) ?? '') : '';
		lines.push(
			[
				csvEscape(product.title),
				csvEscape(modelName),
				csvEscape(row.color),
				csvEscape(row.quantity)
			].join(',')
		);
	}

	return '\uFEFF' + lines.join('\n') + '\n';
}

export function buildCurrentRowsFilename(proformaNumber: string): string {
	const withoutControls = [...proformaNumber.trim()]
		.filter((character) => {
			const code = character.charCodeAt(0);
			return code >= 32 && code !== 127;
		})
		.join('');
	const safeNumber = withoutControls
		.replace(/[<>:"/\\|?*]+/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^\.+|[.-]+$/g, '')
		.slice(0, 80)
		.replace(/[.-]+$/g, '');

	return `proforma-${safeNumber || 'sin-numero'}.csv`;
}

function downloadCsv(csv: string, filename: string): void {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCurrentRowsCsv(
	rows: CsvCurrentRow[],
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[],
	proformaNumber: string
): void {
	downloadCsv(
		buildCurrentRowsCsv(rows, products, models, colors),
		buildCurrentRowsFilename(proformaNumber)
	);
}

export function buildSampleCsv(
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[],
	maxRows?: number
): string {
	const modelNameById = new Map(models.map((m) => [m.id, m.model]));
	const lines = [CSV_HEADERS.join(',')];
	const sorted = [...products].sort((a, b) =>
		a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
	);
	if (sorted.length === 0) {
		// Sin productos no inventar nombres: solo cabecera -> evita errores de validación.
		return '\uFEFF' + lines.join('\n') + '\n';
	}
	const colorNames = colors.map((c) => c.color);
	const limit = maxRows ?? sorted.length;
	// Una fila ejemplo por cada producto con nombres exactos del catálogo.
	// Usuario copia/edita cantidades -> cero errores por typos.
	sorted.slice(0, limit).forEach((p) => {
		const modelName = p.model ? (modelNameById.get(p.model) ?? '') : '';
		const idx = lines.length - 1;
		const color = colorNames.length > 0 ? (colorNames[idx % colorNames.length] ?? '') : '';
		lines.push(
			[csvEscape(p.title), csvEscape(modelName), csvEscape(color), csvEscape(1)].join(',')
		);
	});
	// Si hay más colores que productos, añadir filas extra con primer producto
	// para que cada color aparezca al menos una vez como ejemplo copiable.
	if (colorNames.length > lines.length - 1 && sorted.length > 0) {
		const first = sorted[0];
		const firstModel = first.model ? (modelNameById.get(first.model) ?? '') : '';
		for (let i = lines.length - 1; i < colorNames.length; i++) {
			lines.push(
				[
					csvEscape(first.title),
					csvEscape(firstModel),
					csvEscape(colorNames[i]),
					csvEscape(1)
				].join(',')
			);
		}
	}
	return '\uFEFF' + lines.join('\n') + '\n';
}

export function downloadSampleCsv(
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[]
): void {
	downloadCsv(buildSampleCsv(products, models, colors), 'proforma-plantilla.csv');
}
