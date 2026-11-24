import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	API_TOKEN_EXPIRY_OPTIONS,
	apiTokenExpiresAt,
	canMintUserJwt,
	generateApiToken
} from '$lib/server/apiTokens';
import { publicBaseUrl } from '$lib/server/mcp/auth';

const MAX_ACTIVE_TOKENS_PER_USER = 20;

type Owner = { name: string | null; email: string | null };

/** The embedded profile may be typed as a list; there is at most one owner. */
function firstOwner(owner: Owner | Owner[] | null): Owner | null {
	return Array.isArray(owner) ? (owner[0] ?? null) : owner;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetUser();
	if (!user) throw redirect(303, '/login');
	const isAdmin = locals.role === 'admin';

	// RLS returns only the user's own tokens, or everyone's for admins.
	const [tokensResult, grantsResult] = await Promise.all([
		locals.supabase
			.from('api_tokens')
			.select(
				'id, user_id, name, token_prefix, expires_at, last_used_at, revoked_at, created_at, profiles(name, email)'
			)
			.order('created_at', { ascending: false }),
		locals.supabase.auth.oauth.listGrants()
	]);

	if (tokensResult.error) {
		console.error('api_tokens load error:', tokensResult.error.message);
	}

	return {
		userId: user.id,
		isAdmin,
		mcpUrl: `${publicBaseUrl(url)}/mcp`,
		tokensEnabled: canMintUserJwt(),
		expiryOptions: API_TOKEN_EXPIRY_OPTIONS,
		tokens: (tokensResult.data ?? []).map((token) => ({
			id: token.id,
			userId: token.user_id,
			name: token.name,
			prefix: token.token_prefix,
			expiresAt: token.expires_at,
			lastUsedAt: token.last_used_at,
			revokedAt: token.revoked_at,
			createdAt: token.created_at,
			ownerName: firstOwner(token.profiles)?.name ?? null,
			ownerEmail: firstOwner(token.profiles)?.email ?? null
		})),
		// OAuth connections (claude.ai, etc.). Fails quietly while the OAuth server is off.
		oauthGrants: grantsResult.error
			? []
			: (grantsResult.data ?? []).map((grant) => ({
					clientId: grant.client.id,
					clientName: grant.client.name || 'Aplicación sin nombre',
					clientUri: grant.client.uri || null,
					scopes: grant.scopes,
					grantedAt: grant.granted_at
				})),
		oauthAvailable: !grantsResult.error
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		if (!canMintUserJwt()) {
			return fail(503, {
				createError: 'Los tokens personales todavía no están activados en el servidor.'
			});
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const expiry = String(formData.get('expiry') ?? '');
		if (!name) return fail(400, { createError: 'Ponle un nombre al token.', name, expiry });
		if (name.length > 80) {
			return fail(400, { createError: 'El nombre puede tener hasta 80 caracteres.', name, expiry });
		}
		const expiresAt = apiTokenExpiresAt(expiry);
		if (expiresAt === undefined) {
			return fail(400, { createError: 'Elige un vencimiento válido.', name, expiry });
		}

		const now = new Date().toISOString();
		const { count } = await locals.supabase
			.from('api_tokens')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user.id)
			.is('revoked_at', null)
			.or(`expires_at.is.null,expires_at.gt.${now}`);
		if ((count ?? 0) >= MAX_ACTIVE_TOKENS_PER_USER) {
			return fail(400, {
				createError: `Ya tienes ${MAX_ACTIVE_TOKENS_PER_USER} tokens activos. Revoca alguno antes de crear otro.`,
				name,
				expiry
			});
		}

		const { token, tokenHash, tokenPrefix } = generateApiToken();
		const { error } = await locals.supabase.from('api_tokens').insert({
			user_id: user.id,
			name,
			token_hash: tokenHash,
			token_prefix: tokenPrefix,
			expires_at: expiresAt
		});
		if (error) return fail(400, { createError: error.message, name, expiry });

		// The plain token leaves the server only in this response.
		return { createdToken: token, createdName: name };
	},

	revoke: async ({ locals, request }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { listError: 'Falta el token.' });

		const { data, error } = await locals.supabase
			.from('api_tokens')
			.update({ revoked_at: new Date().toISOString() })
			.eq('id', id)
			.is('revoked_at', null)
			.select('id');
		if (error) return fail(400, { listError: error.message });
		if (!data?.length)
			return fail(404, { listError: 'No se encontró el token o ya estaba revocado.' });
		return { revoked: true };
	},

	revokeGrant: async ({ locals, request }) => {
		const { user } = await locals.safeGetUser();
		if (!user) throw redirect(303, '/login');
		const clientId = String((await request.formData()).get('client_id') ?? '');
		if (!clientId) return fail(400, { grantError: 'Falta la aplicación.' });

		const { error } = await locals.supabase.auth.oauth.revokeGrant({ clientId });
		if (error) return fail(400, { grantError: error.message });
		return { grantRevoked: true };
	}
};
