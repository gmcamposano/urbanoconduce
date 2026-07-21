import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';

type TypedSupabase = SupabaseClient<Database>;

export async function generateUniqueInvoiceNumber(supabase: TypedSupabase, prefix: string) {
	const year = new Date().getUTCFullYear();
	for (let i = 0; i < 20; i++) {
		const suffix = Math.floor(1000 + Math.random() * 9000);
		const candidate = `${prefix}-${year}-${suffix}`;
		const { data } = await supabase
			.from('invoices')
			.select('id')
			.eq('invoice_number', candidate)
			.maybeSingle();
		if (!data) return candidate;
	}
	return `${prefix}-${year}-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function isInvoiceNumberTaken(supabase: TypedSupabase, invoiceNumber: string) {
	const { data } = await supabase
		.from('invoices')
		.select('id')
		.eq('invoice_number', invoiceNumber)
		.maybeSingle();
	return !!data;
}
