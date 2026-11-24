import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { matchColor, matchProduct, normalizeText, similarity } from '$lib/catalogMatch';
import { isOverdueBalance } from '$lib/overdue';
import { computeProformaTotals, parseTaxMode, type TaxMode } from '$lib/proformaTotals';
import { buildInvoiceBalances, getClientDisplay, toAmount } from '$lib/server/accounting';
import { getProductVariantKey } from '$lib/server/inventory';
import { clonePaidProformaToInvoice } from '$lib/server/proformaToInvoice';
import {
	createProforma,
	updateProforma,
	type ProformaItemInput,
	type ServiceFailure
} from '$lib/server/proformaService';
import type { McpContext, McpRole } from './auth';

type Db = McpContext['supabase'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS = ['cash', 'transfer', 'check', 'card', 'other'] as const;

function today() {
	return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function round2(n: number) {
	return Math.round(n * 100) / 100;
}

function ok(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] };
}

function fail(message: string, extra?: Record<string, unknown>) {
	return {
		isError: true,
		content: [
			{ type: 'text' as const, text: JSON.stringify({ error: message, ...extra }, null, 1) }
		]
	};
}

function serviceFail(result: ServiceFailure) {
	if (result.missingVariants) {
		return fail(
			'Faltan variantes de inventario (producto + color). Repite con crear_variantes_faltantes: true si el usuario está de acuerdo.',
			{ variantes_faltantes: result.missingVariants }
		);
	}
	return fail(result.error);
}

const WRITE_ROLES: McpRole[] = ['admin', 'editor'];

function denied(ctx: McpContext, roles: McpRole[]) {
	if (ctx.role && roles.includes(ctx.role)) return null;
	return fail(
		'Tu rol (' +
			(ctx.role ?? 'sin rol') +
			') no puede hacer esto. Requiere: ' +
			roles.join(' o ') +
			'.'
	);
}

type ClientRow = {
	id: string;
	client_type: string;
	full_name: string;
	company_name: string | null;
	alias: string | null;
	email: string | null;
	rnc: string | null;
};

const CLIENT_COLUMNS = 'id, client_type, full_name, company_name, alias, email, rnc';

function clientName(client: ClientRow) {
	return getClientDisplay(client as Parameters<typeof getClientDisplay>[0]) ?? client.full_name;
}

function clientSummary(client: ClientRow) {
	return {
		id: client.id,
		nombre: clientName(client),
		alias: client.alias,
		tipo: client.client_type,
		email: client.email,
		rnc: client.rnc
	};
}

async function loadClients(db: Db) {
	const { data, error } = await db.from('clients').select(CLIENT_COLUMNS);
	if (error) throw new Error(error.message);
	return (data || []) as ClientRow[];
}

function rankClients(clients: ClientRow[], text: string) {
	const q = normalizeText(text);
	return clients
		.map((c) => {
			const names = [clientName(c), c.full_name, c.company_name, c.alias, c.rnc].filter(
				Boolean
			) as string[];
			const score = Math.max(
				0,
				...names.map((n) => (normalizeText(n) === q ? 1 : similarity(q, n)))
			);
			return { c, score };
		})
		.filter((x) => x.score >= 0.4)
		.sort((a, b) => b.score - a.score);
}

async function resolveClient(db: Db, text: string) {
	const ref = text.trim();
	if (UUID.test(ref)) {
		const { data } = await db.from('clients').select(CLIENT_COLUMNS).eq('id', ref).maybeSingle();
		return { client: (data as ClientRow | null) ?? null, candidates: [] };
	}
	const ranked = rankClients(await loadClients(db), ref);
	const [best, second] = ranked;
	const clear =
		!!best && (best.score === 1 || (best.score >= 0.8 && best.score - (second?.score ?? 0) >= 0.1));
	return {
		client: clear ? best.c : null,
		candidates: ranked.slice(0, 5).map((x) => ({ ...clientSummary(x.c), score: round2(x.score) }))
	};
}

async function loadCatalog(db: Db) {
	const [products, models, colors, variants] = await Promise.all([
		db.from('products').select('id, title, model, price_without_taxes').order('title'),
		db.from('product_models').select('id, model'),
		db.from('product_colors').select('color, sort_order').order('sort_order'),
		db.from('product_variants').select('id, product_id, color, sku, min_stock')
	]);
	for (const r of [products, models, colors, variants])
		if (r.error) throw new Error(r.error.message);
	const modelNames = new Map((models.data || []).map((m) => [m.id, m.model]));
	return {
		products: (products.data || []).map((p) => ({
			id: p.id,
			title: p.title,
			modelId: p.model,
			modelName: p.model ? (modelNames.get(p.model) ?? null) : null,
			price: Number(p.price_without_taxes)
		})),
		modelNames,
		colors: (colors.data || []).map((c) => c.color),
		variants: variants.data || []
	};
}

