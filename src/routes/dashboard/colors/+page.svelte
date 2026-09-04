<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import {
		AlertTriangle,
		ArrowDown,
		ArrowUp,
		Droplets,
		Edit3,
		GripVertical,
		Palette,
		Trash2
	} from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { dragHandle, dragHandleZone, SOURCES, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import { tick } from 'svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	let colors = $derived(data.colors || []);

	let loading = $state(false);
	let deleteLoadingId = $state<string | null>(null);
	let reorderSaving = $state(false);
	let reorderStatus = $state('');
	let colorToDelete = $state<{ id: string; color: string } | null>(null);
	let deleteConfirmText = $state('');
	let editingColor = $state<{ id: string; color: string } | null>(null);
	let color = $state('');
	let reorderForm: HTMLFormElement | undefined;
	let reorderInput: HTMLInputElement | undefined;

	const flipDurationMs = 180;
	const reorderLocked = $derived(loading || deleteLoadingId !== null || reorderSaving);
	type ColorItem = (typeof data.colors)[number];

	function startEditing(item: (typeof colors)[number]) {
		editingColor = item;
		color = item.color;
	}

	function resetForm() {
		editingColor = null;
		color = '';
	}

	function sameOrder(left: ColorItem[], right: ColorItem[]) {
		return (
			left.length === right.length && left.every((item, index) => item.id === right[index]?.id)
		);
	}

	function handleDndConsider(event: CustomEvent<DndEvent<ColorItem>>) {
		if (!reorderLocked) colors = event.detail.items;
	}

	async function submitOrder(nextColors: ColorItem[], pendingMessage: string) {
		if (!canManage || reorderLocked) return;

		colors = nextColors;
		if (sameOrder(nextColors, data.colors || [])) {
			reorderStatus = 'El orden no cambió.';
			return;
		}

		reorderSaving = true;
		reorderStatus = pendingMessage;
		await tick();
		if (!reorderInput || !reorderForm) {
			colors = data.colors || [];
			reorderSaving = false;
			reorderStatus = 'No se pudo iniciar el guardado. Se restauró el orden anterior.';
			return;
		}
		reorderInput.value = JSON.stringify(nextColors.map((item) => item.id));
		reorderForm.requestSubmit();
	}

	function handleDndFinalize(event: CustomEvent<DndEvent<ColorItem>>) {
		colors = event.detail.items;
		if (
			event.detail.info.source === SOURCES.KEYBOARD &&
			event.detail.info.trigger !== TRIGGERS.DRAG_STOPPED
		) {
			return;
		}
		void submitOrder(event.detail.items, 'Guardando el nuevo orden de colores…');
	}

	function captureReorderForm(element: HTMLFormElement) {
		reorderForm = element;
		return () => {
			reorderForm = undefined;
		};
	}

	function captureReorderInput(element: HTMLInputElement) {
		reorderInput = element;
		return () => {
			reorderInput = undefined;
		};
	}

	function moveColor(index: number, offset: -1 | 1) {
		const destination = index + offset;
		if (reorderLocked || destination < 0 || destination >= colors.length) return;

		const nextColors = [...colors];
		[nextColors[index], nextColors[destination]] = [nextColors[destination], nextColors[index]];
		void submitOrder(nextColors, `Moviendo ${nextColors[destination].color}…`);
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
				<p class="font-medium">No se pudieron guardar los cambios</p>
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
				<p class="mt-0.5 text-xs text-[#707070]">Los cambios se aplicaron correctamente.</p>
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
						disabled={loading || reorderSaving}
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
						<Button type="submit" class="flex-1" disabled={loading || reorderSaving}>
							{editingColor ? 'Actualizar color' : 'Guardar color'}
						</Button>
						{#if editingColor}
							<Button
								type="button"
								variant="outline"
								disabled={loading || reorderSaving}
								onclick={resetForm}>Cancelar</Button
							>
						{/if}
					</div>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Colores disponibles</CardTitle>
				<p class="text-xs text-[#707070]">Arrastra el control o usa las flechas para ordenar.</p>
			</CardHeader>
			<CardContent class="p-0">
				<form
					{@attach captureReorderForm}
					action="?/reorderColors"
					method="POST"
					class="hidden"
					use:enhance={() => {
						reorderSaving = true;
						return async ({ result, update }) => {
							try {
								if (result.type === 'failure') {
									colors = data.colors || [];
									reorderStatus = 'No se pudo guardar el orden. Se restauró el orden anterior.';
									await update({ reset: false, invalidateAll: false });
									await invalidateAll();
								} else {
									await update({ reset: false });
									if (result.type === 'success') {
										reorderStatus = 'Orden de colores guardado.';
									}
								}
							} finally {
								reorderSaving = false;
							}
						};
					}}
				>
					<input {@attach captureReorderInput} type="hidden" name="color_ids" />
				</form>
				<p class="sr-only" aria-live="polite" aria-atomic="true">{reorderStatus}</p>
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
						<tbody
							class="divide-y divide-[#ededed]"
							use:dragHandleZone={{
								items: colors,
								flipDurationMs,
								dragDisabled: !canManage || reorderLocked,
								delayTouchStart: true
							}}
							onconsider={handleDndConsider}
							onfinalize={handleDndFinalize}
						>
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
									<tr
										class="transition-colors duration-150 hover:bg-[#fafafa]"
										animate:flip={{ duration: flipDurationMs }}
									>
										<td class="px-6 py-4 font-mono text-xs text-[#707070]">
											<div class="flex items-center gap-2">
												{#if canManage}
													<button
														type="button"
														use:dragHandle
														class="inline-flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-[6px] text-[#707070] transition-colors hover:bg-[#f3f3f3] hover:text-[#171717] focus-visible:ring-2 focus-visible:ring-[#171717]/20 focus-visible:outline-none active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
														aria-label={`Arrastrar ${item.color} para reordenar`}
														title={`Arrastrar ${item.color} para reordenar`}
														disabled={reorderLocked}
													>
														<GripVertical class="h-4 w-4" />
													</button>
												{/if}
												<span>{index + 1}</span>
											</div>
										</td>
										<td class="px-6 py-4 text-xs text-[#171717] capitalize">{item.color}</td>
										{#if canManage}
											<td class="px-6 py-4 text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-1.5">
													<button
														type="button"
														class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[#707070] transition-colors hover:bg-[#fafafa] hover:text-[#171717] focus-visible:ring-2 focus-visible:ring-[#171717]/20 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
														aria-label={`Subir ${item.color}`}
														title={`Subir ${item.color}`}
														disabled={index === 0 || reorderLocked}
														onclick={() => moveColor(index, -1)}
													>
														<ArrowUp class="h-4 w-4" />
													</button>
													<button
														type="button"
														class="inline-flex h-9 w-9 items-center justify-center rounded-[6px] text-[#707070] transition-colors hover:bg-[#fafafa] hover:text-[#171717] focus-visible:ring-2 focus-visible:ring-[#171717]/20 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
														aria-label={`Bajar ${item.color}`}
														title={`Bajar ${item.color}`}
														disabled={index === colors.length - 1 || reorderLocked}
														onclick={() => moveColor(index, 1)}
													>
														<ArrowDown class="h-4 w-4" />
													</button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="h-9 w-9 text-[#707070] hover:text-[#171717]"
														aria-label={`Editar ${item.color}`}
														title="Editar color"
														disabled={reorderLocked}
														onclick={() => startEditing(item)}
													>
														<Edit3 class="h-4 w-4" />
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														class="h-9 w-9 text-[#707070] hover:text-[#e2005a]"
														aria-label={`Borrar ${item.color}`}
														title="Borrar color"
														disabled={reorderLocked}
														onclick={() => {
															colorToDelete = item;
															deleteConfirmText = '';
														}}
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

	<!-- Delete Confirmation Modal -->
	{#if colorToDelete}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
		>
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
								return async ({ update }) => {
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
