import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const authorizationId = url.searchParams.get('authorization_id');
	if (!authorizationId) throw error(400, 'Falta authorization_id.');

	const { user } = await locals.safeGetUser();
	if (!user) {
		throw redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const { data, error: detailsError } =
		await locals.supabase.auth.oauth.getAuthorizationDetails(authorizationId);
	if (detailsError || !data) {
		throw error(400, detailsError?.message ?? 'Solicitud de autorización inválida o vencida.');
	}
	// Already approved before: go straight back to the client.
	if (!('authorization_id' in data)) {
		throw redirect(303, data.redirect_url);
	}
	const details = data as {
		client?: { name?: string; uri?: string };
		scope?: string;
	};

	return {
		authorizationId,
		clientName: details.client?.name || 'Aplicación sin nombre',
		clientUri: details.client?.uri || null,
		scopes: (details.scope || '').split(' ').filter(Boolean),
		email: user.email ?? '',
		role: locals.role
	};
};

async function decide(locals: App.Locals, request: Request, approve: boolean) {
	const { user } = await locals.safeGetUser();
	if (!user) throw redirect(303, '/login');
	const authorizationId = String((await request.formData()).get('authorization_id') ?? '');
	if (!authorizationId) return fail(400, { error: 'Falta authorization_id.' });

	const options = { skipBrowserRedirect: true };
	const { data, error: decisionError } = approve
		? await locals.supabase.auth.oauth.approveAuthorization(authorizationId, options)
		: await locals.supabase.auth.oauth.denyAuthorization(authorizationId, options);
	if (decisionError || !data?.redirect_url) {
		return fail(400, { error: decisionError?.message ?? 'No se pudo completar la autorización.' });
	}
	throw redirect(303, data.redirect_url);
}

export const actions: Actions = {
	approve: ({ locals, request }) => decide(locals, request, true),
	deny: ({ locals, request }) => decide(locals, request, false)
};