async function stockByVariant(db: Db, variantIds: string[]) {
	const stock = new Map<string, number>();
	for (let i = 0; i < variantIds.length; i += 200) {
		const { data, error } = await db
			.from('inventory_movements')
			.select('product_variant_id, quantity')
			.in('product_variant_id', variantIds.slice(i, i + 200));
		if (error) throw new Error(error.message);
		for (const m of data || []) {
			stock.set(m.product_variant_id, (stock.get(m.product_variant_id) ?? 0) + m.quantity);
		}
	}
	return stock;
}

async function clientPrices(db: Db, clientId: string | null | undefined) {
	const prices = new Map<string, number>();
	if (!clientId) return prices;
	const { data, error } = await db
		.from('client_product_prices')
		.select('product_id, unit_price')
		.eq('client_id', clientId);
	if (error) throw new Error(error.message);
	for (const row of data || []) prices.set(row.product_id, Number(row.unit_price));
	return prices;
}

async function convertedProformaIds(db: Db) {
	const { data, error } = await db
		.from('invoices')
		.select('source_proforma_id')
		.not('source_proforma_id', 'is', null);
	if (error) throw new Error(error.message);
	return new Set((data || []).map((r) => r.source_proforma_id as string));
}

async function findDocument(db: Db, ref: string) {
	const value = ref.trim();
	const query = db.from('invoices').select('*');
	const { data, error } = await (
		UUID.test(value) ? query.eq('id', value) : query.eq('invoice_number', value)
	).maybeSingle();
	if (error) throw new Error(error.message);
	return data;
}

async function documentDetail(db: Db, ref: string) {
	const invoice = await findDocument(db, ref);
	if (!invoice) return null;
	const [items, allocations, models, converted] = await Promise.all([
		db.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('created_at'),
		db
			.from('accounting_allocations')
			.select('applied_amount, payment:payment_id(payment_date, payment_method, reference_number)')
			.eq('invoice_id', invoice.id),
		db.from('product_models').select('id, model'),
		db
			.from('invoices')
			.select('id, invoice_number')
			.eq('source_proforma_id', invoice.id)
			.maybeSingle()
	]);
	if (items.error) throw new Error(items.error.message);
	if (allocations.error) throw new Error(allocations.error.message);
	const modelNames = new Map((models.data || []).map((m) => [m.id, m.model]));
	const paid = (allocations.data || []).reduce((s, a) => s + toAmount(a.applied_amount), 0);
	const total = toAmount(invoice.total_amount);
	const rows = items.data || [];
	return {
		invoice,
		rows,
		view: {
			id: invoice.id,
			numero: invoice.invoice_number,
			tipo: invoice.factura_tipo,
			cliente_id: invoice.client_id,
			cliente: invoice.client_name,
			fecha: invoice.invoice_date,
			vencimiento: invoice.due_date,
			estado: invoice.status,
			notas: invoice.notes,
			impuesto_pct: Number(invoice.tax_rate),
			descuento: Number(invoice.discount_amount),
			total: round2(total),
			pagado: round2(paid),
			saldo: round2(Math.max(total - paid, 0)),
			vencida: isOverdueBalance(invoice.due_date, total - paid),
			factura_generada: converted.data ?? null,
			lineas: rows.map((it, i) => ({
				linea: i + 1,
				product_id: it.product_id,
				descripcion: it.description,
				modelo: it.model ? (modelNames.get(it.model) ?? it.model) : null,
				color: it.color,
				cantidad: Number(it.quantity),
				precio: Number(it.unit_price),
				monto: Number(it.amount)
			})),
			pagos: (allocations.data || []).map((a) => ({
				aplicado: toAmount(a.applied_amount),
				pago: a.payment
			}))
		}
	};
}

/** accounting helpers expect a string client_id. */
function withClientId<T extends { client_id: string | null }>(rows: T[]) {
	return rows.map((row) => ({ ...row, client_id: row.client_id ?? '' }));
}

const BALANCE_COLUMNS =
	'id, client_id, client_name, invoice_number, total_amount, status, due_date, invoice_date, factura_tipo, created_at';

