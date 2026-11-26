import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

export const handle: Handle = async ({ event, resolve }) => {
	const supabaseUrl =
		env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_URL.startsWith('http')
			? env.PUBLIC_SUPABASE_URL
			: 'https://placeholder-project.supabase.co';
	const supabaseKey =
		env.PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 20
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

	event.locals.profile = null;

	// Memoized per request: layout, page loads and actions share one auth + profile lookup.
	let userPromise: Promise<{ user: User | null }> | null = null;
	event.locals.safeGetUser = () => (userPromise ??= loadUser());

	const loadUser = async (): Promise<{ user: User | null }> => {
		if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
			return { user: null };
		}

		try {
			// getClaims verifies the JWT locally when the project uses asymmetric signing keys
			// (and falls back to the Auth server otherwise), avoiding a network call per request.
			const { data, error } = await event.locals.supabase.auth.getClaims();

			if (error || !data?.claims?.sub) {
				return { user: null };
			}

			const { claims } = data;
			const user = {
				id: claims.sub,
				aud: Array.isArray(claims.aud) ? (claims.aud[0] ?? '') : (claims.aud ?? ''),
				email: claims.email,
				phone: claims.phone,
				role: claims.role,
				is_anonymous: claims.is_anonymous,
				app_metadata: claims.app_metadata ?? {},
				user_metadata: claims.user_metadata ?? {},
				created_at: ''
			} as User;

			if (user) {
				const { data } = await event.locals.supabase
					.from('profiles')
					.select('id, email, name, role')
					.eq('id', user.id)
					.maybeSingle();
				event.locals.profile = data ?? null;
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
