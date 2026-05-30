<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Boxes, Droplets, Edit3, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const models = $derived(data.models || []);

	let loading = $state(false);
	let deleteLoadingId = $state<string | null>(null);
	let editingModel = $state<{ id: string; model: string } | null>(null);
	let model = $state('');
	let showEditDialog = $state(false);
	let showDeleteDialog = $state(false);
	let modelToDelete = $state<{ id: string; model: string } | null>(null);
	let search = $state('');

	const sort = $derived(data.sort ?? 'model');
	const order = $derived(data.order ?? 'asc');

const filteredModels = $derived(
		search.trim()
			? models.filter(m => m.model.toLowerCase().includes(search.toLowerCase()))
			: models
	);

	function toggleSort(column: 'model' | 'created_at') {
		const newOrder = sort === column ? (order === 'asc' ? 'desc' : 'asc') : 'asc';
		const params = new URLSearchParams(window.location.search);
		params.set('sort', column);
		params.set('order', newOrder);
		goto(`${window.location.pathname}?${params.toString()}`, { keepFocus: true });
	}

	function getSortIcon(column: 'model' | 'created_at') {
		if (sort !== column) return ArrowUpDown;
		return order === 'asc' ? ArrowUp : ArrowDown;
	}

	function startEditing(item: (typeof models)[number]) {
		editingModel = item;
		model = item.model;
		showEditDialog = true;
	}

	function closeEditDialog() {
		showEditDialog = false;
		editingModel = null;
		model = '';
	}

	function startDelete(item: (typeof models)[number]) {
		modelToDelete = item;
		showDeleteDialog = true;
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		modelToDelete = null;
	}

	function resetForm() {
		editingModel = null;
		model = '';
	}
</script>

<svelte:head>
	<title>Modelos - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Boxes class="h-6 w-6 text-[#3ecf8e]" />
			Modelos
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Define los modelos disponibles para asignar a productos.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Droplets class="mt-0.5 h-5 w-5 flex-shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar el modelo</p>
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
				<p class="font-medium">{form.message || 'Modelo guardado'}</p>
				<p class="mt-0.5 text-xs text-[#707070]">Ya está disponible para productos.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>Nuevo modelo</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action="?/createModel"
					method="POST"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						return async ({ result, update }) => {
							loading = false;
							if (result.type === 'success') {
								model = '';
							}
							await update();
						};
					}}
				>
					<Input
						label="Modelo"
						name="model"
						type="text"
						placeholder="Clásico, Sport, Premium"
						bind:value={model}
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
						<p>Escribe el nombre del modelo manualmente, por ejemplo clásico o sport.</p>
					</div>

					<Button type="submit" class="w-full" disabled={loading}>
						Guardar modelo
					</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<div class="flex items-center justify-between gap-4">
					<CardTitle>Modelos disponibles</CardTitle>
					<div class="relative">
						<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707070]" />
						<input
							type="text"
							placeholder="Buscar modelo..."
							bind:value={search}
							class="h-9 w-64 rounded-[6px] border border-[#dfdfdf] bg-white pl-9 pr-8 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:border-[#24b47e]"
						/>
						{#if search}
							<button
								type="button"
								onclick={() => search = ''}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#171717]"
							>
								<X class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-16 px-6 py-4 font-bold">#</th>
								<th class="px-6 py-4 font-bold cursor-pointer select-none hover:text-[#171717]" onclick={() => toggleSort('model')}>
									<div class="flex items-center gap-1.5">
										Modelo
										{#if sort === 'model'}
											{@const Icon = getSortIcon('model')}
											<Icon class="h-3.5 w-3.5" />
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5 opacity-40" />
										{/if}
									</div>
								</th>
								<th class="px-6 py-4 font-bold cursor-pointer select-none hover:text-[#171717]" onclick={() => toggleSort('created_at')}>
									<div class="flex items-center gap-1.5">
										Fecha ingreso
										{#if sort === 'created_at'}
											{@const Icon = getSortIcon('created_at')}
											<Icon class="h-3.5 w-3.5" />
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5 opacity-40" />
										{/if}
									</div>
								</th>
								{#if canManage}
									<th class="px-6 py-4 text-right font-bold">Acciones</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if filteredModels.length === 0}
								<tr>
									<td
										colspan={canManage ? 4 : 3}
										class="px-6 py-12 text-center text-xs text-[#707070]"
									>{search ? `No se encontraron modelos para "${search}"` : 'Aún no hay modelos registrados.'}</td
									>
								</tr>
							{:else}
								{#each filteredModels as item, index (item.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-mono text-xs text-[#707070]">{index + 1}</td>
										<td class="px-6 py-4 text-xs text-[#171717] capitalize">{item.model}</td>
										<td class="px-6 py-4 text-xs text-[#707070]">
											{new Date(item.created_at).toLocaleDateString('es-DO', {
												year: 'numeric',
												month: 'short',
												day: 'numeric'
											})}
										</td>
										{#if canManage}
											<td class="px-6 py-4 text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-1.5">
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#171717]"
														title="Editar modelo"
														onclick={() => startEditing(item)}
													>
														<Edit3 class="h-4 w-4" />
													</Button>
													<Button
															type="button"
															variant="ghost"
															size="icon"
															class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
															title="Borrar modelo"
															onclick={() => startDelete(item)}
														>
															<Trash2 class="h-4 w-4" />
														</Button>
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

	<Dialog
		open={showEditDialog}
		title="Editar modelo"
		description="Actualiza el nombre del modelo."
		onClose={closeEditDialog}
	>
		<form
			action="?/updateModel"
			method="POST"
			class="space-y-4"
			use:enhance={() => {
				loading = true;
				return async ({ result, update }) => {
					loading = false;
					if (result.type === 'success') {
						closeEditDialog();
					}
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={editingModel?.id ?? ''} />
			<Input
				label="Modelo"
				name="model"
				type="text"
				placeholder="Clásico, Sport, Premium"
				bind:value={model}
				class="capitalize"
				required
				disabled={loading}
			/>
			<div class="flex gap-3">
				<Button type="submit" class="flex-1" disabled={loading}>
					Actualizar modelo
				</Button>
				<Button type="button" variant="outline" disabled={loading} onclick={closeEditDialog}>
					Cancelar
				</Button>
			</div>
		</form>
	</Dialog>

	<Dialog
		open={showDeleteDialog}
		title="Eliminar modelo"
		description={`¿Estás seguro de que deseas eliminar el modelo "${modelToDelete?.model}"? Esta acción no se puede deshacer.`}
		onClose={closeDeleteDialog}
	>
		<form
			action="?/deleteModel"
			method="POST"
			class="space-y-4"
			use:enhance={() => {
				if (modelToDelete) deleteLoadingId = modelToDelete.id;
				return async ({ update }) => {
					deleteLoadingId = null;
					closeDeleteDialog();
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={modelToDelete?.id ?? ''} />
			<div class="flex gap-3">
				<Button type="submit" variant="destructive" class="flex-1" disabled={deleteLoadingId !== null}>
					Eliminar modelo
				</Button>
				<Button type="button" variant="outline" disabled={deleteLoadingId !== null} onclick={closeDeleteDialog}>
					Cancelar
				</Button>
			</div>
		</form>
	</Dialog>
</div>
