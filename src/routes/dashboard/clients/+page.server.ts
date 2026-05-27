import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	try {
		const { data: clients, error } = await locals.supabase
			.from('clients')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Supabase query error in clients load:', error.message);
			return { clients: [] };
		}

		return {
			clients: clients || []
		};
	} catch (e) {
		console.error('Unexpected exception in clients load:', e);
		return { clients: [] };
	}
};

	export const actions: Actions = {
	createClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const clientType = formData.get('client_type') as 'person' | 'company';
		const fullName = (formData.get('full_name') as string)?.trim() ?? '';
		const alias = (formData.get('alias') as string)?.trim() ?? '';
		const rnc = (formData.get('rnc') as string)?.trim() ?? '';
		const companyName = (formData.get('company_name') as string)?.trim() ?? '';

		if (!['person', 'company'].includes(clientType)) {
			return fail(400, { error: 'Debes seleccionar si el cliente es una persona o una empresa.' });
		}

		if (clientType === 'person' && !fullName) {
			return fail(400, { error: 'Debes indicar el nombre completo del cliente.' });
		}

		if (clientType === 'company' && (!alias || !rnc || !companyName)) {
			return fail(400, { error: 'Para una empresa debes completar alias, RNC y nombre de empresa.' });
		}

		try {
			const { error } = await locals.supabase.from('clients').insert({
				client_type: clientType,
				full_name: clientType === 'person' ? fullName : null,
				alias: clientType === 'company' ? alias : null,
				rnc: clientType === 'company' ? rnc : null,
				company_name: clientType === 'company' ? companyName : null
			});

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true };
	}
};
