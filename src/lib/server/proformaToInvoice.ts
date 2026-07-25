import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import { generateUniqueInvoiceNumber } from '$lib/server/invoiceNumber';
import { resolveVariantIdForItem } from '$lib/server/inventory';
import { toAmount } from '$lib/server/accounting';

type TypedSupabase = SupabaseClient<Database>;

type ProformaItemRow = {
	id: string;
	product_id: string | null;
	product_variant_id: string | null;
	description: string;
	color: string | null;
	model: string | null;
	quantity: number | string;
	unit_price: number | string;
	amount: number | string;
};

type ProformaRow = {
	id: string;
	factura_tipo: string;
	client_id: string | null;
	client_name: string;
	client_email: string;
	invoice_date: string;
	due_date: string;
	status: string;
	notes: string | null;
	tax_rate: number | string;
	discount_amount: number | string;
	total_amount: number | string;
	created_by: string | null;
};

function todayIsoDate() {
	return new Date().toISOString().slice(0, 10);
}

export async function clonePaidProformaToInvoice(
	supabase: TypedSupabase,
	params: { proformaId: string; createdBy: string }
) {
	const { data: sourceInvoice, error: sourceError } = await supabase
		.from('invoices')
		.select(
			'id, factura_tipo, client_id, client_name, client_email, invoice_date, due_date, status, notes, tax_rate, discount_amount, total_amount, created_by'
		)
		.eq('id', params.proformaId)
		.single();

	if (sourceError || !sourceInvoice) {
		return { ok: false as const, error: 'No se encontró la proforma.' };
	}

	const source = sourceInvoice as ProformaRow;

	if (source.factura_tipo !== 'proforma') {
		return { ok: false as const, error: 'Solo se puede convertir una proforma.' };
	}

	const { data: paidAllocations, error: allocationsError } = await supabase
		.from('accounting_allocations')
		.select('applied_amount')
		.eq('invoice_id', params.proformaId);

	if (allocationsError) {
		return { ok: false as const, error: allocationsError.message };
	}

	const paidAmount = (paidAllocations || []).reduce((sum, allocation) => {
		return sum + toAmount(allocation.applied_amount);
	}, 0);

	if (paidAmount < toAmount(source.total_amount)) {
		return {
			ok: false as const,
			error: 'La proforma todavía no está saldada por completo.'
		};
	}

	const { data: existingInvoice, error: existingError } = await supabase
		.from('invoices')
		.select('id, invoice_number')
		.eq('source_proforma_id', params.proformaId)
		.maybeSingle();

	if (existingError) {
		return { ok: false as const, error: existingError.message };
	}

	if (existingInvoice) {
		return {
			ok: true as const,
			invoiceId: existingInvoice.id,
			invoiceNumber: existingInvoice.invoice_number,
			created: false as const
		};
	}

	const { data: items, error: itemsError } = await supabase
		.from('invoice_items')
		.select(
			'id, product_id, product_variant_id, description, color, model, quantity, unit_price, amount'
		)
		.eq('invoice_id', params.proformaId)
		.order('created_at', { ascending: true });

	if (itemsError || !items) {
		return { ok: false as const, error: itemsError?.message || 'No se pudieron leer los conceptos.' };
	}

	if (items.length === 0) {
		return { ok: false as const, error: 'La proforma no tiene conceptos para convertir.' };
	}

	const normalizedItems: ProformaItemRow[] = [];

	for (const item of items) {
		let productVariantId = item.product_variant_id;

		if (!productVariantId) {
			if (!item.product_id) {
				return {
					ok: false as const,
					error: `No se pudo resolver la variante de "${item.description}".`
				};
			}

			const color = (item.color || '').trim().toLowerCase();
			const { id, error } = await resolveVariantIdForItem(supabase, item.product_id, color);

			if (error || !id) {
				return {
					ok: false as const,
					error: `No existe una variante de inventario para "${item.description}".`
				};
			}

			productVariantId = id;
		}

		normalizedItems.push({
			...item,
			product_variant_id: productVariantId
		});
	}

	const invoiceNumber = await generateUniqueInvoiceNumber(supabase, 'INV');
	const invoiceDate = todayIsoDate();

	const { data: invoice, error: invoiceError } = await supabase
		.from('invoices')
		.insert({
			invoice_number: invoiceNumber,
			factura_tipo: 'ninguna',
			document_type: 'factura',
			ncf: null,
			client_id: source.client_id,
			client_name: source.client_name,
			client_email: source.client_email,
			invoice_date: invoiceDate,
			due_date: source.due_date,
			status: 'pending',
			notes: source.notes,
			tax_rate: toAmount(source.tax_rate),
			discount_amount: toAmount(source.discount_amount),
			total_amount: toAmount(source.total_amount),
			created_by: params.createdBy,
			source_proforma_id: source.id
		})
		.select('id, invoice_number')
		.single();

	if (invoiceError || !invoice) {
		return { ok: false as const, error: invoiceError?.message || 'No se pudo crear la factura.' };
	}

	const { error: itemsInsertError } = await supabase.from('invoice_items').insert(
		normalizedItems.map((item) => ({
			invoice_id: invoice.id,
			product_id: item.product_id,
			product_variant_id: item.product_variant_id,
			description: item.description,
			color: item.color,
			model: item.model,
			quantity: toAmount(item.quantity),
			unit_price: toAmount(item.unit_price),
			amount: toAmount(item.amount)
		}))
	);

	if (itemsInsertError) {
		await supabase.from('invoices').delete().eq('id', invoice.id);
		return {
			ok: false as const,
			error: `No se pudieron copiar los conceptos: ${itemsInsertError.message}`
		};
	}

	const { error: paidError } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id);

	if (paidError) {
		await supabase.from('invoices').delete().eq('id', invoice.id);
		return { ok: false as const, error: paidError.message };
	}

	return {
		ok: true as const,
		invoiceId: invoice.id,
		invoiceNumber: invoice.invoice_number,
		created: true as const
	};
}
