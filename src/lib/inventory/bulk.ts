export interface BulkInventoryItem {
	variant_id: string;
	product_title: string;
	model_name: string | null;
	color: string;
}

export interface BulkParsedRow {
	product: string;
	model: string;
	color: string;
	quantity: number | null;
	newCost: number | null;
	rowIndex: number;
}

const TEMPLATE_HEADERS = ['Producto', 'Modelo', 'Color', 'Cantidad', 'Nuevo costo (opcional)'];

async function loadXlsx() {
	return import('xlsx');
}

export async function generateStockEntryTemplate(items: BulkInventoryItem[]): Promise<Blob> {
	const XLSX = await loadXlsx();
	const rows = items.map((item) => [
		capitalize(item.product_title),
		item.model_name ? capitalize(item.model_name) : '',
		item.color ? capitalize(item.color) : '',
		'',
		''
	]);
	const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, 'Entrada');
	const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
	return new Blob([new Uint8Array(data)], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
}

export async function generateStockEntryTemplateCSV(items: BulkInventoryItem[]): Promise<Blob> {
	const XLSX = await loadXlsx();
	const rows = items.map((item) => [
		capitalize(item.product_title),
		item.model_name ? capitalize(item.model_name) : '',
		item.color ? capitalize(item.color) : '',
		'',
		''
	]);
	const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
	const csv = XLSX.utils.sheet_to_csv(sheet);
	return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export async function parseStockEntryFile(file: File): Promise<BulkParsedRow[]> {
	const XLSX = await loadXlsx();
	const data = await file.arrayBuffer();
	const workbook = XLSX.read(data, { type: 'array' });
	const sheetName = workbook.SheetNames[0];
	const sheet = workbook.Sheets[sheetName];
	const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];

	if (raw.length === 0) return [];

	const header = raw[0].map((h) => normalizeHeader(String(h ?? '')));
	const indexes = {
		product: findHeaderIndex(header, 'product'),
		model: findHeaderIndex(header, 'model'),
		color: findHeaderIndex(header, 'color'),
		quantity: findHeaderIndex(header, 'quantity'),
		newCost: findHeaderIndex(header, 'newCost')
	};

	const rows: BulkParsedRow[] = [];
	for (let i = 1; i < raw.length; i++) {
		const row = raw[i];
		if (row.every((cell) => cell === undefined || cell === null || String(cell).trim() === ''))
			continue;

		rows.push({
			product: readString(row, indexes.product),
			model: readString(row, indexes.model),
			color: readString(row, indexes.color),
			quantity: readNumber(row, indexes.quantity),
			newCost: readNumber(row, indexes.newCost),
			rowIndex: i + 1
		});
	}
	return rows;
}

function normalizeHeader(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/_/g, ' ')
		.replace(/-/g, ' ')
		.replace(/\(opcional\)/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function findHeaderIndex(
	headers: string[],
	key: 'product' | 'model' | 'color' | 'quantity' | 'newCost'
): number {
	const synonyms: Record<typeof key, string[]> = {
		product: ['producto', 'product', 'titulo', 'titulo', 'nombre', 'name'],
		model: ['modelo', 'model'],
		color: ['color'],
		quantity: ['cantidad', 'qty', 'quantity', 'unidades', 'units'],
		newCost: ['nuevo costo', 'costo', 'costo nuevo', 'precio compra', 'purchase price', 'cost']
	};
	return headers.findIndex((h) => synonyms[key].includes(h));
}

function readString(row: unknown[], index: number): string {
	if (index < 0) return '';
	const value = row[index];
	if (value === undefined || value === null) return '';
	return String(value).trim();
}

function readNumber(row: unknown[], index: number): number | null {
	if (index < 0) return null;
	const value = row[index];
	if (value === undefined || value === null || value === '') return null;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function capitalize(str: string): string {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
