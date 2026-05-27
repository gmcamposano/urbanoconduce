<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { 
		ShieldAlert, 
		User, 
		AlertTriangle, 
		Shield, 
		Check,
		Edit3
	} from '@lucide/svelte';

	let { data, form } = $props();

	const profiles = $derived(data.profiles || []);
	
	// Local tracking of which user is currently being updated to render spinner/loading feedback
	let updatingUserId = $state<string | null>(null);
</script>

<svelte:head>
	<title>Panel de administración - FacturaFlow</title>
</svelte:head>

<div class="space-y-6 flex-1 flex flex-col justify-start">
	<!-- Header title -->
	<div class="border-b border-zinc-900 pb-5">
		<h1 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
			<ShieldAlert class="h-6 w-6 text-indigo-500" />
			Panel de control del sistema
		</h1>
		<p class="text-zinc-500 text-xs mt-0.5">Gestiona permisos de usuarios y configura roles globales del sistema.</p>
	</div>

	<!-- Alert Messages -->
	{#if form?.success}
		<div class="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-400 flex items-start gap-2.5 shadow-lg shadow-emerald-500/5">
			<Check class="h-5 w-5 flex-shrink-0 text-emerald-400 mt-0.5" />
			<div>
				<p class="font-bold">Rol actualizado</p>
				<p class="text-xs text-zinc-400 mt-0.5">El rol del usuario se actualizó y quedó aplicado en las políticas de seguridad.</p>
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm text-rose-400 flex items-start gap-2.5 shadow-lg shadow-rose-500/5">
			<AlertTriangle class="h-5 w-5 flex-shrink-0 text-rose-400 mt-0.5" />
			<div>
				<p class="font-bold">La operación falló</p>
				<p class="text-xs text-zinc-400 mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Informative card explaining roles -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
		<Card class="border-zinc-900 bg-zinc-950/20">
			<CardContent class="p-6 space-y-2">
				<Badge variant="danger">ADMIN</Badge>
				<p class="text-sm font-bold text-white mt-2">Control administrativo total</p>
				<p class="text-xs text-zinc-500 leading-relaxed">
					Puede leer y editar todas las facturas, eliminar registros históricos y cambiar el rol de cualquier usuario.
				</p>
			</CardContent>
		</Card>

		<Card class="border-zinc-900 bg-zinc-950/20">
			<CardContent class="p-6 space-y-2">
				<Badge variant="info">EDITOR</Badge>
				<p class="text-sm font-bold text-white mt-2">Editor de facturación</p>
				<p class="text-xs text-zinc-500 leading-relaxed">
					Puede crear, editar y ver facturas y sus líneas. No puede eliminar ni acceder a esta sección.
				</p>
			</CardContent>
		</Card>

		<Card class="border-zinc-900 bg-zinc-950/20">
			<CardContent class="p-6 space-y-2">
				<Badge variant="secondary">VIEWER</Badge>
				<p class="text-sm font-bold text-white mt-2">Vista de solo lectura</p>
				<p class="text-xs text-zinc-500 leading-relaxed">
					Sólo tiene acceso de lectura a las facturas. No puede crear, editar ni eliminar nada.
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Profiles list -->
	<Card class="border-zinc-900 bg-zinc-950/15">
		<div class="overflow-x-auto w-full">
			<table class="w-full text-sm text-left text-zinc-300">
				<thead class="text-xs uppercase bg-zinc-950 text-zinc-500 border-b border-zinc-900 tracking-wider">
					<tr>
					<th class="px-6 py-4 font-bold">Identidad</th>
					<th class="px-6 py-4 font-bold">Correo electrónico</th>
					<th class="px-6 py-4 font-bold">Rol actual</th>
					<th class="px-6 py-4 font-bold text-right">Editar permiso / asignar rol</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-900/60">
					{#each profiles as item (item.id)}
						<tr class="hover:bg-zinc-900/35 transition-colors duration-150">
							<td class="px-6 py-4 whitespace-nowrap font-bold text-white">
								<div class="flex items-center gap-2.5">
									<div class="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
										<User class="h-4 w-4 text-indigo-400" />
									</div>
									<span>{item.name || 'Nuevo usuario'}</span>
									{#if data.user?.id === item.id}
											<Badge variant="outline" class="text-[9px] px-1 py-0 border-indigo-500/20 text-indigo-400">TÚ</Badge>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap font-mono text-xs text-zinc-400">
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
										<span class="text-xs text-zinc-500 font-semibold px-4">La autogestión está deshabilitada</span>
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
						class="flex h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 cursor-pointer"
						>
											<option value="viewer" selected={item.role === 'viewer'}>Lector (solo lectura)</option>
											<option value="editor" selected={item.role === 'editor'}>Editor (crear/editar)</option>
											<option value="admin" selected={item.role === 'admin'}>Administrador (control total)</option>
										</select>
										
										<Button 
											type="submit" 
											variant="secondary" 
											size="sm" 
											class="h-8 text-xs font-semibold px-2.5"
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
