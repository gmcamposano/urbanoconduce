import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { RequestHandler } from './$types';
import { authenticateMcpRequest, protectedResourceMetadataUrl } from '$lib/server/mcp/auth';
import { buildMcpServer } from '$lib/server/mcp/tools';

function unauthorized(url: URL) {
	return new Response(JSON.stringify({ error: 'unauthorized' }), {
		status: 401,
		headers: {
			'content-type': 'application/json',
			'www-authenticate': `Bearer resource_metadata="${protectedResourceMetadataUrl(url)}"`
		}
	});
}

/** Stateless Streamable HTTP: each POST builds a server bound to the caller's Supabase session. */
export const POST: RequestHandler = async ({ request, url }) => {
	const ctx = await authenticateMcpRequest(request);
	if (!ctx) return unauthorized(url);

	const server = buildMcpServer(ctx);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	await server.connect(transport);
	try {
		return await transport.handleRequest(request);
	} finally {
		void server.close();
	}
};

const methodNotAllowed: RequestHandler = async ({ request, url }) => {
	if (!request.headers.get('authorization')) return unauthorized(url);
	return new Response(null, { status: 405, headers: { allow: 'POST' } });
};

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
