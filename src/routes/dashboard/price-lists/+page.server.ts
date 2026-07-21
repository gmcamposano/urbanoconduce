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

	if (!canManageCatalog(profile.role)) {
		throw redirect(303, '/dashboard');
	}

	try {
		const [
			{ data: priceLists, error: priceListsError },
			{ data: products, error: productsError },
			{ data: models, error: modelsError },
			{ data: entries, error: entriesError },
			{ data: clients, error: clientsError },
			{ data: assignments, error: assignmentsError }
		] = await Promise.all([
			locals.supabase.from('price_lists').select('*').order('name', { ascending: true }),
			locals.supabase
				.from('products')
				.select('id, title, model, price_without_taxes')
				.order('title', { ascending: true }),
			locals.supabase.from('product_models').select('*').order('model', { ascending: true }),
			locals.supabase
				.from('price_list_entries')
				.select('id, price_list_id, product_id, unit_price, discount_percentage'),
			locals.supabase
				.from('clients')
				.select('id, client_type, full_name, company_name, alias')
				.order('company_name', { ascending: true })
				.order('full_name', { ascending: true }),
			locals.supabase
				.from('client_price_list_assignments')
				.select('id, client_id, price_list_id, valid_from, valid_to')
				.order('valid_from', { ascending: false })
		]);

		if (priceListsError) console.error('price_lists load:', priceListsError.message);
		if (productsError) console.error('products load:', productsError.message);
		if (modelsError) console.error('models load:', modelsError.message);
		if (entriesError) console.error('entries load:', entriesError.message);
		if (clientsError) console.error('clients load:', clientsError.message);
		if (assignmentsError) console.error('assignments load:', assignmentsError.message);

		return {
			priceLists: priceLists || [],
			products: products || [],
			models: models || [],
			entries: entries || [],
			clients: clients || [],
			assignments: assignments || []
		};
	} catch (e) {
		console.error('Unexpected exception in price-lists load:', e);
		return {
			priceLists: [],
			products: [],
			models: [],
			entries: [],
			clients: [],
			assignments: []
		};
	}
};

