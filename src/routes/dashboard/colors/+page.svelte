<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { AlertTriangle, Droplets, Edit3, Palette, Trash2 } from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const colors = $derived(data.colors || []);

	let loading = $state(false);
	let deleteLoadingId = $state<string | null>(null);
	let colorToDelete = $state<{ id: string; color: string } | null>(null);
	let deleteConfirmText = $state('');
	let editingColor = $state<{ id: string; color: string } | null>(null);
	let color = $state('');

	function startEditing(item: (typeof colors)[number]) {
		editingColor = item;
		color = item.color;
	}

	function resetForm() {
		editingColor = null;
		color = '';
	}
</script>

<svelte:head>
	<title>Colores - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Palette class="h-6 w-6 text-[#3ecf8e]" />
			Colores
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Define los colores disponibles para asignar a productos.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Droplets class="mt-0.5 h-5 w-5 flex-shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar el color</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717] shadow-sm"
		>
			<Droplets class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#24b47e]" />
			<div>
				<p class="font-medium">{form.message || 'Color guardado'}</p>
				<p class="mt-0.5 text-xs text-[#707070]">Ya está disponible para productos.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>{editingColor ? 'Editar color' : 'Nuevo color'}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action={editingColor ? '?/updateColor' : '?/createColor'}
					method="POST"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						return async ({ result, update }) => {
							loading = false;
							if (result.type === 'success') {
								resetForm();
							}
							await update();
						};
					}}
				>
					{#if editingColor}
						<input type="hidden" name="id" value={editingColor.id} />
					{/if}

					<Input
						label="Color"
						name="color"
						type="text"
						placeholder="Azul, ciruela, verde oliva"
						bind:value={color}
						class="capitalize"
						required
						disabled={loading}
					/>

					<div
						class="flex items-center gap-3 rounded-[6px] border border-[#ededed] bg-[#fafafa] px-3 py-2 text-xs text-[#707070]"
					>
						<span
							class="inline-flex h-5 items-center rounded-[4px] border border-[#dfdfdf] bg-white px-2 font-mono text-[10px] text-[#171717]"
							>Texto</span
						>
						<p>Escribe el nombre del color manualmente, por ejemplo azul o ciruela.</p>
					</div>

					<div class="flex gap-3">
						<Button type="submit" class="flex-1" disabled={loading}>
							{editingColor ? 'Actualizar color' : 'Guardar color'}
						</Button>
						{#if editingColor}
							<Button type="button" variant="outline" disabled={loading} onclick={resetForm}
								>Cancelar</Button
							>
						{/if}
					</div>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Colores disponibles</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-16 px-6 py-4 font-bold">#</th>
								<th class="px-6 py-4 font-bold">Color</th>
								{#if canManage}
									<th class="px-6 py-4 text-right font-bold">Acciones</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if colors.length === 0}
								<tr>
									<td
										colspan={canManage ? 3 : 2}
										class="px-6 py-12 text-center text-xs text-[#707070]"
										>Aún no hay colores registrados.</td
									>
								</tr>
							{:else}
								{#each colors as item, index (item.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-mono text-xs text-[#707070]">{index + 1}</td>
										<td class="px-6 py-4 text-xs text-[#171717] capitalize">{item.color}</td>
										{#if canManage}
											<td class="px-6 py-4 text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-1.5">
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#171717]"
														title="Editar color"
														onclick={() => startEditing(item)}
													>
														<Edit3 class="h-4 w-4" />
													</Button>
													<form
														action="?/deleteColor"
														method="POST"
														class="contents"
														use:enhance={() => {
															deleteLoadingId = item.id;
															return async ({ result, update }) => {
																deleteLoadingId = null;
																colorToDelete = null;
																deleteConfirmText = '';
																await update();
															};
														}}
													>
														<input type="hidden" name="id" value={item.id} />
														<Button
															type="submit"
															variant="ghost"
															size="icon"
															class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
															title="Borrar color"
															disabled={deleteLoadingId === item.id}
															onclick={() => {
																colorToDelete = item;
																deleteConfirmText = '';
															}}
														>
															<Trash2 class="h-4 w-4" />
														</Button>
													</form>
												</div>
											</td>
										{/if}
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	</div>

<!-- Delete Confirmation Modal -->
{#if colorToDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
		<Card class="w-full max-w-sm">
			<CardContent class="space-y-4 p-6">
				<div class="flex items-center gap-2.5 text-[#e2005a]">
					<AlertTriangle class="h-6 w-6" />
					<h3 class="text-lg font-medium">Confirmar eliminación</h3>
				</div>

				<p class="text-sm leading-relaxed text-[#707070]">
					¿Seguro que deseas eliminar el color <strong class="text-[#171717] capitalize"
						>{colorToDelete.color}</strong
					>? Esta acción es permanente y no se puede deshacer.
				</p>

				<div class="space-y-2">
					<label for="confirmDelete" class="text-xs font-medium text-[#707070]">
						Escribe <strong class="text-[#171717]">{colorToDelete.color}</strong> para confirmar
					</label>
					<input
						id="confirmDelete"
						type="text"
						bind:value={deleteConfirmText}
						placeholder={colorToDelete.color}
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#e2005a] focus-visible:ring-1 focus-visible:ring-[#e2005a]/30 focus-visible:outline-none"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<Button
						variant="outline"
						size="sm"
						disabled={deleteLoadingId !== null}
						onclick={() => {
							colorToDelete = null;
							deleteConfirmText = '';
						}}
					>
						Cancelar
					</Button>

					<form
						action="?/deleteColor"
						method="POST"
						use:enhance={() => {
							deleteLoadingId = colorToDelete?.id ?? null;
							return async ({ result, update }) => {
								deleteLoadingId = null;
								colorToDelete = null;
								deleteConfirmText = '';
								await update();
							};
						}}
					>
						<input type="hidden" name="id" value={colorToDelete?.id} />
						<Button
							type="submit"
							variant="destructive"
							size="sm"
							disabled={deleteLoadingId !== null || deleteConfirmText !== colorToDelete?.color}
						>
							{#if deleteLoadingId !== null}
								Eliminando...
							{:else}
								Eliminar
							{/if}
						</Button>
					</form>
				</div>
			</CardContent>
		</Card>
	</div>
{/if}
</div>
