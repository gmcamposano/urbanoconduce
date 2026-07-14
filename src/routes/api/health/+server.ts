import { env } from '$env/dynamic/public';

export function GET() {
	const hasSupabaseCreds =
		env.PUBLIC_SUPABASE_URL?.startsWith('http') &&
		env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.length > 20;

	return new Response('OK', {
		status: 200,
		headers: { 'x-supabase-configured': String(hasSupabaseCreds) }
	});
}