export const actions: Actions = {
	createList: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para gestionar tarifas.' });
		}

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() || null;
		const applyPercentageRaw = (formData.get('apply_percentage') as string)?.trim() ?? '';
		const applyPercentage = applyPercentageRaw === '' ? null : Number(applyPercentageRaw);

		if (!name) return fail(400, { error: 'El nombre de la tarifa es obligatorio.' });

		if (applyPercentage !== null) {
			if (Number.isNaN(applyPercentage) || applyPercentage < 0 || applyPercentage > 100) {
				return fail(400, { error: 'El porcentaje debe estar entre 0 y 100.' });
			}
		}

		try {
			const { data: newList, error: insertError } = await locals.supabase
				.from('price_lists')
				.insert({ name: name.toLowerCase(), description, created_by: user.id })
				.select('id')
				.single();

			if (insertError) {
				if (insertError.code === '23505') {
					return fail(400, { error: 'Ya existe una tarifa con ese nombre.' });
				}
				return fail(400, { error: insertError.message });
			}

			if (applyPercentage !== null && newList) {
				const { data: products, error: productsError } = await locals.supabase
					.from('products')
					.select('id, price_without_taxes');

				if (productsError) {
					return fail(400, { error: productsError.message });
				}

				const factor = 1 - applyPercentage / 100;
				const rows = (products || []).map((p) => ({
					price_list_id: newList.id,
					product_id: p.id,
					unit_price: Math.round(Number(p.price_without_taxes) * factor * 100) / 100,
					created_by: user.id
				}));

				if (rows.length > 0) {
					const { error: entriesError } = await locals.supabase
						.from('price_list_entries')
						.insert(rows);
					if (entriesError) {
						return fail(400, { error: entriesError.message });
					}
				}

				return {
					success: true,
					message: `Tarifa "${name}" creada con ${rows.length} entradas (${applyPercentage}% off catálogo).`
				};
			}

			return { success: true, message: `Tarifa "${name}" creada.` };
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}
	},

	updateList: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para gestionar tarifas.' });
		}

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim() ?? '';
		const name = (formData.get('name') as string)?.trim() ?? '';
		const description = (formData.get('description') as string)?.trim() || null;

		if (!id || !name) return fail(400, { error: 'ID y nombre son obligatorios.' });

		try {
			const { error } = await locals.supabase
				.from('price_lists')
				.update({ name: name.toLowerCase(), description })
				.eq('id', id);

			if (error) {
				if (error.code === '23505') {
					return fail(400, { error: 'Ya existe una tarifa con ese nombre.' });
				}
				return fail(400, { error: error.message });
			}
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Tarifa actualizada.' };
	},

	deleteList: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (canManageCatalog(locals.role) === false) {
			return fail(403, { error: 'No tienes permisos para borrar tarifas.' });
		}
		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo los administradores pueden borrar tarifas.' });
		}

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim() ?? '';

		if (!id) return fail(400, { error: 'El ID es obligatorio.' });

		const { data: assigned } = await locals.supabase
			.from('client_price_list_assignments')
			.select('id')
			.eq('price_list_id', id)
			.limit(1);

		if (assigned && assigned.length > 0) {
			return fail(400, {
				error:
					'No se puede borrar la tarifa: hay clientes asignados a ella. Reasigna o desasigna primero.'
			});
		}

		try {
			const { error } = await locals.supabase.from('price_lists').delete().eq('id', id);
			if (error) return fail(400, { error: error.message });
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Tarifa eliminada.' };
	},

	upsertEntry: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para gestionar entradas de tarifa.' });
		}

		const formData = await request.formData();
		const priceListId = (formData.get('price_list_id') as string)?.trim() ?? '';
		const productId = (formData.get('product_id') as string)?.trim() ?? '';
		const mode = (formData.get('mode') as string)?.trim() ?? 'absolute';
		const unitPriceRaw = (formData.get('unit_price') as string)?.trim() ?? '';
		const discountPctRaw = (formData.get('discount_percentage') as string)?.trim() ?? '';

		if (!priceListId || !productId) {
			return fail(400, { error: 'Tarifa y producto son obligatorios.' });
		}

		let insert: Record<string, unknown> = {
			price_list_id: priceListId,
			product_id: productId,
			created_by: user.id
		};

		if (mode === 'percentage') {
			const discountPct = Number(discountPctRaw);
			if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
				return fail(400, { error: 'El porcentaje debe estar entre 0 y 100.' });
			}
			insert = { ...insert, unit_price: null, discount_percentage: discountPct };
		} else {
			const unitPrice = Number(unitPriceRaw);
			if (Number.isNaN(unitPrice) || unitPrice < 0) {
				return fail(400, { error: 'El precio debe ser mayor o igual a cero.' });
			}
			insert = { ...insert, unit_price: unitPrice, discount_percentage: null };
		}

		try {
			const { error } = await locals.supabase
				.from('price_list_entries')
				.upsert(insert, { onConflict: 'price_list_id,product_id' });
			if (error) return fail(400, { error: error.message });
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Entrada guardada.' };
	},

	deleteEntry: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canManageCatalog(locals.role)) {
			return fail(403, { error: 'No tienes permisos para gestionar entradas de tarifa.' });
		}

		const formData = await request.formData();
		const priceListId = (formData.get('price_list_id') as string)?.trim() ?? '';
		const productId = (formData.get('product_id') as string)?.trim() ?? '';

		if (!priceListId || !productId) {
			return fail(400, { error: 'Tarifa y producto son obligatorios.' });
		}

		try {
			const { error } = await locals.supabase
				.from('price_list_entries')
				.delete()
				.eq('price_list_id', priceListId)
				.eq('product_id', productId);
			if (error) return fail(400, { error: error.message });
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}

		return { success: true, message: 'Entrada eliminada.' };
	}
};
