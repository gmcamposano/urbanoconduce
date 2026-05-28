import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		// Fetch all invoices, including the name of the user who created it
		const { data: invoices, error } = await locals.supabase
			.from('invoices')
			.select('*, profiles:created_by(name, email)')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Supabase query error in dashboard load:', error.message);
			return { invoices: [] };
		}

		return {
			invoices: invoices || []
		};
	} catch (e) {
		console.error('Unexpected exception in dashboard load:', e);
		return { invoices: [] };
	}
};

export const actions: Actions = {
	deleteInvoice: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();

		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede eliminar facturas.' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'El ID de la factura es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase
				.from('invoices')
				.delete()
				.eq('id', id);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error al eliminar.' });
		}
	}
};
