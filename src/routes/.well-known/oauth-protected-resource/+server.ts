import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { publicBaseUrl, supabaseAuthIssuer } from '$lib/server/mcp/auth';

/** RFC 9728: tells MCP clients that Supabase Auth issues tokens for /mcp. */
export const GET: RequestHandler = ({ url }) =>
	json(
		{
			resource: `${publicBaseUrl(url)}/mcp`,
			authorization_servers: [supabaseAuthIssuer()],
			bearer_methods_supported: ['header'],
			resource_name: 'magikalInvoice'
		},
		{ headers: { 'access-control-allow-origin': '*' } }
	);
