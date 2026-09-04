export type CsvProductOption = {
	id: string;
	title: string;
	model: string | null;
};

export type CsvModelOption = { id: string; model: string };
export type CsvColorOption = { id: string; color: string };

export type CsvImportRow = {
	productId: string;
	productTitle: string;
	color: string;
	quantity: number;
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
	return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildSampleCsv(
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[],
	maxRows = 3
): string {
	const modelNameById = new Map(models.map((m) => [m.id, m.model]));
	const lines = [CSV_HEADERS.join(',')];
	const sorted = [...products].sort((a, b) =>
		a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
	);
	const sampleColors = colors.length > 0 ? colors.map((c) => c.color) : ['', ''];
	let added = 0;
	for (let i = 0; i < sorted.length && added < maxRows; i++) {
		const p = sorted[i];
		const modelName = p.model ? (modelNameById.get(p.model) ?? '') : '';
		const color = sampleColors[added % sampleColors.length] ?? '';
		lines.push(
			[csvEscape(p.title), csvEscape(modelName), csvEscape(color), csvEscape(added + 1)].join(',')
		);
		added++;
	}
	if (added === 0) {
		lines.push('Cover,Elite,rojo,2');
		lines.push('Cover,Pro,azul,5');
	}
	return '\uFEFF' + lines.join('\n') + '\n';
}

export function downloadSampleCsv(
	products: CsvProductOption[],
	models: CsvModelOption[],
	colors: CsvColorOption[]
): void {
	const csv = buildSampleCsv(products, models, colors);
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'proforma-plantilla.csv';
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
