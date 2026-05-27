<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { ShieldAlert, User, AlertTriangle, Shield, Check, Edit3 } from '@lucide/svelte';

	let { data, form } = $props();

	const profiles = $derived(data.profiles || []);

	// Local tracking of which user is currently being updated to render spinner/loading feedback
	let updatingUserId = $state<string | null>(null);
</script>

<svelte:head>
	<title>Panel de administración - magikalConduce</title>
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
</div>
