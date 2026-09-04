<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import { Package, Tags, ArrowUp, ArrowDown, Search, Maximize2 } from '@lucide/svelte';
	import ProductRow from './ProductRow.svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const products = $derived(data.products || []);
	const models = $derived(data.models || []);
	const clients = $derived(data.clients || []);
	const clientPrices = $derived(data.clientPrices || []);
	let searchQuery = $state('');
	let tableExpanded = $state(false);

	let sortBy = $state<string>('title');
	let sortOrder = $state<'asc' | 'desc'>('asc');

	function toggleSort(column: string) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'asc';
		}
	}

	function fuzzyMatch(text: string, query: string): boolean {
		let qi = 0;
		for (let i = 0; i < text.length && qi < query.length; i++) {
			if (text[i] === query[qi]) qi++;
		}
		return qi === query.length;
	}

	const filteredProducts = $derived.by(() => {
		let result = products;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			result = result.filter((p) => {
				const modelName = models.find((m) => m.id === p.model)?.model || '';
				const combined = `${p.title} ${modelName} ${p.description || ''}`.toLowerCase();
				return fuzzyMatch(combined, query);
			});
		}

		return result;
	});

	const sortedProducts = $derived.by(() => {
		const sorted = [...filteredProducts];
		const dir = sortOrder === 'asc' ? 1 : -1;

		sorted.sort((a, b) => {
			switch (sortBy) {
				case 'title':
					return a.title.toLowerCase().localeCompare(b.title.toLowerCase()) * dir;
				case 'model': {
					const modelA = models.find((m) => m.id === a.model)?.model?.toLowerCase() || '';
					const modelB = models.find((m) => m.id === b.model)?.model?.toLowerCase() || '';
					return modelA.localeCompare(modelB) * dir;
				}
				case 'price':
					return (Number(a.price_without_taxes) - Number(b.price_without_taxes)) * dir;
				case 'created_at':
					return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
				default:
					return 0;
			}
		});
		return sorted;
	});

	let loading = $state(false);
	let editingProduct = $state<{
		id: string;
		title: string;
		description: string | null;
		price_without_taxes: number;
		model: string | null;
	} | null>(null);
	let editLoading = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editPriceWithoutTaxes = $state('');
	let editModel = $state('');
	let productToDelete = $state<{ id: string; title: string } | null>(null);
	let deleteLoading = $state(false);
	let singleDuplicateModalOpen = $state(false);
	let productToDuplicateForModels = $state<{
		id: string;
		title: string;
		description: string | null;
		price_without_taxes: number;
		model: string | null;
	} | null>(null);
	let selectedModelsForDuplicate = $state<string[]>([]);
	let singleDuplicateLoading = $state(false);
	let singleDuplicateError = $state('');
	let singleDuplicateModelSearch = $state('');

	const availableModelsForSingleDuplicate = $derived.by(() => {
		if (!productToDuplicateForModels) return [];
		const productTitle = productToDuplicateForModels.title;
		const currentModelId = productToDuplicateForModels.model;
		const search = singleDuplicateModelSearch.toLowerCase().trim();
		const filtered = models.filter((m) => {
			if (m.id === currentModelId) return false;
			const alreadyExistsWithThisModel = products.some(
				(p) =>
					p.title.toLowerCase() === productTitle.toLowerCase() &&
					p.model === m.id &&
					p.id !== productToDuplicateForModels?.id
			);
			return !alreadyExistsWithThisModel;
		});
		const sorted = filtered.sort((a, b) =>
			a.model.toLowerCase().localeCompare(b.model.toLowerCase())
		);
		if (!search) return sorted;
		return sorted.filter((m) => m.model.toLowerCase().includes(search));
	});

	const canSingleDuplicate = $derived(
		selectedModelsForDuplicate.length > 0 && productToDuplicateForModels !== null
	);

	let title = $state('');
	let description = $state('');
	let priceWithoutTaxes = $state('');
	let selectedModel = $state('');

	const isProductFormValid = $derived(
		title.trim() !== '' &&
			selectedModel.trim() !== '' &&
			priceWithoutTaxes !== '' &&
			Number(priceWithoutTaxes) >= 0
	);

	const availableModels = $derived(
		models.filter(
			(m) =>
				!products.some((p) => p.title.toLowerCase() === title.toLowerCase() && p.model === m.id)
		)
	);

	const availableModelsEdit = $derived(
		models.filter(
			(m) =>
				!products.some(
					(p) =>
						p.title.toLowerCase() === editTitle.toLowerCase() &&
						p.model === m.id &&
						p.id !== editingProduct?.id
				)
		)
	);

	const priceWithTax = $derived(priceWithoutTaxes ? Number(priceWithoutTaxes) * 1.18 : 0);

	const editPriceWithTax = $derived(
		editPriceWithoutTaxes ? Number(editPriceWithoutTaxes) * 1.18 : 0
	);

	function startEditing(product: (typeof products)[number]) {
		editingProduct = { ...product };
		editTitle = product.title;
		editDescription = product.description || '';
		editPriceWithoutTaxes = String(product.price_without_taxes ?? '');
		editModel = product.model || '';
	}

	function closeEditDialog() {
		editingProduct = null;
		editTitle = '';
		editDescription = '';
		editPriceWithoutTaxes = '';
		editModel = '';
		editLoading = false;
	}

	function openDeleteDialog(product: (typeof products)[number]) {
		productToDelete = {
			id: product.id,
			title: product.title
		};
	}

	function closeDeleteDialog() {
		productToDelete = null;
		deleteLoading = false;
	}

	function openSingleDuplicateModal(product: (typeof products)[number]) {
		productToDuplicateForModels = { ...product };
		selectedModelsForDuplicate = [];
		singleDuplicateError = '';
		singleDuplicateModalOpen = true;
	}

	function closeSingleDuplicateModal() {
		singleDuplicateModalOpen = false;
		productToDuplicateForModels = null;
		selectedModelsForDuplicate = [];
		singleDuplicateLoading = false;
		singleDuplicateError = '';
		singleDuplicateModelSearch = '';
	}

	function toggleModelForDuplicate(modelId: string) {
		if (selectedModelsForDuplicate.includes(modelId)) {
			selectedModelsForDuplicate = selectedModelsForDuplicate.filter((id) => id !== modelId);
		} else {
			selectedModelsForDuplicate = [...selectedModelsForDuplicate, modelId];
		}
	}

	function toggleAllModelsForDuplicate() {
		const available = availableModelsForSingleDuplicate;
		if (selectedModelsForDuplicate.length === available.length) {
			selectedModelsForDuplicate = [];
		} else {
			selectedModelsForDuplicate = available.map((m) => m.id);
		}
	}

	function resetForm() {
		title = '';
		description = '';
		priceWithoutTaxes = '';
		selectedModel = '';
	}

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val);
	}

	function capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	function sentenceCase(str: string): string {
		if (!str) return str;
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	function openTableModal() {
		tableExpanded = true;
	}

	function closeTableModal() {
		tableExpanded = false;
	}
</script>

<svelte:head>
	<title>Productos - magikalInvoice</title>
</svelte:head>

{#snippet formAlerts()}
	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar el producto</p>
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
				<p class="font-medium">{form.message || 'Producto guardado'}</p>
				<p class="mt-0.5 text-xs text-[#707070]">Ya está disponible para facturar.</p>
			</div>
		</div>
	{/if}
{/snippet}

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Package class="h-6 w-6 text-[#3ecf8e]" />
			Productos
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Crea tu catálogo de servicios o productos con su precio sin impuestos.
		</p>
	</div>

	{@render formAlerts()}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>Nuevo producto</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action="?/createProduct"
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
					<Input
						bind:value={title}
						label="Producto"
						name="title"
						placeholder="Cover Elite Colors"
						required
						disabled={loading}
					/>

					<SearchableSelect
						label="Modelo"
						options={availableModels.map((m) => ({ value: m.id, label: capitalize(m.model) }))}
						bind:value={selectedModel}
						placeholder="Selecciona un modelo"
						disabled={loading || availableModels.length === 0}
					/>

					{#if !models.length}
						<p class="-mt-2 text-[11px] text-[#707070]">
							No hay modelos disponibles. Crea al menos uno en la sección Modelos.
						</p>
					{:else if availableModels.length === 0 && title.trim() !== ''}
						<p class="-mt-2 text-[11px] font-medium text-red-600">
							Ya existe un producto con este nombre y modelo.
						</p>
					{:else if availableModels.length === 0}
						<p class="-mt-2 text-[11px] text-[#707070]">
							Escribe el nombre del producto para ver los modelos disponibles.
						</p>
					{/if}

					<input type="hidden" name="model" value={selectedModel} />

					<div class="flex w-full flex-col gap-1.5">
						<label
							for="description"
							class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
							>Descripción</label
						>
						<textarea
							id="description"
							name="description"
							bind:value={description}
							rows="4"
							placeholder="Detalle breve del producto o servicio"
							disabled={loading}
							class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						></textarea>
					</div>

					<Input
						bind:value={priceWithoutTaxes}
						label="Precio sin impuestos"
						prefix="RD$"
						name="price_without_taxes"
						type="number"
						min="0"
						step="any"
						required
						disabled={loading}
					/>

					{#if priceWithoutTaxes !== ''}
						<p class="-mt-1 text-[11px] text-[#707070]">
							Precio con impuesto (18%): <span class="font-medium"
								>{formatCurrency(priceWithTax)}</span
							>
						</p>
					{/if}

					<div class="flex gap-3">
						<Button type="submit" class="flex-1" disabled={loading || !isProductFormValid}
							>Guardar producto</Button
						>
					</div>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>Catálogo de productos</CardTitle>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 text-[#707070] hover:text-[#171717]"
					title="Ampliar catálogo"
					onclick={openTableModal}
				>
					<Maximize2 class="h-4 w-4" />
				</Button>
			</CardHeader>
			<CardContent class="p-0">
				{@render catalogTable()}
			</CardContent>
		</Card>
	</div>
</div>

{#snippet catalogTable()}
	<div class="border-b border-[#ededed] bg-[#fafafa] px-6 py-3">
		<div class="flex items-center gap-3">
			<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Buscar por modelo, producto o descripción..."
				class="flex-1 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
			/>
		</div>
	</div>
	<div class="w-full overflow-auto {tableExpanded ? 'max-h-[70vh]' : 'max-h-[60vh]'}">
		<table class="w-full text-left text-sm text-[#171717]">
			<thead
				class="sticky top-0 z-10 border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
			>
				<tr>
					<th class="w-8 px-3 py-4"></th>
					<th class="px-6 py-4 font-bold">
						<button
							type="button"
							class="flex items-center gap-1 uppercase transition-colors hover:text-[#3ecf8e]"
							onclick={() => toggleSort('created_at')}
						>
							Fecha
							{#if sortBy === 'created_at'}
								{#if sortOrder === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
										class="h-3 w-3"
									/>{/if}
							{/if}
						</button>
					</th>
					<th class="px-6 py-4 font-bold">
						<button
							type="button"
							class="flex items-center gap-1 uppercase transition-colors hover:text-[#3ecf8e]"
							onclick={() => toggleSort('title')}
						>
							Producto
							{#if sortBy === 'title'}
								{#if sortOrder === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
										class="h-3 w-3"
									/>{/if}
							{/if}
						</button>
					</th>
					<th class="px-6 py-4 font-bold">
						<button
							type="button"
							class="flex items-center gap-1 uppercase transition-colors hover:text-[#3ecf8e]"
							onclick={() => toggleSort('model')}
						>
							Modelo
							{#if sortBy === 'model'}
								{#if sortOrder === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
										class="h-3 w-3"
									/>{/if}
							{/if}
						</button>
					</th>
					<th class="px-6 py-4 font-bold uppercase">Descripción</th>
					<th class="px-6 py-4 text-right font-bold">
						<button
							type="button"
							class="ml-auto flex items-center gap-1 uppercase transition-colors hover:text-[#3ecf8e]"
							onclick={() => toggleSort('price')}
						>
							Precio
							{#if sortBy === 'price'}
								{#if sortOrder === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
										class="h-3 w-3"
									/>{/if}
							{/if}
						</button>
					</th>
					<th class="px-6 py-4 text-right font-bold uppercase">Precio con impuesto</th>
					{#if canManage}
						<th class="px-6 py-4 text-right font-bold uppercase">Acciones</th>
					{/if}
				</tr>
			</thead>
			<tbody class="divide-y divide-[#ededed]">
				{#if sortedProducts.length === 0}
					<tr>
						<td colspan={canManage ? 8 : 7} class="px-6 py-12 text-center text-xs text-[#707070]"
							>Aún no hay productos registrados.</td
						>
					</tr>
				{:else}
					{#each sortedProducts as product (product.id)}
						<ProductRow
							{product}
							{models}
							{clients}
							overrides={clientPrices.filter((cp) => cp.product_id === product.id)}
							{canManage}
							{capitalize}
							{sentenceCase}
							{formatCurrency}
							{openSingleDuplicateModal}
							{startEditing}
							{openDeleteDialog}
						/>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
{/snippet}

{#if tableExpanded}
	<Dialog
		open
		title="Catálogo de productos"
		class="max-w-none"
		style="width: calc(95vw - 2rem); max-width: calc(95vw - 2rem); max-height: 95vh;"
		onClose={closeTableModal}
	>
		<div class="mb-4 space-y-3">
			{@render formAlerts()}
		</div>
		{@render catalogTable()}
	</Dialog>
{/if}

{#if editingProduct}
	<Dialog
		open
		title="Editar producto"
		description="Actualiza los datos del producto antes de guardarlo."
		class="max-w-xl"
		onClose={closeEditDialog}
	>
		<form
			id="edit-product-form"
			action="?/updateProduct"
			method="POST"
			class="space-y-4"
			use:enhance={() => {
				editLoading = true;
				return async ({ result, update }) => {
					editLoading = false;
					if (result.type === 'success') {
						closeEditDialog();
					}
					await update();
				};
			}}
		>
			<input type="hidden" name="id" value={editingProduct.id} />

			<Input
				bind:value={editTitle}
				label="Título"
				name="title"
				placeholder="Consultoría SEO"
				required
				disabled={editLoading}
			/>

			<SearchableSelect
				label="Modelo"
				options={availableModelsEdit.map((m) => ({ value: m.id, label: capitalize(m.model) }))}
				bind:value={editModel}
				placeholder="Selecciona un modelo"
				disabled={editLoading || availableModelsEdit.length === 0}
			/>

			{#if !models.length}
				<p class="-mt-2 text-[11px] text-[#707070]">
					No hay modelos disponibles. Crea al menos uno en la sección Modelos.
				</p>
			{:else if availableModelsEdit.length === 0 && editTitle.trim() !== ''}
				<p class="-mt-2 text-[11px] font-medium text-red-600">
					Ya existe un producto con este nombre y modelo.
				</p>
			{:else if availableModelsEdit.length === 0}
				<p class="-mt-2 text-[11px] text-[#707070]">
					Escribe el nombre del producto para ver los modelos disponibles.
				</p>
			{/if}

			<input type="hidden" name="model" value={editModel} />

			<div class="flex w-full flex-col gap-1.5">
				<label
					for="edit-description"
					class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
					>Descripción</label
				>
				<textarea
					id="edit-description"
					name="description"
					bind:value={editDescription}
					rows="4"
					placeholder="Detalle breve del producto o servicio"
					disabled={editLoading}
					class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
			</div>

			<Input
				bind:value={editPriceWithoutTaxes}
				label="Precio sin impuestos"
				prefix="RD$"
				name="price_without_taxes"
				type="number"
				min="0"
				step="any"
				required
				disabled={editLoading}
			/>

			{#if editPriceWithoutTaxes !== ''}
				<p class="-mt-1 text-[11px] text-[#707070]">
					Precio con impuesto (18%): <span class="font-medium"
						>{formatCurrency(editPriceWithTax)}</span
					>
				</p>
			{/if}
		</form>

		{#snippet footer()}
			<Button type="button" variant="outline" disabled={editLoading} onclick={closeEditDialog}
				>Cancelar</Button
			>
			<Button type="submit" form="edit-product-form" disabled={editLoading}>
				{#if editLoading}
					Guardando...
				{:else}
					Guardar cambios
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}

{#if productToDelete}
	<Dialog
		open
		title="Confirmar eliminación"
		description="Esta acción no se puede deshacer."
		class="max-w-md"
		onClose={closeDeleteDialog}
	>
		<div class="space-y-3">
			<p class="text-sm leading-relaxed text-[#707070]">
				¿Seguro que deseas eliminar el producto <strong class="text-[#171717]"
					>{capitalize(productToDelete.title)}</strong
				>? El registro desaparecerá del catálogo.
			</p>

			<form
				id="delete-product-form"
				action="?/deleteProduct"
				method="POST"
				use:enhance={() => {
					deleteLoading = true;
					return async ({ result, update }) => {
						deleteLoading = false;
						if (result.type === 'success') {
							closeDeleteDialog();
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="id" value={productToDelete.id} />
			</form>
		</div>

		{#snippet footer()}
			<Button type="button" variant="outline" disabled={deleteLoading} onclick={closeDeleteDialog}
				>Cancelar</Button
			>
			<Button
				type="submit"
				form="delete-product-form"
				variant="destructive"
				disabled={deleteLoading}
			>
				{#if deleteLoading}
					Eliminando...
				{:else}
					Eliminar
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}

{#if singleDuplicateModalOpen && productToDuplicateForModels}
	<Dialog
		open
		title="Duplicar producto"
		description="Selecciona los modelos para crear copias de este producto."
		class="max-w-xl"
		onClose={closeSingleDuplicateModal}
	>
		<div class="space-y-4">
			<div class="rounded-md border border-[#dfdfdf] bg-[#fafafa] p-4">
				<div class="text-sm">
					<p class="font-medium text-[#171717]">
						{capitalize(productToDuplicateForModels.title)}
					</p>
					<p class="text-xs text-[#707070]">
						Precio: {formatCurrency(Number(productToDuplicateForModels.price_without_taxes))} (con impuesto:
						{formatCurrency(Number(productToDuplicateForModels.price_without_taxes) * 1.18)})
					</p>
					{#if productToDuplicateForModels.description}
						<p class="mt-1 text-xs text-[#707070]">
							Descripción: {sentenceCase(productToDuplicateForModels.description)}
						</p>
					{/if}
				</div>
			</div>

			{#if availableModelsForSingleDuplicate.length > 0}
				{@const allModels = availableModelsForSingleDuplicate}
				{@const allSelected =
					selectedModelsForDuplicate.length === allModels.length && allModels.length > 0}
				<div class="mb-3">
					<input
						type="text"
						placeholder="Buscar modelo..."
						bind:value={singleDuplicateModelSearch}
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus:border-[#24b47e] focus:ring-2 focus:ring-[#3ecf8e]/35 focus:outline-none"
					/>
				</div>
				<div class="overflow-hidden rounded-md border border-[#dfdfdf]">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-10 px-4 py-3 font-bold">
									<input
										type="checkbox"
										checked={allSelected}
										onchange={toggleAllModelsForDuplicate}
										class="h-4 w-4 rounded border-[#dfdfdf] text-[#3ecf8e] focus:ring-[#3ecf8e]"
									/>
								</th>
								<th class="px-4 py-3 font-bold">Modelo</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#each allModels as model (model.id)}
								<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
									<td class="px-4 py-3">
										<input
											type="checkbox"
											checked={selectedModelsForDuplicate.includes(model.id)}
											onchange={() => toggleModelForDuplicate(model.id)}
											class="h-4 w-4 rounded border-[#dfdfdf] text-[#3ecf8e] focus:ring-[#3ecf8e]"
										/>
									</td>
									<td class="px-4 py-3">
										<div class="text-[#171717]">{capitalize(model.model)}</div>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="2" class="px-4 py-8 text-center text-xs text-[#707070]">
										No hay modelos disponibles.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="flex items-center justify-between text-sm text-[#707070]">
					<span
						>{selectedModelsForDuplicate.length} de {allModels.length} modelos seleccionados</span
					>
				</div>
			{:else}
				<p class="text-sm text-[#707070]">No hay modelos disponibles para duplicar.</p>
			{/if}

			{#if singleDuplicateError}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
				>
					<Tags class="mt-0.5 h-5 w-5 shrink-0" />
					<div>
						<p class="font-medium">No se pudo duplicar el producto</p>
						<p class="mt-0.5 text-xs text-[#707070]">{singleDuplicateError}</p>
					</div>
				</div>
			{/if}

			<form
				id="single-duplicate-form"
				action="?/duplicateProductForModels"
				method="POST"
				use:enhance={() => {
					singleDuplicateLoading = true;
					singleDuplicateError = '';
					return async ({ result, update }) => {
						singleDuplicateLoading = false;
						if (result.type === 'success') {
							closeSingleDuplicateModal();
						} else if (result.type === 'failure') {
							const data = result.data as { error?: string } | undefined;
							singleDuplicateError = data?.error || 'Ocurrió un error.';
						} else if (result.type === 'error') {
							singleDuplicateError = result.error?.message || 'Ocurrió un error.';
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="product_id" value={productToDuplicateForModels.id} />
				<input type="hidden" name="model_ids" value={JSON.stringify(selectedModelsForDuplicate)} />
			</form>
		</div>

		{#snippet footer()}
			<Button
				type="button"
				variant="outline"
				disabled={singleDuplicateLoading}
				onclick={closeSingleDuplicateModal}>Cancelar</Button
			>
			<Button
				type="submit"
				form="single-duplicate-form"
				disabled={singleDuplicateLoading || !canSingleDuplicate}
			>
				{#if singleDuplicateLoading}
					Creando...
				{:else}
					Crear {selectedModelsForDuplicate.length}
					producto{selectedModelsForDuplicate.length !== 1 ? 's' : ''}
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}
