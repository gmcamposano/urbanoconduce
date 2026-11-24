import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/database.types';
import { canMintUserJwt, hashApiToken, isApiToken, mintUserJwt } from '$lib/server/apiTokens';

export type McpRole = 'admin' | 'editor' | 'viewer';

export type McpContext = {
	supabase: SupabaseClient<Database>;
	user: User;
	role: McpRole | null;
};

export function supabaseAuthIssuer() {
	return `${(env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/auth/v1`;
}

/** Public base URL of this app (for OAuth metadata). Falls back to the request origin. */
export function publicBaseUrl(url: URL) {
	const site = env.PUBLIC_SITE_URL;
	return (site && site.startsWith('http') ? site : url.origin).replace(/\/$/, '');
}

export function protectedResourceMetadataUrl(url: URL) {
	return `${publicBaseUrl(url)}/.well-known/oauth-protected-resource/mcp`;
}

function supabaseAs(accessToken: string | null) {
	return createClient<Database>(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
		global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}

/**
 * A personal token (uc_…) from /dashboard/tokens: resolve its owner in the database,
 * then mint a short Supabase JWT for that user so RLS applies as in the web app.
 */
async function authenticateApiToken(token: string): Promise<McpContext | null> {
	if (!canMintUserJwt()) {
		console.error('MCP: personal token received but no JWT signing key is configured.');
		return null;
	}

	const { data, error } = await supabaseAs(null).rpc('resolve_api_token', {
		p_token_hash: hashApiToken(token)
	});
	const owner = data?.[0];
	if (error || !owner) return null;

	const supabase = supabaseAs(mintUserJwt({ id: owner.user_id, email: owner.email }));
	const user = { id: owner.user_id, email: owner.email } as User;
	return { supabase, user, role: owner.role as McpRole };
}

/**
 * Turns a Bearer token into a Supabase client that acts as that user, so RLS applies.
 * Accepts Supabase access tokens (OAuth server or a normal session) and personal tokens.
 */
export async function authenticateMcpRequest(request: Request): Promise<McpContext | null> {
	const header = request.headers.get('authorization') ?? '';
	const match = /^Bearer\s+(.+)$/i.exec(header);
	const token = match?.[1]?.trim();
	if (!token || !env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;

	if (isApiToken(token)) return authenticateApiToken(token);

	const supabase = supabaseAs(token);

	const {
		data: { user },
		error
	} = await supabase.auth.getUser(token);
	if (error || !user) return null;

	const { data: profile } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.maybeSingle();

	const role = (profile?.role ?? null) as McpRole | null;
	return { supabase, user, role };
}
