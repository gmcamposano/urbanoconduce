import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

/**
 * Compatibility for MCP clients that look for authorization server metadata on the
 * resource origin: mirror Supabase Auth's own metadata document.
 */
export const GET: RequestHandler = async ({ fetch }) => {
	const base = (env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
	const res = await fetch(`${base}/.well-known/oauth-authorization-server/auth/v1`);
	if (!res.ok) return json({ error: 'oauth_server_unavailable' }, { status: 502 });
	return json(await res.json(), {
		headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' }
	});
};
