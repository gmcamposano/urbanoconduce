import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profile } = await parent();

	if (profile?.role !== 'admin') {
		throw redirect(303, '/dashboard/proforma');
	}

	try {
		const [{ data: profiles, error: profilesError }, { data: allowedEmails, error: allowedError }] =
			await Promise.all([
				locals.supabase.from('profiles').select('*').order('name', { ascending: true }),
				locals.supabase
					.from('allowed_emails')
					.select('*')
					.order('created_at', { ascending: false })
			]);

		if (profilesError) {
			console.error('Supabase query error in admin load:', profilesError.message);
		}

		if (allowedError) {
			console.error('Supabase query error loading allowed_emails:', allowedError.message);
		}

		return {
			profiles: profiles || [],
			allowedEmails: allowedEmails || []
		};
	} catch (e) {
		console.error('Unexpected exception in admin load:', e);
		return { profiles: [], allowedEmails: [] };
	}
};

export const actions: Actions = {
	updateRole: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { error: 'Solo un administrador puede gestionar este panel.' });
		}

		const formData = await request.formData();
		const targetProfileId = formData.get('id') as string;
		const targetRole = formData.get('role') as string;

		if (!targetProfileId || !targetRole) {
			return fail(400, { error: 'El ID del perfil y el nuevo rol son obligatorios.' });
		}

		if (targetProfileId === user.id) {
			return fail(400, { error: 'No puedes cambiar tu propio rol para evitar bloquear el acceso del administrador.' });
		}

		if (!['admin', 'editor', 'viewer'].includes(targetRole)) {
			return fail(400, { error: 'El rol asignado no es válido.' });
		}

		try {
			const { error } = await locals.supabase
				.from('profiles')
				.update({ role: targetRole })
				.eq('id', targetProfileId);

			if (error) {
				return fail(400, { error: error.message });
			}

			return { success: true };
		} catch (e: any) {
			return fail(400, { error: e.message || 'Ocurrió un error inesperado.' });
		}
	},

	addAllowedEmail: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { emailError: 'Solo un administrador puede gestionar este panel.' });
		}

		const formData = await request.formData();
		const pattern = (formData.get('pattern') as string)?.trim();
		const patternType = formData.get('pattern_type') as string;
		const description = (formData.get('description') as string)?.trim();

		if (!pattern) {
			return fail(400, { emailError: 'El patrón de correo es obligatorio.' });
		}

		const normalizedPattern = pattern.startsWith('@') ? pattern.toLowerCase() : pattern.toLowerCase();
		const finalPatternType = pattern.startsWith('@') ? 'domain' : (patternType || 'domain');

		try {
			const { error } = await locals.supabase.from('allowed_emails').insert({
				pattern: normalizedPattern,
				pattern_type: finalPatternType,
				description: description || null,
				created_by: user.id
			});

			if (error) {
				if (error.message.includes('duplicate') || error.message.includes('unique')) {
					return fail(400, { emailError: 'Este patrón ya existe.' });
				}
				return fail(400, { emailError: error.message });
			}

			return { emailSuccess: true };
		} catch (e: any) {
			return fail(400, { emailError: e.message || 'Ocurrió un error inesperado.' });
		}
	},

	deleteAllowedEmail: async ({ request, locals }) => {
		const { user } = await locals.safeGetUser();
		if (!user) {
			throw redirect(303, '/login');
		}

		if (locals.role !== 'admin') {
			return fail(403, { emailError: 'Solo un administrador puede gestionar este panel.' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { emailError: 'ID inválido.' });
		}

		try {
			const { error } = await locals.supabase.from('allowed_emails').delete().eq('id', id);

			if (error) {
				return fail(400, { emailError: error.message });
			}

			return { emailSuccess: true };
		} catch (e: any) {
			return fail(400, { emailError: e.message || 'Ocurrió un error inesperado.' });
		}
	}
};
