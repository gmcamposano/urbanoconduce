-- Personal API tokens for the MCP endpoint (/mcp).
-- Only a SHA-256 hash of each token is stored; the plain token is shown once on creation.

create table if not exists public.api_tokens (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.profiles(id) on delete cascade,
	name text not null check (char_length(btrim(name)) between 1 and 80),
	token_prefix text not null,
	token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
	expires_at timestamptz,
	last_used_at timestamptz,
	revoked_at timestamptz,
	created_at timestamptz not null default now()
);

create index if not exists api_tokens_user_id_idx on public.api_tokens using btree (user_id);

alter table public.api_tokens enable row level security;

-- Owners see their tokens; admins see everyone's.
create policy "Read own api tokens or all as admin"
	on public.api_tokens
	for select
	to authenticated
	using (
		user_id = (select auth.uid())
		or (select private.get_user_role()) = 'admin'
	);

-- Users can only create tokens for themselves, never pre-revoked or pre-used.
create policy "Create own api tokens"
	on public.api_tokens
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		and revoked_at is null
		and last_used_at is null
	);

-- Revoking: owners revoke their own tokens, admins revoke anyone's.
create policy "Revoke own api tokens or any as admin"
	on public.api_tokens
	for update
	to authenticated
	using (
		user_id = (select auth.uid())
		or (select private.get_user_role()) = 'admin'
	)
	with check (
		user_id = (select auth.uid())
		or (select private.get_user_role()) = 'admin'
	);

-- Only revoked_at may change from the client side; nothing can be deleted.
revoke all on table public.api_tokens from anon, authenticated;
grant select, insert on table public.api_tokens to authenticated;
grant update (revoked_at) on table public.api_tokens to authenticated;

-- Resolves a token hash to its owner for the MCP endpoint, and records the use.
-- SECURITY DEFINER: the caller has no session yet (anon), so RLS cannot apply here.
-- Knowing a valid hash requires the 256-bit random token, so this leaks nothing guessable.
create or replace function public.resolve_api_token(p_token_hash text)
returns table (user_id uuid, email text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_token public.api_tokens%rowtype;
begin
	select t.* into v_token
	from public.api_tokens t
	where t.token_hash = p_token_hash
		and t.revoked_at is null
		and (t.expires_at is null or t.expires_at > now());

	if not found then
		return;
	end if;

	-- Throttle writes: one last_used_at update per minute at most.
	if v_token.last_used_at is null or v_token.last_used_at < now() - interval '1 minute' then
		update public.api_tokens set last_used_at = now() where id = v_token.id;
	end if;

	return query
		select p.id, p.email, p.role
		from public.profiles p
		where p.id = v_token.user_id;
end;
$$;

revoke all on function public.resolve_api_token(text) from public;
grant execute on function public.resolve_api_token(text) to anon, authenticated;
