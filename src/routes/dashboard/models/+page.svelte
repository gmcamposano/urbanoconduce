<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Boxes, Droplets, Edit3, Trash2 } from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const models = $derived(data.models || []);

	let loading = $state(false);
	let deleteLoadingId = $state<string | null>(null);
	let editingModel = $state<{ id: string; model: string } | null>(null);
	let model = $state('');

	function startEditing(item: (typeof models)[number]) {
		editingModel = item;
		model = item.model;
	}

	function resetForm() {
		editingModel = null;
		model = '';
	}
</script>

<svelte:head>
	<title>Modelos - FacturaFlow</title>
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
				<CardTitle>{editingModel ? 'Editar modelo' : 'Nuevo modelo'}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action={editingModel ? '?/updateModel' : '?/createModel'}
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
					{#if editingModel}
						<input type="hidden" name="id" value={editingModel.id} />
					{/if}

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

					<div class="flex gap-3">
						<Button type="submit" class="flex-1" disabled={loading}>
							{editingModel ? 'Actualizar modelo' : 'Guardar modelo'}
						</Button>
						{#if editingModel}
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
				<CardTitle>Modelos disponibles</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-16 px-6 py-4 font-bold">#</th>
								<th class="px-6 py-4 font-bold">Modelo</th>
								{#if canManage}
									<th class="px-6 py-4 text-right font-bold">Acciones</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if models.length === 0}
								<tr>
									<td
										colspan={canManage ? 3 : 2}
										class="px-6 py-12 text-center text-xs text-[#707070]"
										>Aún no hay modelos registrados.</td
									>
								</tr>
							{:else}
								{#each models as item, index (item.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-mono text-xs text-[#707070]">{index + 1}</td>
										<td class="px-6 py-4 text-xs text-[#171717] capitalize">{item.model}</td>
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
													<form
														action="?/deleteModel"
														method="POST"
														class="contents"
														use:enhance={() => {
															deleteLoadingId = item.id;
															return async ({ update }) => {
																deleteLoadingId = null;
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
															title="Borrar modelo"
															disabled={deleteLoadingId === item.id}
															onclick={(event) => {
																if (!confirm(`¿Eliminar el modelo ${item.model}?`)) {
																	event.preventDefault();
																}
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
</div>