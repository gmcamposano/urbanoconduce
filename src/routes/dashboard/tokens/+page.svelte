<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { KeyRound, Plug, Copy, Check, AlertTriangle, Plus, Ban } from '@lucide/svelte';

	let { data, form } = $props();

	let creating = $state(false);
	let revokingId = $state<string | null>(null);
	let revokingClientId = $state<string | null>(null);
	let copied = $state<string | null>(null);

	const dateFormat = new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' });
	const dateTimeFormat = new Intl.DateTimeFormat('es-DO', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	function formatDate(value: string | null) {
		return value ? dateFormat.format(new Date(value)) : '—';
	}

	function formatDateTime(value: string | null) {
		return value ? dateTimeFormat.format(new Date(value)) : 'Nunca';
	}

	function tokenStatus(token: { revokedAt: string | null; expiresAt: string | null }) {
		if (token.revokedAt) return 'revoked';
		if (token.expiresAt && new Date(token.expiresAt) <= new Date()) return 'expired';
		return 'active';
	}

	async function copy(text: string, key: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => {
			if (copied === key) copied = null;
		}, 2000);
	}

	const claudeCodeCommand = $derived(
		form?.createdToken
			? `claude mcp add --transport http conduce ${data.mcpUrl} --header "Authorization: Bearer ${form.createdToken}"`
			: ''
	);
</script>

