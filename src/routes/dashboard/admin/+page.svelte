<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { ShieldAlert, User, AlertTriangle, Shield, Check, Edit3, Mail, Plus, Trash2 } from '@lucide/svelte';

	let { data, form } = $props();

	const profiles = $derived(data.profiles || []);
	const allowedEmails = $derived(data.allowedEmails || []);

	let updatingUserId = $state<string | null>(null);
	let addingEmail = $state(false);
	let deletingEmailId = $state<string | null>(null);

	const emailForm = $derived(form?.emailError ? form.emailError : null);
	const emailSuccess = $derived(form?.emailSuccess ? true : null);
</script>

<svelte:head>
	<title>Panel de administración - magikalConduce | magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<!-- Header title -->
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<ShieldAlert class="h-6 w-6 text-[#3ecf8e]" />
			Panel de control del sistema
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Gestiona permisos de usuarios y configura roles globales del sistema.
		</p>
	</div>

	<!-- Alert Messages -->
	{#if form?.success}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717] shadow-sm"
		>
			<Check class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#24b47e]" />
			<div>
				<p class="font-medium">Rol actualizado</p>
				<p class="mt-0.5 text-xs text-[#707070]">
					El rol del usuario se actualizó y quedó aplicado en las políticas de seguridad.
				</p>
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#e2005a]" />
			<div>
				<p class="font-medium">La operación falló</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Informative card explaining roles -->
	<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
		<Card class="bg-white">
			<CardContent class="space-y-2 p-6">
				<Badge variant="danger">ADMIN</Badge>
				<p class="mt-2 text-sm font-medium text-[#171717]">Control administrativo total</p>
				<p class="text-xs leading-relaxed text-[#707070]">
					Puede leer y editar todas las facturas, eliminar registros históricos y cambiar el rol de
					cualquier usuario.
				</p>
			</CardContent>
		</Card>

		<Card class="bg-white">
			<CardContent class="space-y-2 p-6">
				<Badge variant="info">EDITOR</Badge>
				<p class="mt-2 text-sm font-medium text-[#171717]">Editor de facturación</p>
				<p class="text-xs leading-relaxed text-[#707070]">
					Puede crear, editar y ver facturas y sus líneas. No puede eliminar ni acceder a esta
					sección.
				</p>
			</CardContent>
		</Card>

		<Card class="bg-white">
			<CardContent class="space-y-2 p-6">
				<Badge variant="secondary">VIEWER</Badge>
				<p class="mt-2 text-sm font-medium text-[#171717]">Vista de solo lectura</p>
				<p class="text-xs leading-relaxed text-[#707070]">
					Sólo tiene acceso de lectura a las facturas. No puede crear, editar ni eliminar nada.
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Profiles list -->
	<Card class="bg-white">
		<div class="w-full overflow-x-auto">
			<table class="w-full text-left text-sm text-[#171717]">
				<thead
					class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
				>
					<tr>
						<th class="px-6 py-4 font-bold">Identidad</th>
						<th class="px-6 py-4 font-bold">Correo electrónico</th>
						<th class="px-6 py-4 font-bold">Rol actual</th>
						<th class="px-6 py-4 text-right font-bold">Editar permiso / asignar rol</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[#ededed]">
					{#each profiles as item (item.id)}
						<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
							<td class="px-6 py-4 font-medium whitespace-nowrap text-[#171717]">
								<div class="flex items-center gap-2.5">
									<div
										class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] border border-[#ededed] bg-[#fafafa]"
									>
										<User class="h-4 w-4 text-[#707070]" />
									</div>
									<span>{item.name || 'Nuevo usuario'}</span>
									{#if data.user?.id === item.id}
										<Badge variant="outline" class="px-1 py-0 text-[9px]">TÚ</Badge>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 font-mono text-xs whitespace-nowrap text-[#707070]">
								{item.email}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if item.role === 'admin'}
									<Badge variant="danger">ADMIN</Badge>
								{:else if item.role === 'editor'}
									<Badge variant="info">EDITOR</Badge>
								{:else}
									<Badge variant="secondary">LECTOR</Badge>
								{/if}
							</td>
							<td class="px-6 py-4 text-right whitespace-nowrap">
								<!-- Disable actions for self to prevent locking self out -->
								{#if data.user?.id === item.id}
									<span class="px-4 text-xs font-medium text-[#707070]"
										>La autogestión está deshabilitada</span
									>
								{:else}
									<form
										action="?/updateRole"
										method="POST"
										class="inline-flex items-center gap-1.5"
										use:enhance={() => {
											updatingUserId = item.id;
											return async ({ update }) => {
												updatingUserId = null;
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={item.id} />
										<select
											name="role"
											disabled={updatingUserId !== null}
											class="flex h-8 cursor-pointer rounded-[6px] border border-[#dfdfdf] bg-white px-2.5 py-1 text-xs text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e] focus-visible:outline-none"
										>
											<option value="viewer" selected={item.role === 'viewer'}
												>Lector (solo lectura)</option
											>
											<option value="editor" selected={item.role === 'editor'}
												>Editor (crear/editar)</option
											>
											<option value="admin" selected={item.role === 'admin'}
												>Administrador (control total)</option
											>
										</select>

										<Button
											type="submit"
											variant="secondary"
											size="sm"
											class="h-8 px-2.5 text-xs font-semibold"
											disabled={updatingUserId !== null}
										>
											{#if updatingUserId === item.id}
												Guardando...
											{:else}
												Aplicar
											{/if}
										</Button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>

	<!-- Allowed Emails Management -->
	<Card class="bg-white">
		<CardHeader>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Mail class="h-5 w-5 text-[#3ecf8e]" />
					<CardTitle class="text-lg">Correos electrónicos autorizados</CardTitle>
				</div>
				<Button
					variant="secondary"
					size="sm"
					class="h-8 gap-1.5 px-3"
					onclick={() => (addingEmail = !addingEmail)}
				>
					<Plus class="h-4 w-4" />
					Agregar patrón
				</Button>
			</div>
			<p class="mt-1 text-xs text-[#707070]">
				Define los dominios o correos que pueden registrarse en el sistema. Si la lista está vacía, cualquier correo es aceptado.
			</p>
		</CardHeader>

		{#if emailSuccess}
			<div class="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717]">
				<Check class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#24b47e]" />
				<div>
					<p class="font-medium">Operación exitosa</p>
					<p class="mt-0.5 text-xs text-[#707070]">El patrón de correo fue actualizado.</p>
				</div>
			</div>
		{/if}

		{#if emailForm}
			<div class="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a]">
				<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#e2005a]" />
				<div>
					<p class="font-medium">La operación falló</p>
					<p class="mt-0.5 text-xs text-[#e2005a]">{emailForm}</p>
				</div>
			</div>
		{/if}

		{#if addingEmail}
			<CardContent class="border-t border-[#ededed] pt-4">
				<form
					action="?/addAllowedEmail"
					method="POST"
					class="flex flex-col gap-3 rounded-lg border border-[#ededed] bg-[#fafafa] p-4 sm:flex-row sm:items-end"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							addingEmail = false;
						};
					}}
				>
					<div class="flex-1">
						<label class="mb-1 block text-xs font-medium text-[#707070]" for="pattern">
							Patrón de correo
						</label>
						<input
							id="pattern"
							name="pattern"
							type="text"
							placeholder="@empresa.com o usuario@empresa.com"
							class="h-9 w-full rounded-[6px] border border-[#dfdfdf] bg-white px-3 text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e] focus-visible:outline-none"
							required
						/>
					</div>
					<div class="w-full sm:w-40">
						<label class="mb-1 block text-xs font-medium text-[#707070]" for="pattern_type">Tipo</label>
						<select
							id="pattern_type"
							name="pattern_type"
							class="h-9 w-full rounded-[6px] border border-[#dfdfdf] bg-white px-3 text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e] focus-visible:outline-none"
						>
							<option value="domain">Solo dominio</option>
							<option value="full_email">Correo completo</option>
						</select>
					</div>
					<div class="flex-1">
						<label class="mb-1 block text-xs font-medium text-[#707070]" for="description">
							Descripción (opcional)
						</label>
						<input
							id="description"
							name="description"
							type="text"
							placeholder="Ej: empleados de la empresa"
							class="h-9 w-full rounded-[6px] border border-[#dfdfdf] bg-white px-3 text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e] focus-visible:outline-none"
						/>
					</div>
					<div class="flex gap-2">
						<Button type="submit" variant="default" size="sm" class="h-9 px-4">Agregar</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							class="h-9 px-4"
							onclick={() => (addingEmail = false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</CardContent>
		{/if}

		{#if allowedEmails.length === 0}
			<CardContent class="py-8 text-center">
				<Mail class="mx-auto h-8 w-8 text-[#b2b2b2]" />
				<p class="mt-2 text-sm text-[#707070]">No hay patrones de correo autorizados.</p>
				<p class="text-xs text-[#9a9a9a]">Agrega un dominio para restringir el registro a ciertos correos.</p>
			</CardContent>
		{:else}
			<div class="w-full overflow-x-auto">
				<table class="w-full text-left text-sm text-[#171717]">
					<thead
						class="border-t border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
					>
						<tr>
							<th class="px-6 py-3 font-bold">Patrón</th>
							<th class="px-6 py-3 font-bold">Tipo</th>
							<th class="px-6 py-3 font-bold">Descripción</th>
							<th class="px-6 py-3 font-bold">Estado</th>
							<th class="px-6 py-3 text-right font-bold">Eliminar</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[#ededed]">
						{#each allowedEmails as item (item.id)}
							<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
								<td class="px-6 py-4 font-mono text-xs text-[#707070]">{item.pattern}</td>
								<td class="px-6 py-4">
									<Badge variant={item.pattern_type === 'domain' ? 'info' : 'secondary'}>
										{item.pattern_type === 'domain' ? 'Dominio' : 'Correo completo'}
									</Badge>
								</td>
								<td class="px-6 py-4 text-xs text-[#707070]">{item.description || '—'}</td>
								<td class="px-6 py-4">
									<Badge variant={item.is_active ? 'success' : 'danger'}>
										{item.is_active ? 'Activo' : 'Inactivo'}
									</Badge>
								</td>
								<td class="px-6 py-4 text-right">
									<form
										action="?/deleteAllowedEmail"
										method="POST"
										class="inline-flex"
										use:enhance={() => {
											deletingEmailId = item.id;
											return async ({ update }) => {
												deletingEmailId = null;
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={item.id} />
										<Button
											type="submit"
variant="destructive"
											size="sm"
											class="h-8 px-2.5"
											disabled={deletingEmailId !== null}
										>
											{#if deletingEmailId === item.id}
												Eliminando...
											{:else}
												<Trash2 class="h-4 w-4" />
											{/if}
										</Button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
