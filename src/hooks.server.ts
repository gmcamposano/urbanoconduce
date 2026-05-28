import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

export const handle: Handle = async ({ event, resolve }) => {
	const supabaseUrl = env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_URL.startsWith('http')
		? env.PUBLIC_SUPABASE_URL
		: 'https://placeholder-project.supabase.co';
	const supabaseKey = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 20
		? env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
		: 'placeholder-anon-key-structure-value';

	event.locals.supabase = createServerClient(supabaseUrl, supabaseKey, {
		cookies: {
			getAll() {
				return event.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	event.locals.safeGetUser = async () => {
		if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
			return { user: null };
		}

		try {
			const {
				data: { user },
				error
			} = await event.locals.supabase.auth.getUser();

			if (error) {
				return { user: null };
			}

			if (user && !event.locals.role) {
				const { data } = await event.locals.supabase
					.from('profiles')
					.select('role')
					.eq('id', user.id)
					.maybeSingle();
				event.locals.role = data?.role ?? null;
			}

			return { user };
		} catch (e) {
			console.error('Supabase session fetch error:', e);
			return { user: null };
		}
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
