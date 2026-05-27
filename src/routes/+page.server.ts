import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetUser();

	if (user) {
		throw redirect(303, '/dashboard');
	}
};

export const actions: Actions = {
	login: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return fail(400, { email, error: 'El correo electrónico y la contraseña son obligatorios.' });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			return fail(400, { email, error: error.message });
		}

		throw redirect(303, '/dashboard');
	},

	register: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const name = formData.get('name') as string;
		const role = dev ? (formData.get('role') as string) : 'viewer';

		if (!email || !password || !name || (dev && !role)) {
			return fail(400, { email, name, role, error: 'Todos los campos son obligatorios.' });
		}

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					name,
					role: dev ? role : 'viewer'
				}
			}
		});

		if (error) {
			return fail(400, { email, name, role, error: error.message });
		}

		if (data.session) {
			throw redirect(303, '/dashboard');
		}

		return {
			success: true,
			message: 'Registro exitoso. Revisa tu correo y verifica tu cuenta antes de iniciar sesión.'
		};
	},

	logout: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		throw redirect(303, '/');
	}
};
