import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function getUserRole(locals: App.Locals, userId: string) {
	const { data } = await locals.supabase.from('profiles').select('role').eq('id', userId).single();
	return data?.role ?? null;
}

function canManageCatalog(role: string | null) {
	return role === 'admin' || role === 'editor' || role === 'moderator';
}

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

		const role = await getUserRole(locals, user.id);
		if (!canManageCatalog(role)) {
			return fail(403, { error: 'No tienes permisos para crear clientes.' });
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

		return { success: true, message: 'Cliente guardado.' };
	},
	updateClient: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		const role = await getUserRole(locals, user.id);
		if (!canManageCatalog(role)) {
			return fail(403, { error: 'No tienes permisos para editar clientes.' });
		}

		const formData = await request.formData();
		const clientId = (formData.get('id') as string)?.trim() ?? '';
		const clientType = formData.get('client_type') as 'person' | 'company';
		const fullName = (formData.get('full_name') as string)?.trim() ?? '';
		const alias = (formData.get('alias') as string)?.trim() ?? '';
		const rnc = (formData.get('rnc') as string)?.trim() ?? '';
		const companyName = (formData.get('company_name') as string)?.trim() ?? '';

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
			return fail(400, { error: 'Para una empresa debes completar alias, RNC y nombre de empresa.' });
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

		const role = await getUserRole(locals, user.id);
		if (!canManageCatalog(role)) {
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