async function allocationsFor(db: Db, invoiceIds: string[]) {
	const out: { id: string; payment_id: string; invoice_id: string; applied_amount: number }[] = [];
	for (let i = 0; i < invoiceIds.length; i += 200) {
		const { data, error } = await db
			.from('accounting_allocations')
			.select('id, payment_id, invoice_id, applied_amount')
			.in('invoice_id', invoiceIds.slice(i, i + 200));
		if (error) throw new Error(error.message);
		out.push(...(data || []));
	}
	return out;
}

async function openProformaBalances(db: Db, clientId?: string) {
	let query = db
		.from('invoices')
		.select(BALANCE_COLUMNS)
		.eq('factura_tipo', 'proforma')
		.in('status', ['pending', 'overdue']);
	if (clientId) query = query.eq('client_id', clientId);
	const { data: invoices, error } = await query;
	if (error) throw new Error(error.message);
	const allocations = await allocationsFor(
		db,
		(invoices || []).map((i) => i.id)
	);
	const names = new Map((invoices || []).map((i) => [i.id, i.client_name]));
	return buildInvoiceBalances(withClientId(invoices || []), allocations)
		.filter((b) => b.balanceDue > 0)
		.map((b) => ({ ...b, clientName: names.get(b.id) ?? '' }));
}

const lineaLibre = z.object({
	producto: z.string().describe('Nombre del producto tal como viene en el archivo'),
	modelo: z.string().optional().describe('Modelo si viene aparte (ej. Elite, Pro)'),
	color: z.string().optional(),
	cantidad: z.number().positive(),
	precio: z
		.number()
		.positive()
		.optional()
		.describe('Solo si el archivo trae un precio que se debe respetar')
});

const lineaResuelta = z.object({
	product_id: z.string().describe('id del producto (de preparar_proforma o buscar_productos)'),
	color: z.string(),
	cantidad: z.number().positive(),
	precio: z
		.number()
		.positive()
		.optional()
		.describe('Omitir para usar el precio por cliente o el de catálogo')
});

const impuestosSchema = z
	.enum(['none', 'added', 'included'])
	.optional()
	.describe(
		'none = sin ITBIS; added = +18% sobre el subtotal; included = el precio ya incluye 18%'
	);

