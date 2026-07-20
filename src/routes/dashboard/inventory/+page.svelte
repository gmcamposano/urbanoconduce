<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { compressImageFile } from '$lib/image';
	import {
		Warehouse,
		ArrowUp,
		ArrowDown,
		Search,
		AlertTriangle,
		Package,
		History,
		Plus,
		ArrowDownToLine,
		Image,
		Upload,
		Tags,
		Trash2,
		Copy
	} from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');

	function formatInventoryColor(color: string): string {
		if (!color) return 'Sin color';
		return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
	}

	const items = $derived(data.items || []);
	const models = $derived(data.models || []);
	const lowStockCount = $derived(data.lowStockCount || 0);

	let searchQuery = $state('');
	let sortBy = $state<string>('product');
	let sortOrder = $state<'asc' | 'desc'>('asc');
	let uploadingVariantId = $state<string | null>(null);
	let preview = $state<{ url: string; title: string; variantId: string } | null>(null);
	let deleteConfirm = $state<{ variantId: string; imageUrl: string; title: string } | null>(null);
	let deleteLoading = $state(false);
	let copySource = $state<{ variantId: string; url: string; title: string } | null>(null);
	let copyLoading = $state(false);
	let copySearch = $state('');
	let selectedTargetIds = $state<string[]>([]);

	function openImagePreview(url: string, title: string, variantId: string) {
		preview = { url, title, variantId };
	}

	function closeImagePreview() {
		preview = null;
	}

	function openDeleteConfirm(variantId: string, imageUrl: string, title: string) {
		deleteConfirm = { variantId, imageUrl, title };
	}

	function closeDeleteConfirm() {
		deleteConfirm = null;
		deleteLoading = false;
	}

	function openCopyDialog(variantId: string, url: string, title: string) {
		copySource = { variantId, url, title };
		selectedTargetIds = [];
		copySearch = '';
	}

	function closeCopyDialog() {
		copySource = null;
		copyLoading = false;
		copySearch = '';
		selectedTargetIds = [];
	}

	function toggleCopyTarget(id: string) {
		selectedTargetIds = selectedTargetIds.includes(id)
			? selectedTargetIds.filter((v) => v !== id)
			: [...selectedTargetIds, id];
	}

	function selectAllCopyTargets() {
		selectedTargetIds = copyTargetItems.map((i) => i.variant_id);
	}

	function clearAllCopyTargets() {
		selectedTargetIds = [];
	}

	const copyTargetItems = $derived.by(() => {
		if (!copySource) return [];
		const sourceId = copySource.variantId;
		const query = copySearch.toLowerCase().trim();
		return sortedItems.filter(
			(i) =>
				i.variant_id !== sourceId &&
				!i.image_url &&
				(!query ||
					i.product_title.toLowerCase().includes(query) ||
					getModelName(i.model_id).toLowerCase().includes(query) ||
					i.color.toLowerCase().includes(query))
		);
	});

	async function handleImageSelect(event: Event, variantId: string) {
		if (uploadingVariantId) return;
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			uploadingVariantId = variantId;
			const { blob, filename } = await compressImageFile(file, {
				maxWidth: 1200,
				maxHeight: 1200,
				quality: 0.7
			});

			const compressed = new File([blob], filename, { type: blob.type });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(compressed);
			input.files = dataTransfer.files;

			const form = input.form;
			if (form) {
				form.requestSubmit();
			}
		} catch (e: unknown) {
			console.error('Image compression error:', e);
			const message = e instanceof Error ? e.message : 'No se pudo procesar la imagen.';
			alert(message);
			uploadingVariantId = null;
			input.value = '';
		}
	}

	function toggleSort(column: string) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'asc';
		}
	}

	function getModelName(modelId: string | null): string {
		if (!modelId) return '—';
		const model = models.find((m) => m.id === modelId);
		return model ? model.model.charAt(0).toUpperCase() + model.model.slice(1).toLowerCase() : '—';
	}

	function capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	const filteredItems = $derived.by(() => {
		let result = items;
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			result = result.filter(
				(i) =>
					i.product_title.toLowerCase().includes(query) ||
					getModelName(i.model_id).toLowerCase().includes(query) ||
					i.color.toLowerCase().includes(query)
			);
		}
		return result;
	});

	const sortedItems = $derived.by(() => {
		const sorted = [...filteredItems];
		const dir = sortOrder === 'asc' ? 1 : -1;
		sorted.sort((a, b) => {
			switch (sortBy) {
				case 'product': {
					const byTitle = a.product_title
						.toLowerCase()
						.localeCompare(b.product_title.toLowerCase());
					return (byTitle === 0 ? a.variant_id.localeCompare(b.variant_id) : byTitle) * dir;
				}
				case 'model': {
					const byModel = getModelName(a.model_id).localeCompare(getModelName(b.model_id));
					return (byModel === 0 ? a.variant_id.localeCompare(b.variant_id) : byModel) * dir;
				}
				case 'stock':
					return (a.stock - b.stock || a.variant_id.localeCompare(b.variant_id)) * dir;
				case 'color':
					return (a.color.localeCompare(b.color) || a.variant_id.localeCompare(b.variant_id)) * dir;
				default:
					return a.variant_id.localeCompare(b.variant_id) * dir;
			}
		});
		return sorted;
	});

	function formatCurrency(val: number): string {
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val);
	}
