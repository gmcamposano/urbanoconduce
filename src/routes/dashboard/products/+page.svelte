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
	import { Copy, Edit3, Package, Tags, Trash2, ArrowUp, ArrowDown, Search } from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const products = $derived(data.products || []);
	const models = $derived(data.models || []);
	const clients = $derived(data.clients || []);
	let selectedClientFilter = $state('');
	let searchQuery = $state('');

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

	const sortedProducts = $derived.by(() => {
		const sorted = [...filteredProducts];
		const dir = sortOrder === 'asc' ? 1 : -1;

		sorted.sort((a, b) => {
			switch (sortBy) {
				case 'client': {
					const clientNameA = getClientName(a.client_id).toLowerCase();
					const clientNameB = getClientName(b.client_id).toLowerCase();
					return clientNameA.localeCompare(clientNameB) * dir;
				}
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

	const filteredProducts = $derived.by(() => {
		let result = selectedClientFilter
			? products.filter((p) => p.client_id === selectedClientFilter)
			: products;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			result = result.filter((p) => {
				const modelName = models.find((m) => m.id === p.model)?.model?.toLowerCase() || '';
				return (
					p.title.toLowerCase().includes(query) ||
					modelName.includes(query) ||
					(p.description && p.description.toLowerCase().includes(query))
				);
			});
		}

		return result;
	});

	function getClientName(clientId: string | null): string {
		if (!clientId) return '—';
		const found = clients.find((c) => c.id === clientId);
		if (!found) return '—';
		const name =
			found.client_type === 'company'
				? found.company_name || found.alias || 'Empresa sin nombre'
				: found.full_name || 'Sin nombre';
		return capitalize(name);
	}

	let loading = $state(false);
	let editingProduct = $state<{
		id: string;
		client_id: string;
		title: string;
		description: string | null;
		price_without_taxes: number;
		model: string | null;
	} | null>(null);
	let editLoading = $state(false);
	let editClient = $state('');
	let editTitle = $state('');
	let editDescription = $state('');
	let editPriceWithoutTaxes = $state('');
	let editModel = $state('');
	let productToDelete = $state<{ id: string; title: string } | null>(null);
	let deleteLoading = $state(false);
	let duplicateModalOpen = $state(false);
	let selectedProductsForDuplicate = $state<string[]>([]);
	let sourceClientForDuplicate = $state('');
	let destinationClientForDuplicate = $state('');
	let duplicateLoading = $state(false);
	let duplicateError = $state('');
	let singleDuplicateModalOpen = $state(false);
	let productToDuplicateForModels = $state<{
		id: string;
		client_id: string;
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
		const clientId = productToDuplicateForModels.client_id;
		const productTitle = productToDuplicateForModels.title;
		const currentModelId = productToDuplicateForModels.model;
		const search = singleDuplicateModelSearch.toLowerCase().trim();
		const filtered = models.filter((m) => {
			if (m.id === currentModelId) return false;
			const alreadyExistsWithThisModel = products.some(
				(p) =>
					p.client_id === clientId &&
					p.title.toLowerCase() === productTitle.toLowerCase() &&
					p.model === m.id &&
					p.id !== productToDuplicateForModels?.id
			);
			return !alreadyExistsWithThisModel;
		});
		const sorted = filtered.sort((a, b) => a.model.toLowerCase().localeCompare(b.model.toLowerCase()));
		if (!search) return sorted;
		return sorted.filter((m) => m.model.toLowerCase().includes(search));
	});

	const canSingleDuplicate = $derived(
		selectedModelsForDuplicate.length > 0 && productToDuplicateForModels !== null
	);

	const productsFromSourceClient = $derived(
		sourceClientForDuplicate ? products.filter((p) => p.client_id === sourceClientForDuplicate) : []
	);

	const productsWithDuplicateStatus = $derived.by(() => {
		if (!sourceClientForDuplicate) return [];
		const sourceProducts = products.filter((p) => p.client_id === sourceClientForDuplicate);
		const sorted = sourceProducts.sort((a, b) =>
			a.title.toLowerCase().localeCompare(b.title.toLowerCase())
		);
		if (!destinationClientForDuplicate) return sorted;
		return sorted.filter(
			(p) =>
				!products.some(
					(existing) =>
						existing.client_id === destinationClientForDuplicate &&
						existing.title.toLowerCase() === p.title.toLowerCase()
				)
		);
	});

	const canDuplicate = $derived(
		selectedProductsForDuplicate.length > 0 &&
			sourceClientForDuplicate.trim() !== '' &&
			destinationClientForDuplicate.trim() !== '' &&
			sourceClientForDuplicate !== destinationClientForDuplicate
	);

	$effect(() => {
		if (sourceClientForDuplicate) {
			selectedProductsForDuplicate = [];
		}
	});

	function toggleProductForDuplicate(productId: string) {
		if (selectedProductsForDuplicate.includes(productId)) {
			selectedProductsForDuplicate = selectedProductsForDuplicate.filter((id) => id !== productId);
		} else {
			selectedProductsForDuplicate = [...selectedProductsForDuplicate, productId];
		}
	}

	function toggleAllProductsForDuplicate() {
		const allProducts = productsWithDuplicateStatus;
		if (selectedProductsForDuplicate.length === allProducts.length) {
			selectedProductsForDuplicate = [];
		} else {
			selectedProductsForDuplicate = allProducts.map((p) => p.id);
		}
	}
	let selectedClient = $state('');
	let title = $state('');
	let description = $state('');
	let priceWithoutTaxes = $state('');
	let selectedModel = $state('');

	const isProductFormValid = $derived(
		selectedClient.trim() !== '' &&
			title.trim() !== '' &&
			selectedModel.trim() !== '' &&
			priceWithoutTaxes !== '' &&
			Number(priceWithoutTaxes) >= 0
	);

	const availableModels = $derived(
		models.filter(
			(m) =>
				!products.some(
					(p) =>
						p.client_id === selectedClient &&
						p.title.toLowerCase() === title.toLowerCase() &&
						p.model === m.id
				)
		)
	);

	const availableModelsEdit = $derived(
		models.filter(
			(m) =>
				!products.some(
					(p) =>
						p.client_id === editClient &&
						p.title.toLowerCase() === editTitle.toLowerCase() &&
						p.model === m.id &&
						p.id !== editingProduct?.id
				)
		)
	);

	const priceWithTax = $derived(
		priceWithoutTaxes ? Number(priceWithoutTaxes) * 1.18 : 0
	);

	const editPriceWithTax = $derived(
		editPriceWithoutTaxes ? Number(editPriceWithoutTaxes) * 1.18 : 0
	);

	function startEditing(product: (typeof products)[number]) {
		editingProduct = { ...product };
		editClient = product.client_id || '';
		editTitle = product.title;
		editDescription = product.description || '';
		editPriceWithoutTaxes = String(product.price_without_taxes ?? '');
		editModel = product.model || '';
		document.body.style.overflow = 'hidden';
	}

	function closeEditDialog() {
		editingProduct = null;
		editClient = '';
		editTitle = '';
		editDescription = '';
		editPriceWithoutTaxes = '';
		editModel = '';
		editLoading = false;
		document.body.style.overflow = '';
	}

	function openDeleteDialog(product: (typeof products)[number]) {
		productToDelete = {
			id: product.id,
			title: product.title
		};
		document.body.style.overflow = 'hidden';
	}

	function closeDeleteDialog() {
		productToDelete = null;
		deleteLoading = false;
		document.body.style.overflow = '';
	}

	function openDuplicateModal() {
		selectedProductsForDuplicate = [];
		sourceClientForDuplicate = '';
		destinationClientForDuplicate = '';
		duplicateError = '';
		duplicateModalOpen = true;
		document.body.style.overflow = 'hidden';
	}

	function openSingleDuplicateModal(product: (typeof products)[number]) {
		productToDuplicateForModels = { ...product };
		selectedModelsForDuplicate = [];
		singleDuplicateError = '';
		singleDuplicateModalOpen = true;
		document.body.style.overflow = 'hidden';
	}

	function closeSingleDuplicateModal() {
		singleDuplicateModalOpen = false;
		productToDuplicateForModels = null;
		selectedModelsForDuplicate = [];
		singleDuplicateLoading = false;
		singleDuplicateError = '';
		singleDuplicateModelSearch = '';
		document.body.style.overflow = '';
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

	function closeDuplicateModal() {
		duplicateModalOpen = false;
		selectedProductsForDuplicate = [];
		sourceClientForDuplicate = '';
		destinationClientForDuplicate = '';
		duplicateLoading = false;
		duplicateError = '';
		document.body.style.overflow = '';
	}

	function resetForm() {
		selectedClient = '';
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
</script>

<svelte:head>
	<title>Productos - magikalInvoice</title>
</svelte:head>

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
					<SearchableSelect
						label="Cliente"
						options={clients.map((c) => ({ value: c.id, label: getClientName(c.id) }))}
						bind:value={selectedClient}
						placeholder="Selecciona un cliente"
						disabled={loading || !clients.length}
					/>

					<input type="hidden" name="client_id" value={selectedClient} />

					{#if !clients.length}
						<p class="-mt-2 text-[11px] text-[#707070]">
							No hay clientes registrados. Crea al menos uno en la sección Clientes.
						</p>
					{/if}

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
							Ya existe un producto con este nombre y modelo para este cliente.
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
							Precio con impuesto (18%): <span class="font-medium">{formatCurrency(priceWithTax)}</span>
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
				{#if canManage && filteredProducts.length > 0}
					<Button variant="outline" size="sm" onclick={openDuplicateModal}>
						<Copy class="mr-1.5 h-4 w-4" />
						Duplicar
					</Button>
				{/if}
			</CardHeader>
			<CardContent class="p-0">
				<div class="border-b border-[#ededed] bg-[#fafafa] px-6 py-3">
					<SearchableSelect
						label="Filtrar por cliente"
						options={clients.map((c) => ({ value: c.id, label: getClientName(c.id) }))}
						bind:value={selectedClientFilter}
						placeholder="Todos los clientes"
					/>
				</div>
				<div class="border-b border-[#ededed] bg-[#fafafa] px-6 py-3">
					<div class="flex items-center gap-3">
						<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Buscar por modelo, producto o descripción..."
							class="flex-1 bg-transparent text-sm text-[#171717] placeholder:text-[#707070] outline-none"
						/>
					</div>
				</div>
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-5 font-bold">
									<button
										type="button"
										class="flex items-center gap-1 uppercase hover:text-[#3ecf8e] transition-colors"
										onclick={() => toggleSort('created_at')}
									>
										Fecha
										{#if sortBy === 'created_at'}
											{#if sortOrder === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 font-bold">
									<button
										type="button"
										class="flex items-center gap-1 uppercase hover:text-[#3ecf8e] transition-colors"
										onclick={() => toggleSort('client')}
									>
										Cliente
										{#if sortBy === 'client'}
											{#if sortOrder === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 font-bold">
									<button
										type="button"
										class="flex items-center gap-1 uppercase hover:text-[#3ecf8e] transition-colors"
										onclick={() => toggleSort('title')}
									>
										Producto
										{#if sortBy === 'title'}
											{#if sortOrder === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 font-bold">
									<button
										type="button"
										class="flex items-center gap-1 uppercase hover:text-[#3ecf8e] transition-colors"
										onclick={() => toggleSort('model')}
									>
										Modelo
										{#if sortBy === 'model'}
											{#if sortOrder === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 font-bold uppercase">Descripción</th>
								<th class="px-6 py-4 text-right font-bold">
									<button
										type="button"
										class="ml-auto flex items-center gap-1 uppercase hover:text-[#3ecf8e] transition-colors"
										onclick={() => toggleSort('price')}
									>
										Precio
										{#if sortBy === 'price'}
											{#if sortOrder === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
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
									<td
										colspan={canManage ? 8 : 7}
										class="px-6 py-12 text-center text-xs text-[#707070]"
										>{selectedClientFilter
											? 'Este cliente no tiene productos.'
											: 'Aún no hay productos registrados.'}</td
									>
								</tr>
							{:else}
								{#each sortedProducts as product (product.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-5 text-right font-mono text-xs text-[#707070] whitespace-nowrap"
											>{new Date(product.created_at).toLocaleDateString('es-DO', {
												year: 'numeric',
												month: 'short',
												day: 'numeric'
											})}</td
										>
										<td class="px-6 py-4 text-xs text-[#707070]">
											{getClientName(product.client_id)}
										</td>
										<td class="px-6 py-4 font-medium text-[#171717]">{capitalize(product.title)}</td
										>
										<td class="px-6 py-4 text-xs text-[#707070] capitalize">
											{product.model
												? models.find((m) => m.id === product.model)?.model || '—'
												: '—'}
										</td>
										<td class="px-6 py-4 text-xs text-[#707070]"
											>{product.description ? sentenceCase(product.description) : '—'}</td
										>
										<td class="px-6 py-4 text-right font-mono text-[#171717]"
											>{formatCurrency(Number(product.price_without_taxes))}</td
										>
										<td class="px-6 py-4 text-right font-mono text-[#707070] text-xs"
											>{formatCurrency(Number(product.price_without_taxes) * 1.18)}</td
										>
										{#if canManage}
											<td class="px-6 py-4 text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-1.5">
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#171717]"
														title="Duplicar para otro modelo"
														onclick={() => openSingleDuplicateModal(product)}
													>
														<Copy class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#171717]"
														title="Editar producto"
														onclick={() => startEditing(product)}
													>
														<Edit3 class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
														title="Borrar producto"
														onclick={() => openDeleteDialog(product)}
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
</div>

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

			<SearchableSelect
				label="Cliente"
				options={clients.map((c) => ({ value: c.id, label: getClientName(c.id) }))}
				bind:value={editClient}
				placeholder="Selecciona un cliente"
				disabled={editLoading || !clients.length}
			/>

			<input type="hidden" name="client_id" value={editClient} />

			{#if !clients.length}
				<p class="-mt-2 text-[11px] text-[#707070]">
					No hay clientes. Crea al menos uno en la sección Clientes.
				</p>
			{/if}

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
					Ya existe un producto con este nombre y modelo para este cliente.
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
					Precio con impuesto (18%): <span class="font-medium">{formatCurrency(editPriceWithTax)}</span>
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

{#if duplicateModalOpen}
	<Dialog
		open
		title="Duplicar productos"
		description="Selecciona el cliente de origen, elige los productos y el cliente destino."
		class="max-w-2xl"
		onClose={closeDuplicateModal}
	>
		<div class="space-y-4">
			<SearchableSelect
				label="Cliente de origen"
				options={clients.map((c) => ({ value: c.id, label: getClientName(c.id) }))}
				bind:value={sourceClientForDuplicate}
				placeholder="Selecciona el cliente de origen"
				disabled={duplicateLoading || clients.length === 0}
			/>

			{#if clients.length === 0}
				<p class="-mt-2 text-[11px] text-[#707070]">No hay clientes disponibles.</p>
			{/if}

			{#if sourceClientForDuplicate}
				{@const productsWithStatus = productsWithDuplicateStatus}
				<div class="overflow-hidden rounded-md border border-[#dfdfdf]">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-10 px-4 py-3 font-bold">
									<input
										type="checkbox"
										checked={selectedProductsForDuplicate.length === productsWithStatus.length &&
											productsWithStatus.length > 0}
										onchange={toggleAllProductsForDuplicate}
										class="h-4 w-4 rounded border-[#dfdfdf] text-[#3ecf8e] focus:ring-[#3ecf8e]"
									/>
								</th>
								<th class="px-4 py-3 font-bold">Producto</th>
								<th class="px-4 py-3 font-bold">Modelo</th>
								<th class="px-4 py-3 text-right font-bold">Precio</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#each productsWithStatus as productWithStatus (productWithStatus.id)}
								<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
									<td class="px-4 py-3">
										<input
											type="checkbox"
											checked={selectedProductsForDuplicate.includes(productWithStatus.id)}
											onchange={() => toggleProductForDuplicate(productWithStatus.id)}
											class="h-4 w-4 rounded border-[#dfdfdf] text-[#3ecf8e] focus:ring-[#3ecf8e]"
										/>
									</td>
									<td class="px-4 py-3">
										<div class="font-medium text-[#171717]">
											{capitalize(productWithStatus.title)}
										</div>
									</td>
									<td class="px-4 py-3 text-xs text-[#707070] capitalize">
										{productWithStatus.model
											? models.find((m) => m.id === productWithStatus.model)?.model || '—'
											: '—'}
									</td>
									<td class="px-4 py-3 text-right font-mono text-[#171717]">
										{formatCurrency(Number(productWithStatus.price_without_taxes))}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="4" class="px-4 py-8 text-center text-xs text-[#707070]">
										Este cliente no tiene productos.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="flex items-center justify-between text-sm text-[#707070]">
					<span
						>{selectedProductsForDuplicate.length} de {productsWithStatus.length} productos seleccionados</span
					>
				</div>
			{/if}

			{#if selectedProductsForDuplicate.length > 0}
				<SearchableSelect
					label="Cliente destino"
					options={clients
						.filter((c) => c.id !== sourceClientForDuplicate)
						.map((c) => ({ value: c.id, label: getClientName(c.id) }))}
					bind:value={destinationClientForDuplicate}
					placeholder="Selecciona el cliente destino"
					disabled={duplicateLoading || clients.length === 0}
				/>

				{#if sourceClientForDuplicate && destinationClientForDuplicate && sourceClientForDuplicate === destinationClientForDuplicate}
					<p class="-mt-2 text-[11px] text-red-600">
						El cliente destino no puede ser el mismo que el de origen.
					</p>
				{/if}
			{/if}

			{#if duplicateError}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
				>
					<Tags class="mt-0.5 h-5 w-5 shrink-0" />
					<div>
						<p class="font-medium">No se pudo duplicar el producto</p>
						<p class="mt-0.5 text-xs text-[#707070]">{duplicateError}</p>
					</div>
				</div>
			{/if}

			<form
				id="duplicate-products-form"
				action="?/duplicateProducts"
				method="POST"
				use:enhance={() => {
					duplicateLoading = true;
					duplicateError = '';
					return async ({ result, update }) => {
						duplicateLoading = false;
						if (result.type === 'success') {
							closeDuplicateModal();
						} else if (result.type === 'failure') {
							const data = result.data as { error?: string } | undefined;
							duplicateError = data?.error || 'Ocurrió un error.';
						} else if (result.type === 'error') {
							duplicateError = result.error?.message || 'Ocurrió un error.';
						}
						await update();
					};
				}}
			>
				<input
					type="hidden"
					name="product_ids"
					value={JSON.stringify(selectedProductsForDuplicate)}
				/>
				<input type="hidden" name="destination_client_id" value={destinationClientForDuplicate} />
			</form>
		</div>

		{#snippet footer()}
			<Button
				type="button"
				variant="outline"
				disabled={duplicateLoading}
				onclick={closeDuplicateModal}>Cancelar</Button
			>
			<Button
				type="submit"
				form="duplicate-products-form"
				disabled={duplicateLoading || !canDuplicate}
			>
				{#if duplicateLoading}
					Duplicando...
				{:else}
					Duplicar {selectedProductsForDuplicate.length}
					producto{selectedProductsForDuplicate.length !== 1 ? 's' : ''}
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
						Cliente: {getClientName(productToDuplicateForModels.client_id)}
					</p>
					<p class="text-xs text-[#707070]">
						Precio: {formatCurrency(Number(productToDuplicateForModels.price_without_taxes))} (con impuesto: {formatCurrency(Number(productToDuplicateForModels.price_without_taxes) * 1.18)})
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
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus:border-[#24b47e] focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/35"
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