<svelte:head>
	<title>Tokens y conexiones - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<KeyRound class="h-6 w-6 text-[#3ecf8e]" />
			Tokens y conexiones
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Conecta Claude u otras herramientas a tus proformas, pagos y facturas. Cada acceso tiene tus
			mismos permisos.
		</p>
	</div>

	<!-- How to connect -->
	<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
		<Card class="bg-white">
			<CardContent class="space-y-2 p-6">
				<Badge variant="success">Recomendado</Badge>
				<p class="mt-2 text-sm font-medium">claude.ai y Claude Desktop</p>
				<p class="text-xs leading-relaxed text-[#707070]">
					En Ajustes → Conectores → Agregar conector personalizado, pega esta dirección. Claude te
					pedirá iniciar sesión aquí; no necesitas token.
				</p>
				<div class="flex items-center gap-2 pt-1">
					<code
						class="min-w-0 flex-1 truncate rounded-[6px] border border-[#dfdfdf] bg-[#fafafa] px-3 py-2 font-mono text-xs"
						>{data.mcpUrl}</code
					>
					<Button variant="outline" size="sm" onclick={() => copy(data.mcpUrl, 'url')}>
						{#if copied === 'url'}<Check class="h-3.5 w-3.5" />{:else}<Copy
								class="h-3.5 w-3.5"
							/>{/if}
						Copiar
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card class="bg-white">
			<CardContent class="space-y-2 p-6">
				<Badge variant="outline">Token personal</Badge>
				<p class="mt-2 text-sm font-medium">Claude Code, scripts y otras apps</p>
				<p class="text-xs leading-relaxed text-[#707070]">
					Crea un token abajo y envíalo en el encabezado
					<code class="font-mono">Authorization: Bearer …</code>. Trátalo como una contraseña: quien
					lo tenga actúa con tu cuenta.
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Token just created: shown once -->
	{#if form?.createdToken}
		<div class="space-y-3 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 shadow-sm">
			<div class="flex items-start gap-2.5">
				<Check class="mt-0.5 h-5 w-5 shrink-0 text-[#24b47e]" />
				<div>
					<p class="text-sm font-medium">Token «{form.createdName}» creado</p>
					<p class="mt-0.5 text-xs text-[#707070]">
						Cópialo ahora. Por seguridad no se vuelve a mostrar.
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<code
					class="min-w-0 flex-1 overflow-x-auto rounded-[6px] bg-[#171717] px-3 py-2 font-mono text-xs whitespace-nowrap text-white"
					>{form.createdToken}</code
				>
				<Button size="sm" onclick={() => copy(form.createdToken, 'token')}>
					{#if copied === 'token'}<Check class="h-3.5 w-3.5" />{:else}<Copy
							class="h-3.5 w-3.5"
						/>{/if}
					Copiar
				</Button>
			</div>
			<div class="space-y-1">
				<p class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase">
					Para Claude Code
				</p>
				<div class="flex items-center gap-2">
					<code
						class="min-w-0 flex-1 overflow-x-auto rounded-[6px] bg-[#171717] px-3 py-2 font-mono text-xs whitespace-nowrap text-white"
						>{claudeCodeCommand}</code
					>
					<Button variant="outline" size="sm" onclick={() => copy(claudeCodeCommand, 'command')}>
						{#if copied === 'command'}<Check class="h-3.5 w-3.5" />{:else}<Copy
								class="h-3.5 w-3.5"
							/>{/if}
						Copiar
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Personal tokens -->
	<Card class="bg-white">
		<CardContent class="space-y-5 p-6">
			<div>
				<h2 class="text-base font-medium">
					{data.isAdmin ? 'Tokens personales (todos los usuarios)' : 'Tus tokens personales'}
				</h2>
				<p class="mt-0.5 text-xs text-[#707070]">
					Puedes revocar un token en cualquier momento; deja de funcionar al instante.
				</p>
			</div>

			{#if !data.tokensEnabled}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-[#fde047] bg-[#fef9c3] p-4 text-sm"
				>
					<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
					<p class="text-xs">
						Los tokens personales todavía no están activados en el servidor. Usa la conexión de
						claude.ai mientras tanto.
					</p>
				</div>
			{:else}
				<form
					method="POST"
					action="?/create"
					class="flex flex-col gap-3 md:flex-row md:items-end"
					use:enhance={() => {
						creating = true;
						return async ({ update }) => {
							await update();
							creating = false;
						};
					}}
				>
					<div class="md:flex-1">
						<Input
							label="Nombre"
							name="name"
							placeholder="Ej.: Claude Code en mi laptop"
							maxlength={80}
							required
							value={form && 'name' in form ? (form.name ?? '') : ''}
						/>
					</div>
					<div class="md:w-48">
						<Select
							label="Vence"
							name="expiry"
							value={form && 'expiry' in form ? form.expiry || '90' : '90'}
						>
							{#each data.expiryOptions as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</Select>
					</div>
					<Button type="submit" disabled={creating}>
						<Plus class="h-4 w-4" />
						{creating ? 'Creando…' : 'Crear token'}
					</Button>
				</form>
				{#if form?.createError}
					<p class="text-xs font-medium text-[#e2005a]">{form.createError}</p>
				{/if}
			{/if}

			{#if form?.listError}
				<p class="text-xs font-medium text-[#e2005a]">{form.listError}</p>
			{/if}

			{#if data.tokens.length === 0}
				<p
					class="rounded-xl border border-dashed border-[#dfdfdf] p-6 text-center text-xs text-[#707070]"
				>
					Todavía no hay tokens.
				</p>
			{:else}
				<div class="overflow-x-auto rounded-xl border border-[#ededed]">
					<table class="w-full text-left text-sm">
						<thead class="bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase">
							<tr>
								<th class="px-4 py-3 font-medium">Nombre</th>
								{#if data.isAdmin}<th class="px-4 py-3 font-medium">Usuario</th>{/if}
								<th class="px-4 py-3 font-medium">Token</th>
								<th class="px-4 py-3 font-medium">Creado</th>
								<th class="px-4 py-3 font-medium">Último uso</th>
								<th class="px-4 py-3 font-medium">Vence</th>
								<th class="px-4 py-3 font-medium">Estado</th>
								<th class="px-4 py-3 text-right font-medium"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#each data.tokens as token (token.id)}
								{@const status = tokenStatus(token)}
								<tr class={status === 'active' ? '' : 'text-[#9a9a9a]'}>
									<td class="px-4 py-3 font-medium">{token.name}</td>
									{#if data.isAdmin}
										<td class="px-4 py-3 text-xs">
											{token.ownerName || token.ownerEmail || '—'}
											{#if token.userId === data.userId}<span class="text-[#9a9a9a]">(tú)</span
												>{/if}
										</td>
									{/if}
									<td class="px-4 py-3 font-mono text-xs whitespace-nowrap">{token.prefix}…</td>
									<td class="px-4 py-3 text-xs whitespace-nowrap">{formatDate(token.createdAt)}</td>
									<td class="px-4 py-3 text-xs whitespace-nowrap">
										{formatDateTime(token.lastUsedAt)}
									</td>
									<td class="px-4 py-3 text-xs whitespace-nowrap">
										{token.expiresAt ? formatDate(token.expiresAt) : 'Nunca'}
									</td>
									<td class="px-4 py-3">
										{#if status === 'active'}
											<Badge variant="success">Activo</Badge>
										{:else if status === 'expired'}
											<Badge variant="outline">Vencido</Badge>
										{:else}
											<Badge variant="danger">Revocado</Badge>
										{/if}
									</td>
									<td class="px-4 py-3 text-right">
										{#if status === 'active'}
											<form
												method="POST"
												action="?/revoke"
												use:enhance={({ cancel }) => {
													if (
														!confirm(
															`¿Revocar el token «${token.name}»? Deja de funcionar al instante.`
														)
													) {
														cancel();
														return;
													}
													revokingId = token.id;
													return async ({ update }) => {
														await update();
														revokingId = null;
													};
												}}
											>
												<input type="hidden" name="id" value={token.id} />
												<Button
													type="submit"
													variant="outline"
													size="sm"
													disabled={revokingId === token.id}
												>
													<Ban class="h-3.5 w-3.5" />
													{revokingId === token.id ? 'Revocando…' : 'Revocar'}
												</Button>
											</form>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- OAuth connections -->
	<Card class="bg-white">
		<CardContent class="space-y-5 p-6">
			<div>
				<h2 class="flex items-center gap-2 text-base font-medium">
					<Plug class="h-4.5 w-4.5 text-[#707070]" />
					Aplicaciones conectadas
				</h2>
				<p class="mt-0.5 text-xs text-[#707070]">
					Apps que autorizaste iniciando sesión (por ejemplo, claude.ai). Al desconectar una, pierde
					el acceso y tendría que pedirte permiso de nuevo.
				</p>
			</div>

			{#if form?.grantError}
				<p class="text-xs font-medium text-[#e2005a]">{form.grantError}</p>
			{/if}

			{#if !data.oauthAvailable}
				<p
					class="rounded-xl border border-dashed border-[#dfdfdf] p-6 text-center text-xs text-[#707070]"
				>
					Las conexiones por inicio de sesión todavía no están activadas.
				</p>
			{:else if data.oauthGrants.length === 0}
				<p
					class="rounded-xl border border-dashed border-[#dfdfdf] p-6 text-center text-xs text-[#707070]"
				>
					No tienes aplicaciones conectadas.
				</p>
			{:else}
				<ul class="divide-y divide-[#ededed] rounded-xl border border-[#ededed]">
					{#each data.oauthGrants as grant (grant.clientId)}
						<li class="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
							<div class="min-w-0">
								<p class="text-sm font-medium">{grant.clientName}</p>
								<p class="mt-0.5 text-xs text-[#707070]">
									Conectada el {formatDateTime(grant.grantedAt)}
									{#if grant.clientUri}· {grant.clientUri}{/if}
								</p>
							</div>
							<form
								method="POST"
								action="?/revokeGrant"
								use:enhance={({ cancel }) => {
									if (!confirm(`¿Desconectar «${grant.clientName}»?`)) {
										cancel();
										return;
									}
									revokingClientId = grant.clientId;
									return async ({ update }) => {
										await update();
										revokingClientId = null;
									};
								}}
							>
								<input type="hidden" name="client_id" value={grant.clientId} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									disabled={revokingClientId === grant.clientId}
								>
									<Ban class="h-3.5 w-3.5" />
									{revokingClientId === grant.clientId ? 'Desconectando…' : 'Desconectar'}
								</Button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</CardContent>
	</Card>
</div>