export function buildMcpServer(ctx: McpContext) {
	const server = new McpServer(
		{ name: 'magikalinvoice', version: '1.0.0' },
		{
			instructions: [
				'Herramientas de la app de facturación (Proformas, Facturas, Clientes, Productos, Inventario, Pagos).',
				'Usuario: ' + ctx.user.email + ' (rol: ' + (ctx.role ?? 'sin rol') + ').',
				'Para crear una Proforma desde un CSV o Excel: lee el archivo, extrae cliente y líneas (producto, modelo, color, cantidad, precio), llama preparar_proforma, muestra al usuario lo dudoso y lo que no existe, y solo con su visto bueno llama crear_proforma con las líneas resueltas.',
				'Nunca elijas tú un producto, color o cliente ambiguo: pregunta. Montos en pesos. Fechas YYYY-MM-DD.',
				'registrar_pago y convertir_a_factura: primero llama sin confirmar para ver la vista previa, muéstrala y llama con confirmar: true solo si el usuario lo aprueba.'
			].join('\n')
		}
	);

	server.registerTool(
		'quien_soy',
		{ description: 'Usuario conectado y su rol.', annotations: { readOnlyHint: true } },
		async () => ok({ email: ctx.user.email, rol: ctx.role })
	);

	server.registerTool(
		'buscar_clientes',
		{
			description:
				'Busca Clientes por nombre, empresa, alias o RNC (tolera errores de escritura). Sin texto lista todos.',
			inputSchema: {
				texto: z.string().optional(),
				limite: z.number().int().positive().max(200).optional()
			},
			annotations: { readOnlyHint: true }
		},
		async ({ texto, limite }) => {
			const clients = await loadClients(ctx.supabase);
			const list = texto
				? rankClients(clients, texto).map((x) => ({
						...clientSummary(x.c),
						score: round2(x.score)
					}))
				: clients.map(clientSummary).sort((a, b) => a.nombre.localeCompare(b.nombre));
			return ok(list.slice(0, limite ?? 20));
		}
	);

	server.registerTool(
		'buscar_productos',
		{
			description:
				'Busca Productos del catálogo con modelo, precio de catálogo, precio por cliente (si das cliente_id) y stock por color.',
			inputSchema: {
				texto: z.string().optional(),
				cliente_id: z.string().optional(),
				limite: z.number().int().positive().max(100).optional()
			},
			annotations: { readOnlyHint: true }
		},
		async ({ texto, cliente_id, limite }) => {
			const catalog = await loadCatalog(ctx.supabase);
			let products = catalog.products;
			if (texto) {
				products = products
					.map((p) => ({ p, s: similarity(texto, p.title + ' ' + (p.modelName ?? '')) }))
					.filter((x) => x.s >= 0.4)
					.sort((a, b) => b.s - a.s)
					.map((x) => x.p);
			}
			products = products.slice(0, limite ?? 15);
			const ids = new Set(products.map((p) => p.id));
			const variants = catalog.variants.filter((v) => ids.has(v.product_id));
			const [stock, prices] = await Promise.all([
				stockByVariant(
					ctx.supabase,
					variants.map((v) => v.id)
				),
				clientPrices(ctx.supabase, cliente_id)
			]);
			return ok(
				products.map((p) => ({
					product_id: p.id,
					producto: p.title,
					modelo: p.modelName,
					precio_catalogo: p.price,
					precio_cliente: prices.get(p.id) ?? null,
					colores: variants
						.filter((v) => v.product_id === p.id)
						.map((v) => ({ color: v.color, stock: stock.get(v.id) ?? 0 }))
				}))
			);
		}
	);

	server.registerTool(
		'listar_colores',
		{ description: 'Colores válidos del catálogo.', annotations: { readOnlyHint: true } },
		async () => ok((await loadCatalog(ctx.supabase)).colors)
	);

	server.registerTool(
		'consultar_stock',
		{
			description:
				'Stock por Variante (producto + color). Filtra por texto o solo las de stock bajo.',
			inputSchema: { texto: z.string().optional(), solo_bajo: z.boolean().optional() },
			annotations: { readOnlyHint: true }
		},
		async ({ texto, solo_bajo }) => {
			const catalog = await loadCatalog(ctx.supabase);
			const byId = new Map(catalog.products.map((p) => [p.id, p]));
			const stock = await stockByVariant(
				ctx.supabase,
				catalog.variants.map((v) => v.id)
			);
			let rows = catalog.variants.map((v) => {
				const p = byId.get(v.product_id);
				const qty = stock.get(v.id) ?? 0;
				return {
					producto: p?.title ?? '?',
					modelo: p?.modelName ?? null,
					color: v.color,
					sku: v.sku,
					stock: qty,
					stock_minimo: v.min_stock,
					bajo: qty <= (v.min_stock ?? 0)
				};
			});
			if (texto) {
				rows = rows.filter(
					(r) => similarity(texto, r.producto + ' ' + (r.modelo ?? '') + ' ' + r.color) >= 0.5
				);
			}
			if (solo_bajo) rows = rows.filter((r) => r.bajo);
			return ok(rows.slice(0, 300));
		}
	);

	server.registerTool(
		'listar_proformas',
		{
			description: 'Proformas activas (no convertidas a Factura) con total, pagado y saldo.',
			inputSchema: {
				cliente_id: z.string().optional(),
				estado: z.enum(['draft', 'pending', 'paid', 'overdue']).optional(),
				desde: z.string().regex(ISO_DATE).optional(),
				hasta: z.string().regex(ISO_DATE).optional(),
				limite: z.number().int().positive().max(200).optional()
			},
			annotations: { readOnlyHint: true }
		},
		async ({ cliente_id, estado, desde, hasta, limite }) => {
			let query = ctx.supabase
				.from('invoices')
				.select(BALANCE_COLUMNS)
				.eq('factura_tipo', 'proforma')
				.order('invoice_date', { ascending: false })
				.limit(limite ?? 50);
			if (cliente_id) query = query.eq('client_id', cliente_id);
			if (estado) query = query.eq('status', estado);
			if (desde) query = query.gte('invoice_date', desde);
			if (hasta) query = query.lte('invoice_date', hasta);
			const [{ data, error }, converted] = await Promise.all([
				query,
				convertedProformaIds(ctx.supabase)
			]);
			if (error) return fail(error.message);
			const active = (data || []).filter((i) => !converted.has(i.id));
			const names = new Map(active.map((i) => [i.id, i.client_name]));
			const allocations = await allocationsFor(
				ctx.supabase,
				active.map((i) => i.id)
			);
			return ok(
				buildInvoiceBalances(withClientId(active), allocations).map((b) => ({
					id: b.id,
					numero: b.invoice_number,
					cliente: names.get(b.id),
					fecha: b.invoice_date,
					vencimiento: b.due_date,
					estado: b.status,
					total: round2(toAmount(b.total_amount)),
					pagado: round2(b.paidAmount),
					saldo: round2(b.balanceDue)
				}))
			);
		}
	);

	server.registerTool(
		'ver_proforma',
		{
			description: 'Detalle de una Proforma o Factura por id o número: líneas, pagos y saldo.',
			inputSchema: { proforma: z.string().describe('id o número (ej. INV-2026-1234)') },
			annotations: { readOnlyHint: true }
		},
		async ({ proforma }) => {
			const detail = await documentDetail(ctx.supabase, proforma);
			if (!detail) return fail('No se encontró el documento.');
			return ok(detail.view);
		}
	);

	server.registerTool(
		'saldos_vencidos',
		{
			description: 'Proformas con saldo pendiente y vencidas, agrupadas por Cliente.',
			inputSchema: { cliente_id: z.string().optional() },
			annotations: { readOnlyHint: true }
		},
		async ({ cliente_id }) => {
			const balances = await openProformaBalances(ctx.supabase, cliente_id);
			const overdue = balances.filter((b) => isOverdueBalance(b.due_date, b.balanceDue));
			const byClient = new Map<
				string,
				{ cliente: string; saldo_vencido: number; proformas: unknown[] }
			>();
			for (const b of overdue) {
				const key = b.client_id || 'sin-cliente';
				const entry = byClient.get(key) ?? {
					cliente: b.clientName,
					saldo_vencido: 0,
					proformas: []
				};
				entry.saldo_vencido = round2(entry.saldo_vencido + b.balanceDue);
				entry.proformas.push({
					id: b.id,
					numero: b.invoice_number,
					vencimiento: b.due_date,
					saldo: round2(b.balanceDue)
				});
				byClient.set(key, entry);
			}
			return ok(
				[...byClient.entries()]
					.map(([id, v]) => ({ cliente_id: id, ...v }))
					.sort((a, b) => b.saldo_vencido - a.saldo_vencido)
			);
		}
	);

	server.registerTool(
		'preparar_proforma',
		{
			description:
				'NO guarda nada. Compara líneas en formato libre (de un CSV/Excel) contra el catálogo y el Cliente: devuelve líneas resueltas listas para crear_proforma, líneas dudosas con candidatos, líneas sin coincidencia, variantes que faltan, precios y total estimado.',
			inputSchema: {
				cliente: z.string().describe('id, nombre, alias o RNC del Cliente'),
				lineas: z.array(lineaLibre).min(1).max(500),
				impuestos: impuestosSchema,
				descuento: z.number().min(0).optional()
			},
			annotations: { readOnlyHint: true }
		},
		async ({ cliente, lineas, impuestos, descuento }) => {
			const { client, candidates } = await resolveClient(ctx.supabase, cliente);
			const catalog = await loadCatalog(ctx.supabase);
			const prices = await clientPrices(ctx.supabase, client?.id);
			const variantKeys = new Map(
				catalog.variants.map((v) => [getProductVariantKey(v.product_id, v.color), v.id])
			);

			type Resolved = {
				fila: number;
				product_id: string;
				producto: string;
				modelo: string | null;
				color: string;
				cantidad: number;
				precio: number;
				origen_precio: string;
				monto: number;
				variant_id: string | null;
				seguridad: 'exacto' | 'probable';
				original?: unknown;
			};
			const resueltas: Resolved[] = [];
			const dudosas: unknown[] = [];
			const sin_coincidencia: unknown[] = [];
			const variantes_faltantes: unknown[] = [];
			let lineTotal = 0;

			lineas.forEach((linea, index) => {
				const fila = index + 1;
				const product = matchProduct(catalog.products, linea.producto, linea.modelo);
				const p = product.productId
					? catalog.products.find((x) => x.id === product.productId)
					: null;

				if (!p) {
					const none = product.confidence === 'sin_coincidencia';
					(none ? sin_coincidencia : dudosas).push({
						fila,
						original: linea,
						motivo: none ? 'Producto no encontrado' : 'Producto ambiguo',
						candidatos: product.candidates
					});
					return;
				}
				const color = matchColor(catalog.colors, linea.color);
				if (!color.color) {
					dudosas.push({
						fila,
						original: linea,
						motivo: linea.color ? 'Color no reconocido' : 'Falta el color',
						product_id: p.id,
						producto: p.title,
						modelo: p.modelName,
						candidatos_color: color.candidates.length ? color.candidates : catalog.colors
					});
					return;
				}
				const unitPrice = linea.precio ?? prices.get(p.id) ?? p.price;
				const variantId = variantKeys.get(getProductVariantKey(p.id, color.color)) ?? null;
				if (!variantId) {
					variantes_faltantes.push({
						fila,
						producto: p.title,
						modelo: p.modelName,
						color: color.color
					});
				}
				lineTotal += unitPrice * linea.cantidad;
				const sure = product.confidence === 'exacto' && color.exact;
				resueltas.push({
					fila,
					product_id: p.id,
					producto: p.title,
					modelo: p.modelName,
					color: color.color,
					cantidad: linea.cantidad,
					precio: unitPrice,
					origen_precio: linea.precio
						? 'archivo'
						: prices.has(p.id)
							? 'precio por cliente'
							: 'catálogo',
					monto: round2(unitPrice * linea.cantidad),
					variant_id: variantId,
					seguridad: sure ? 'exacto' : 'probable',
					...(sure ? {} : { original: linea })
				});
			});

			const stock = await stockByVariant(
				ctx.supabase,
				resueltas.map((r) => r.variant_id).filter((v): v is string => !!v)
			);
			const taxMode = parseTaxMode(impuestos ?? 'none');
			const totals = computeProformaTotals(lineTotal, taxMode, descuento ?? 0);

			return ok({
				cliente: client ? clientSummary(client) : null,
				candidatos_cliente: client ? undefined : candidates,
				resumen: {
					lineas: lineas.length,
					resueltas: resueltas.length,
					probables: resueltas.filter((r) => r.seguridad === 'probable').length,
					dudosas: dudosas.length,
					sin_coincidencia: sin_coincidencia.length,
					variantes_faltantes: variantes_faltantes.length
				},
				resueltas: resueltas.map(({ variant_id, ...r }) => ({
					...r,
					stock_actual: variant_id ? (stock.get(variant_id) ?? 0) : null
				})),
				dudosas,
				sin_coincidencia,
				variantes_faltantes,
				totales_estimados: {
					impuestos: taxMode,
					subtotal: round2(totals.subtotal),
					descuento: descuento ?? 0,
					itbis: round2(totals.taxAmount),
					total: round2(totals.totalAmount)
				},
				siguiente_paso:
					'Muestra al usuario las líneas probables, dudosas y sin coincidencia. Cuando todo esté resuelto, llama crear_proforma con cliente_id y las líneas {product_id, color, cantidad, precio?}.'
			});
		}
	);

	server.registerTool(
		'crear_proforma',
		{
			description:
				'Crea una Proforma con líneas ya resueltas (product_id + color). Sin precio usa el precio por cliente o el de catálogo. Fecha por defecto hoy; vencimiento por defecto +30 días.',
			inputSchema: {
				cliente_id: z.string(),
				lineas: z.array(lineaResuelta).min(1).max(500),
				fecha: z.string().regex(ISO_DATE).optional(),
				vencimiento: z.string().regex(ISO_DATE).optional(),
				notas: z.string().optional(),
				impuestos: impuestosSchema,
				descuento: z.number().min(0).optional(),
				numero: z.string().optional().describe('Número manual; si no, se genera INV-AAAA-NNNN'),
				estado: z.enum(['draft', 'pending']).optional(),
				crear_variantes_faltantes: z.boolean().optional()
			},
			annotations: { readOnlyHint: false, destructiveHint: false }
		},
		async (args) => {
			const blocked = denied(ctx, WRITE_ROLES);
			if (blocked) return blocked;
			const { client } = await resolveClient(ctx.supabase, args.cliente_id);
			if (!client) return fail('Cliente no encontrado. Usa buscar_clientes para obtener el id.');
			const fecha = args.fecha ?? today();
			const result = await createProforma(ctx.supabase, ctx.user.id, {
				invoiceNumber: args.numero,
				clientId: client.id,
				clientName: clientName(client),
				clientEmail: client.email ?? '',
				invoiceDate: fecha,
				dueDate: args.vencimiento ?? addDays(fecha, 30),
				status: args.estado ?? 'pending',
				notes: args.notas ?? '',
				taxMode: parseTaxMode(args.impuestos ?? 'none'),
				discountAmount: args.descuento ?? 0,
				createMissingVariants: args.crear_variantes_faltantes,
				items: args.lineas.map((l) => ({
					product_id: l.product_id,
					color: l.color,
					quantity: l.cantidad,
					unit_price: l.precio ?? null
				}))
			});
			if (!result.ok) return serviceFail(result);
			return ok({
				creada: true,
				id: result.id,
				numero: result.invoiceNumber,
				total: round2(result.totalAmount),
				ruta: '/dashboard/proforma/' + result.id
			});
		}
	);

	server.registerTool(
		'editar_proforma',
		{
			description:
				'Edita una Proforma: agrega, quita o cambia líneas (número de línea de ver_proforma) y/o datos de cabecera. Si tiene pagos asignados, no se puede cambiar cliente, fechas, estado ni total.',
			inputSchema: {
				proforma: z.string().describe('id o número'),
				agregar: z.array(lineaResuelta).optional(),
				quitar: z
					.array(z.number().int().positive())
					.optional()
					.describe('Números de línea a quitar'),
				cambiar: z
					.array(
						z.object({
							linea: z.number().int().positive(),
							cantidad: z.number().positive().optional(),
							precio: z.number().positive().optional(),
							color: z.string().optional()
						})
					)
					.optional(),
				cliente_id: z.string().optional(),
				fecha: z.string().regex(ISO_DATE).optional(),
				vencimiento: z.string().regex(ISO_DATE).optional(),
				notas: z.string().optional(),
				impuestos: impuestosSchema,
				descuento: z.number().min(0).optional(),
				estado: z.enum(['draft', 'pending', 'overdue']).optional(),
				crear_variantes_faltantes: z.boolean().optional()
			},
			annotations: { readOnlyHint: false, destructiveHint: true }
		},
		async (args) => {
			const blocked = denied(ctx, WRITE_ROLES);
			if (blocked) return blocked;
			const detail = await documentDetail(ctx.supabase, args.proforma);
			if (!detail) return fail('No se encontró la proforma.');
			const { invoice, rows } = detail;
			if (invoice.factura_tipo !== 'proforma') {
				return fail('Ese documento ya es una Factura; no se edita aquí.');
			}
			if (detail.view.factura_generada) {
				return fail('Esta proforma ya se convirtió en Factura.');
			}

			const bad = [...(args.quitar ?? []), ...(args.cambiar ?? []).map((c) => c.linea)].filter(
				(n) => n > rows.length
			);
			if (bad.length) {
				return fail(
					'Líneas inexistentes: ' + bad.join(', ') + '. La proforma tiene ' + rows.length + '.'
				);
			}

			const remove = new Set(args.quitar ?? []);
			const changes = new Map((args.cambiar ?? []).map((c) => [c.linea, c]));
			const items: ProformaItemInput[] = [];
			rows.forEach((it, i) => {
				const n = i + 1;
				if (remove.has(n) || !it.product_id) return;
				const change = changes.get(n);
				items.push({
					product_id: it.product_id,
					color: change?.color ?? it.color ?? '',
					model: it.model,
					quantity: change?.cantidad ?? Number(it.quantity),
					unit_price: change?.precio ?? Number(it.unit_price)
				});
			});
			for (const l of args.agregar ?? []) {
				items.push({
					product_id: l.product_id,
					color: l.color,
					quantity: l.cantidad,
					unit_price: l.precio ?? null
				});
			}

			let clientId = invoice.client_id ?? '';
			let name = invoice.client_name;
			let email = invoice.client_email;
			if (args.cliente_id && args.cliente_id !== clientId) {
				const { client } = await resolveClient(ctx.supabase, args.cliente_id);
				if (!client) return fail('Cliente no encontrado.');
				clientId = client.id;
				name = clientName(client);
				email = client.email ?? '';
			}

			// Same default the web editor uses: a stored tax rate means "added".
			const taxMode: TaxMode = args.impuestos ?? (Number(invoice.tax_rate) > 0 ? 'added' : 'none');
			const result = await updateProforma(ctx.supabase, ctx.user.id, invoice.id, {
				invoiceNumber: invoice.invoice_number,
				clientId,
				clientName: name,
				clientEmail: email,
				invoiceDate: args.fecha ?? invoice.invoice_date,
				dueDate: args.vencimiento ?? invoice.due_date,
				status: args.estado ?? invoice.status,
				notes: args.notas ?? invoice.notes ?? '',
				taxMode,
				discountAmount: args.descuento ?? Number(invoice.discount_amount),
				createMissingVariants: args.crear_variantes_faltantes,
				items
			});
			if (!result.ok) return serviceFail(result);
			return ok({
				actualizada: true,
				id: invoice.id,
				numero: invoice.invoice_number,
				total_anterior: round2(toAmount(invoice.total_amount)),
				total_nuevo: round2(result.totalAmount),
				lineas: items.length
			});
		}
	);

	server.registerTool(
		'registrar_pago',
		{
			description:
				'Registra un pago de un Cliente. Se aplica a sus Proformas pendientes de la más antigua a la más nueva. Sin confirmar: true solo devuelve una vista previa y no guarda nada.',
			inputSchema: {
				cliente_id: z.string(),
				monto: z.number().positive(),
				metodo: z.enum(PAYMENT_METHODS).describe('cash, transfer, check, card u other'),
				fecha: z.string().regex(ISO_DATE).optional(),
				referencia: z.string().optional(),
				notas: z.string().optional(),
				confirmar: z.boolean().optional()
			},
			annotations: { readOnlyHint: false, destructiveHint: false }
		},
		async (args) => {
			const blocked = denied(ctx, WRITE_ROLES);
			if (blocked) return blocked;
			const { client } = await resolveClient(ctx.supabase, args.cliente_id);
			if (!client) return fail('Cliente no encontrado.');
			// Same order as record_accounting_payment: invoice_date, due_date, created_at.
			const balances = (await openProformaBalances(ctx.supabase, client.id)).sort(
				(a, b) =>
					a.invoice_date.localeCompare(b.invoice_date) ||
					a.due_date.localeCompare(b.due_date) ||
					String(a.created_at).localeCompare(String(b.created_at))
			);
			const disponible = balances.reduce((s, b) => s + b.balanceDue, 0);
			if (disponible <= 0) return fail('El cliente no tiene saldo pendiente en Proformas.');
			if (args.monto > disponible + 1e-9) {
				return fail('El monto excede el saldo pendiente del cliente (' + round2(disponible) + ').');
			}
			let remaining = args.monto;
			const aplicacion = [];
			for (const b of balances) {
				if (remaining <= 0) break;
				const applied = Math.min(remaining, b.balanceDue);
				remaining -= applied;
				aplicacion.push({
					numero: b.invoice_number,
					saldo_antes: round2(b.balanceDue),
					aplicado: round2(applied),
					saldo_despues: round2(b.balanceDue - applied),
					quedara_pagada: b.balanceDue - applied <= 0
				});
			}
			const fecha = args.fecha ?? today();
			if (!args.confirmar) {
				return ok({
					vista_previa: {
						cliente: clientName(client),
						monto: args.monto,
						metodo: args.metodo,
						fecha,
						saldo_pendiente_total: round2(disponible),
						aplicacion
					},
					siguiente_paso: 'Muestra esto al usuario y repite con confirmar: true si aprueba.'
				});
			}
			const { data, error } = await ctx.supabase.rpc('record_accounting_payment', {
				p_client_id: client.id,
				p_amount: args.monto,
				p_payment_date: fecha,
				p_payment_method: args.metodo,
				p_reference_number: args.referencia || undefined,
				p_notes: args.notas || undefined,
				p_created_by: ctx.user.id
			});
			if (error) return fail(error.message);
			return ok({ registrado: true, resultado: data, aplicacion });
		}
	);

	server.registerTool(
		'convertir_a_factura',
		{
			description:
				'Convierte una Proforma pagada en Factura (solo admin). Sin confirmar: true solo devuelve una vista previa y no guarda nada.',
			inputSchema: {
				proforma: z.string().describe('id o número'),
				crear_variantes_faltantes: z.boolean().optional(),
				confirmar: z.boolean().optional()
			},
			annotations: { readOnlyHint: false, destructiveHint: false }
		},
		async ({ proforma, crear_variantes_faltantes, confirmar }) => {
			const blocked = denied(ctx, ['admin']);
			if (blocked) return blocked;
			const detail = await documentDetail(ctx.supabase, proforma);
			if (!detail) return fail('No se encontró la proforma.');
			const v = detail.view;
			if (v.tipo !== 'proforma') return fail('Ese documento ya es una Factura.');
			if (v.factura_generada) {
				return fail('Esta proforma ya tiene Factura.', { factura: v.factura_generada });
			}
			if (!confirmar) {
				return ok({
					vista_previa: {
						numero: v.numero,
						cliente: v.cliente,
						estado: v.estado,
						total: v.total,
						pagado: v.pagado,
						saldo: v.saldo,
						lineas: v.lineas.length,
						aviso:
							v.estado !== 'paid'
								? 'La proforma no está pagada; la conversión será rechazada.'
								: undefined
					},
					siguiente_paso: 'Muestra esto al usuario y repite con confirmar: true si aprueba.'
				});
			}
			const result = await clonePaidProformaToInvoice(ctx.supabase, {
				proformaId: v.id,
				createdBy: ctx.user.id,
				createMissingVariants: crear_variantes_faltantes
			});
			if (!result.ok) {
				if ('missingVariants' in result) {
					return fail(
						'Faltan variantes de inventario. Repite con crear_variantes_faltantes: true si el usuario está de acuerdo.',
						{ variantes_faltantes: result.missingVariants }
					);
				}
				return fail(result.error);
			}
			return ok({
				convertida: true,
				factura_id: result.invoiceId,
				ruta: '/dashboard/invoices/' + result.invoiceId
			});
		}
	);

	return server;
}