</script>

<svelte:head>
	<title>Inventario - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Warehouse class="h-6 w-6 text-[#3ecf8e]" />
			Inventario
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">Stock actual por producto, modelo y color.</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">{form.message || 'No se pudo completar la acción'}</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0 text-[#24b47e]" />
			<div>
				<p class="font-medium">{form.message || 'Imagen guardada'}</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<Card>
			<CardContent class="flex items-center gap-4 py-5">
				<div class="rounded-md bg-[#3ecf8e]/12 p-3 text-[#171717]">
					<Package class="h-5 w-5" />
				</div>
				<div>
					<p class="text-xs text-[#707070]">Variantes</p>
					<p class="text-2xl font-medium">{items.length}</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-4 py-5">
				<div class="rounded-md bg-[#e2005a]/10 p-3 text-[#e2005a]">
					<AlertTriangle class="h-5 w-5" />
				</div>
				<div>
					<p class="text-xs text-[#707070]">Stock bajo</p>
					<p class="text-2xl font-medium">{lowStockCount}</p>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="flex items-center gap-4 py-5">
				<div class="rounded-md bg-[#ededed] p-3 text-[#171717]">
					<History class="h-5 w-5" />
				</div>
				<div>
					<p class="text-xs text-[#707070]">Movimientos</p>
					<div class="flex items-center gap-2">
						<a
							href={resolve('/dashboard/inventory/movements')}
							class="text-sm font-medium text-[#171717] underline-offset-4 hover:underline"
							>Ver historial</a
						>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="relative flex-1">
			<div class="flex items-center gap-3 rounded-md border border-[#dfdfdf] bg-white px-3 py-2">
				<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Buscar producto, modelo o color..."
					class="flex-1 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
				/>
			</div>
		</div>
		<div class="flex shrink-0 flex-wrap gap-2">
			<a
				href={resolve('/dashboard/inventory/variants')}
				class="inline-flex items-center justify-center gap-2 rounded-[6px] border border-[#c7c7c7] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa] active:translate-y-px"
			>
				Variantes
			</a>
			<a
				href={resolve('/dashboard/inventory/dispatch')}
				class="inline-flex items-center justify-center gap-2 rounded-[6px] border border-[#c7c7c7] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa] active:translate-y-px"
			>
				Despacho interno
			</a>
			<a
				href={resolve('/dashboard/inventory/stock-entry')}
				class="inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] shadow-sm shadow-black/5 transition-colors hover:bg-[#24b47e] active:translate-y-px"
			>
				<ArrowDownToLine class="h-4 w-4" />
				Entrada de mercancía
			</a>
			<a
				href={resolve('/dashboard/inventory/initial-stock')}
				class="inline-flex items-center justify-center gap-2 rounded-[6px] border border-[#c7c7c7] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa] active:translate-y-px"
			>
				<Plus class="h-4 w-4" />
				Carga inicial
			</a>
		</div>
	</div>

	<Card>
		<CardContent class="p-0">
			<div class="w-full overflow-x-auto">
				<table class="w-full text-left text-sm text-[#171717]">
					<thead
						class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
					>
						<tr>
							<th class="px-6 py-4 font-bold">
								<button
									type="button"
									class="flex items-center gap-1 uppercase transition-colors hover:text-[#3ecf8e]"
									onclick={() => toggleSort('product')}
								>
									Producto
									{#if sortBy === 'product'}
										{#if sortOrder === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{/if}
								</button>
							</th>
							<th class="px-6 py-4 font-bold uppercase">Imagen</th>
							<th class="px-6 py-4 font-bold uppercase">Modelo</th>
							<th class="px-6 py-4 font-bold uppercase">Color</th>
							<th class="px-6 py-4 text-right font-bold">
								<button
									type="button"
									class="ml-auto flex items-center gap-1 uppercase transition-colors hover:text-[#3ecf8e]"
									onclick={() => toggleSort('stock')}
								>
									Stock
									{#if sortBy === 'stock'}
										{#if sortOrder === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{/if}
								</button>
							</th>
							<th class="px-6 py-4 text-right font-bold uppercase">Mínimo</th>
							<th class="px-6 py-4 text-right font-bold uppercase">Costo</th>
							<th class="px-6 py-4 text-center font-bold uppercase">Estado</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[#ededed]">
						{#if sortedItems.length === 0}
							<tr>
								<td colspan="8" class="px-6 py-12 text-center text-xs text-[#707070]">
									No hay variantes en inventario.
								</td>
							</tr>
						{:else}
							{#each sortedItems as item (item.variant_id)}
								<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
									<td class="px-6 py-4 font-medium text-[#171717]">
										{capitalize(item.product_title)}
									</td>
									<td class="px-6 py-4">
										<div class="relative h-14 w-14">
											<button
												type="button"
												class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-[#dfdfdf] bg-[#fafafa] hover:border-[#3ecf8e] disabled:cursor-default"
												disabled={!item.image_url}
												onclick={() =>
													item.image_url &&
													openImagePreview(item.image_url, item.product_title, item.variant_id)}
											>
												{#if item.image_url}
													<img
														src={item.image_url}
														alt={item.product_title}
														class="h-full w-full object-cover"
													/>
												{:else}
													<Image class="h-5 w-5 text-[#707070]" />
												{/if}
											</button>

											{#if canManage}
												<form
													action="?/uploadVariantImage"
													method="POST"
													enctype="multipart/form-data"
													use:enhance={() => {
														uploadingVariantId = item.variant_id;
														return async ({ update }) => {
															uploadingVariantId = null;
															await update();
														};
													}}
													class="absolute -right-1.5 -bottom-1.5"
												>
													<input type="hidden" name="variant_id" value={item.variant_id} />
													<input type="hidden" name="old_image_url" value={item.image_url ?? ''} />
													<input
														type="file"
														id="variant-image-{item.variant_id}"
														name="image"
														accept="image/*"
														class="sr-only"
														onchange={(e) => handleImageSelect(e, item.variant_id)}
													/>
													<button
														type="button"
														class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#dfdfdf] bg-white text-[#707070] shadow-sm hover:border-[#3ecf8e] hover:bg-[#3ecf8e] hover:text-[#171717] disabled:opacity-50"
														disabled={uploadingVariantId === item.variant_id}
														onclick={() =>
															document.getElementById('variant-image-' + item.variant_id)?.click()}
														aria-label="Subir imagen"
													>
														<Upload class="h-3 w-3" />
													</button>
												</form>
											{/if}

											{#if uploadingVariantId === item.variant_id}
												<div
													class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-white/80 text-center"
												>
													<Upload class="h-4 w-4 animate-pulse text-[#3ecf8e]" />
													<span class="text-[9px] leading-tight font-medium text-[#3ecf8e]"
														>Subiendo imagen</span
													>
												</div>
											{/if}
										</div>
									</td>
									<td class="px-6 py-4 text-xs text-[#707070]">{getModelName(item.model_id)}</td>
									<td class="px-6 py-4 text-xs text-[#707070]"
										>{formatInventoryColor(item.color)}</td
									>
									<td class="px-6 py-4 text-right font-mono text-[#171717]">{item.stock}</td>
									<td class="px-6 py-4 text-right font-mono text-[#707070]">{item.min_stock}</td>
									<td class="px-6 py-4 text-right font-mono text-[#707070]">
										{item.purchase_price ? formatCurrency(item.purchase_price) : '—'}
									</td>
									<td class="px-6 py-4 text-center">
										{#if item.stock <= 0}
											<Badge variant="danger">Agotado</Badge>
										{:else if item.low_stock}
											<Badge variant="warning">Bajo</Badge>
										{:else}
											<Badge variant="success">OK</Badge>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>
</div>

{#if preview}
	{@const { url, title, variantId } = preview}
	<Dialog
		open
		title={capitalize(title)}
		class="max-w-3xl"
		style="width: min(90vw, 48rem);"
		onClose={closeImagePreview}
	>
		<img src={url} alt={title} class="max-h-[70vh] w-full rounded-md object-contain" />

		{#snippet footer()}
			<div class="flex w-full items-center justify-between">
				{#if canManage}
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#ededed]"
							onclick={() => {
								openCopyDialog(variantId, url, title);
								closeImagePreview();
							}}
						>
							<Copy class="h-4 w-4" />
							Copiar imagen
						</button>
						<button
							type="button"
							class="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-sm font-medium text-[#e2005a] transition-colors hover:bg-[#e2005a]/10"
							onclick={() => {
								openDeleteConfirm(variantId, url, title);
								closeImagePreview();
							}}
						>
							<Trash2 class="h-4 w-4" />
							Eliminar
						</button>
					</div>
				{:else}
					<span></span>
				{/if}
				<button
					type="button"
					class="rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
					onclick={closeImagePreview}
				>
					Cerrar
				</button>
			</div>
		{/snippet}
	</Dialog>
{/if}

{#if deleteConfirm}
	<Dialog
		open
		title="Eliminar imagen"
		description="Esta acción no se puede deshacer. La imagen se borrará del almacenamiento."
		class="max-w-md"
		onClose={closeDeleteConfirm}
	>
		<p class="text-sm text-[#707070]">
			¿Seguro que deseas eliminar la imagen de <strong class="text-[#171717]"
				>{capitalize(deleteConfirm.title)}</strong
			>?
		</p>

		<form
			id="delete-image-form"
			action="?/deleteVariantImage"
			method="POST"
			class="hidden"
			use:enhance={() => {
				deleteLoading = true;
				return async ({ update }) => {
					deleteLoading = false;
					closeDeleteConfirm();
					await update();
				};
			}}
		>
			<input type="hidden" name="variant_id" value={deleteConfirm.variantId} />
			<input type="hidden" name="image_url" value={deleteConfirm.imageUrl} />
		</form>

		{#snippet footer()}
			<button
				type="button"
				class="rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
				disabled={deleteLoading}
				onclick={closeDeleteConfirm}
			>
				Cancelar
			</button>
			<button
				type="submit"
				form="delete-image-form"
				class="inline-flex items-center gap-1.5 rounded-[6px] bg-[#e2005a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b8003c] disabled:opacity-50"
				disabled={deleteLoading}
			>
				{#if deleteLoading}
					Eliminando...
				{:else}
					<Trash2 class="h-4 w-4" />
					Eliminar
				{/if}
			</button>
		{/snippet}
	</Dialog>
{/if}

{#if copySource}
	<Dialog
		open
		title="Copiar imagen"
		description="Selecciona las variantes a las que quieres copiar esta imagen."
		class="max-w-lg"
		onClose={closeCopyDialog}
	>
		<form
			id="copy-image-form"
			action="?/copyVariantImage"
			method="POST"
			class="hidden"
			use:enhance={() => {
				copyLoading = true;
				return async ({ update }) => {
					copyLoading = false;
					closeCopyDialog();
					await update();
				};
			}}
		>
			<input type="hidden" name="source_variant_id" value={copySource.variantId} />
			<input type="hidden" name="target_variant_ids" value={JSON.stringify(selectedTargetIds)} />
		</form>

		<div class="space-y-4">
			<div class="relative">
				<div
					class="flex items-center gap-3 rounded-md border border-[#dfdfdf] bg-white px-3 py-2"
				>
					<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
					<input
						type="text"
						bind:value={copySearch}
						placeholder="Buscar producto, modelo o color..."
						class="flex-1 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
					/>
				</div>
			</div>

			{#if copyTargetItems.length === 0}
				<p class="py-4 text-center text-xs text-[#707070]">
					Las demás variantes ya tienen imagen.
				</p>
			{:else}
				<div class="flex items-center justify-between">
					<p class="text-xs text-[#707070]">
						{selectedTargetIds.length} de {copyTargetItems.length} seleccionadas
					</p>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="text-xs font-medium text-[#3ecf8e] hover:underline"
							onclick={selectAllCopyTargets}
						>
							Seleccionar todo
						</button>
						<span class="text-[#dfdfdf]">|</span>
						<button
							type="button"
							class="text-xs font-medium text-[#707070] hover:underline"
							onclick={clearAllCopyTargets}
						>
							Limpiar
						</button>
					</div>
				</div>
				<div class="max-h-60 space-y-2 overflow-y-auto rounded-md border border-[#ededed] p-2">
					{#each copyTargetItems as item (item.variant_id)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-[#fafafa]"
						>
							<input
								type="checkbox"
								class="h-4 w-4 accent-[#3ecf8e]"
								checked={selectedTargetIds.includes(item.variant_id)}
								onchange={() => toggleCopyTarget(item.variant_id)}
							/>
							<div class="flex flex-1 flex-col">
								<span class="text-sm font-medium text-[#171717]">
									{capitalize(item.product_title)}
								</span>
								<span class="text-xs text-[#707070]">
									{getModelName(item.model_id)} · {formatInventoryColor(item.color)}
								</span>
							</div>
						</label>
					{/each}
				</div>
			{/if}
		</div>

		{#snippet footer()}
			<button
				type="button"
				class="rounded-[6px] border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
				disabled={copyLoading}
				onclick={closeCopyDialog}
			>
				Cancelar
			</button>
			<button
				type="submit"
				form="copy-image-form"
				class="inline-flex items-center gap-1.5 rounded-[6px] bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50"
				disabled={copyLoading || selectedTargetIds.length === 0}
			>
				{#if copyLoading}
					Copiando...
				{:else}
					<Copy class="h-4 w-4" />
					Copiar a {selectedTargetIds.length} variante{selectedTargetIds.length === 1 ? '' : 's'}
				{/if}
			</button>
		{/snippet}
	</Dialog>
{/if}
