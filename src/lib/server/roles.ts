export async function getUserRole(locals: App.Locals, userId: string) {
	const { data, error } = await locals.supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();

	if (error) {
		return null;
	}

	return data?.role ?? null;
}
