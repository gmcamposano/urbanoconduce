import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function canManageCatalog(role: string | null) {
	return role === 'admin' || role === 'editor';
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (!profile) {
		throw redirect(303, '/login');
	}

	try {
		const [
			{ data: clients, error: clientsError },
			{ data: priceLists, error: priceListsError },
			{ data: assignments, error: assignmentsError }
		] = await Promise.all([
			locals.supabase.from('clients').select('*').order('created_at', { ascending: false }),
			locals.supabase
				.from('price_lists')
				.select('id, name, description')
				.order('name', { ascending: true }),
			locals.supabase
				.from('client_price_list_assignments')
				.select('id, client_id, price_list_id, valid_from, valid_to')
				.order('valid_from', { ascending: false })
		]);

		if (clientsError) {
			console.error('Supabase query error in clients load:', clientsError.message);
		}
		if (priceListsError) {
			console.error('Supabase query error in price_lists load:', priceListsError.message);
		}
		if (assignmentsError) {
			console.error('Supabase query error in assignments load:', assignmentsError.message);
		}

		return {
			clients: clients || [],
			priceLists: priceLists || [],
			assignments: assignments || []
		};
	} catch (e) {
		console.error('Unexpected exception in clients load:', e);
		return { clients: [], priceLists: [], assignments: [] };
	}
};

export const actions: Actions = {
	createClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para crear clientes.' });
		}

		const formData = await request.formData();
		const clientType = formData.get('client_type') as 'person' | 'company';
		const fullName = (formData.get('full_name') as string)?.trim() ?? '';
		const alias = (formData.get('alias') as string)?.trim().toLowerCase() ?? '';
		const rnc = (formData.get('rnc') as string)?.trim() ?? '';
		const companyName = (formData.get('company_name') as string)?.trim().toLowerCase() ?? '';
		const priceListId = (formData.get('default_price_list_id') as string)?.trim() || null;

		if (!['person', 'company'].includes(clientType)) {
			return fail(400, { error: 'Debes seleccionar si el cliente es una persona o una empresa.' });
		}

		if (clientType === 'person' && !fullName) {
			return fail(400, { error: 'Debes indicar el nombre completo del cliente.' });
		}

		if (clientType === 'company' && (!alias || !rnc || !companyName)) {
			return fail(400, {
				error: 'Para una empresa debes completar alias, RNC y nombre de empresa.'
			});
		}

		try {
			const { data: newClient, error } = await locals.supabase
				.from('clients')
				.insert({
					client_type: clientType,
					full_name: clientType === 'person' ? fullName : null,
					alias: clientType === 'company' ? alias : null,
					rnc: clientType === 'company' ? rnc : null,
					company_name: clientType === 'company' ? companyName : null
				})
				.select('id')
				.single();

			if (error) {
				return fail(400, { error: error.message });
			}

			if (priceListId && newClient) {
				const { error: assignError } = await locals.supabase
					.from('client_price_list_assignments')
					.insert({
						client_id: newClient.id,
						price_list_id: priceListId,
						valid_from: new Date().toISOString().slice(0, 10),
						valid_to: null,
						created_by: user.id
					});
				if (assignError) {
					console.error('Error creating price list assignment:', assignError.message);
				}
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Cliente guardado.' };
	},
	updateClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para editar clientes.' });
		}

		const formData = await request.formData();
		const clientId = (formData.get('id') as string)?.trim() ?? '';
		const clientType = formData.get('client_type') as 'person' | 'company';
		const fullName = (formData.get('full_name') as string)?.trim() ?? '';
		const alias = (formData.get('alias') as string)?.trim().toLowerCase() ?? '';
		const rnc = (formData.get('rnc') as string)?.trim() ?? '';
		const companyName = (formData.get('company_name') as string)?.trim().toLowerCase() ?? '';
		const priceListId = (formData.get('default_price_list_id') as string)?.trim() || null;
		const today = new Date().toISOString().slice(0, 10);

		if (!clientId) {
			return fail(400, { error: 'El ID del cliente es obligatorio.' });
		}

		if (!['person', 'company'].includes(clientType)) {
			return fail(400, { error: 'Debes seleccionar si el cliente es una persona o una empresa.' });
		}

		if (clientType === 'person' && !fullName) {
			return fail(400, { error: 'Debes indicar el nombre completo del cliente.' });
		}

		if (clientType === 'company' && (!alias || !rnc || !companyName)) {
			return fail(400, {
				error: 'Para una empresa debes completar alias, RNC y nombre de empresa.'
			});
		}

		try {
			const { error } = await locals.supabase
				.from('clients')
				.update({
					client_type: clientType,
					full_name: clientType === 'person' ? fullName : null,
					alias: clientType === 'company' ? alias : null,
					rnc: clientType === 'company' ? rnc : null,
					company_name: clientType === 'company' ? companyName : null
				})
				.eq('id', clientId);

			if (error) {
				return fail(400, { error: error.message });
			}

			const { data: current } = await locals.supabase
				.from('client_price_list_assignments')
				.select('id, price_list_id')
				.eq('client_id', clientId)
				.lte('valid_from', today)
				.or('valid_to.is.null,valid_to.gte.' + today)
				.order('valid_from', { ascending: false })
				.limit(1)
				.maybeSingle();

			const currentListId = current?.price_list_id ?? null;

			if (priceListId !== currentListId) {
				if (currentListId) {
					await locals.supabase
						.from('client_price_list_assignments')
						.update({ valid_to: today })
						.eq('id', current!.id);
				}
				if (priceListId) {
					await locals.supabase.from('client_price_list_assignments').insert({
						client_id: clientId,
						price_list_id: priceListId,
						valid_from: today,
						valid_to: null,
						created_by: user.id
					});
				}
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Cliente actualizado.' };
	},
	deleteClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para borrar clientes.' });
		}

		const formData = await request.formData();
		const clientId = (formData.get('id') as string)?.trim() ?? '';

		if (!clientId) {
			return fail(400, { error: 'El ID del cliente es obligatorio.' });
		}

		try {
			const { error } = await locals.supabase.from('clients').delete().eq('id', clientId);

			if (error) {
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Cliente borrado.' };
	}
};
