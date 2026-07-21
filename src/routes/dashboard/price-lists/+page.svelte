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
	import { Tags, Edit3, Trash2, Search, Plus, Maximize2 } from '@lucide/svelte';

	let { data, form } = $props();

	const canManage = $derived(data.profile?.role === 'admin' || data.profile?.role === 'editor');
	const isAdmin = $derived(data.profile?.role === 'admin');
	const priceLists = $derived(data.priceLists || []);
	const products = $derived(data.products || []);
	const models = $derived(data.models || []);
	const entries = $derived(data.entries || []);
	const clients = $derived(data.clients || []);

	let searchQuery = $state('');

	const filteredLists = $derived.by(() => {
		if (!searchQuery.trim()) return priceLists;
		const q = searchQuery.toLowerCase().trim();
		return priceLists.filter(
			(l) => l.name.toLowerCase().includes(q) || (l.description ?? '').toLowerCase().includes(q)
		);
	});

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val);
	}

	function capitalize(str: string): string {
		if (!str) return str;
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	function entriesForList(listId: string) {
		return entries.filter((e) => e.price_list_id === listId);
	}

	const assignments = $derived(data.assignments || []);

	function clientsForList(listId: string) {
		const today = new Date().toISOString().slice(0, 10);
		const clientIds = new Set(
			assignments
				.filter(
					(a) =>
						a.price_list_id === listId &&
						a.valid_from <= today &&
						(a.valid_to === null || a.valid_to >= today)
				)
				.map((a) => a.client_id)
		);
		return clients.filter((c) => clientIds.has(c.id));
	}

	function modelName(modelId: string | null): string {
		if (!modelId) return '—';
		return models.find((m) => m.id === modelId)?.model || '—';
	}

	function productById(productId: string) {
		return products.find((p) => p.id === productId);
	}

	// Create form state
	let newName = $state('');
	let newDescription = $state('');
	let applyPercentageChecked = $state(false);
	let applyPercentageValue = $state('');
	let createLoading = $state(false);

	const canCreate = $derived(
		newName.trim() !== '' &&
			(!applyPercentageChecked ||
				(applyPercentageValue !== '' &&
					Number(applyPercentageValue) >= 0 &&
					Number(applyPercentageValue) <= 100))
	);

	function resetCreateForm() {
		newName = '';
		newDescription = '';
		applyPercentageChecked = false;
		applyPercentageValue = '';
	}

	// Edit dialog state
	let editingList = $state<{
		id: string;
		name: string;
		description: string | null;
	} | null>(null);
	let editLoading = $state(false);
	let editName = $state('');
	let editDescription = $state('');
	let editSearch = $state('');
	let tableExpanded = $state(false);

	// Entry edit state (inline)
	let editingEntryPrices = $state<Record<string, string>>({});
	let entrySaveLoading = $state<Record<string, boolean>>({});

	function entryKey(productId: string): string {
		return `${editingList?.id ?? ''}::${productId}`;
	}

	function initEntryEdit(productId: string, currentPrice: number) {
		editingEntryPrices[entryKey(productId)] = String(currentPrice);
	}

	// Add product to list
	let addProductSelection = $state('');
	let addProductPrice = $state('');
	let addProductDiscount = $state('');
	let addProductMode = $state<'absolute' | 'percentage'>('absolute');
	let addProductLoading = $state(false);

	function availableProductsForAdd() {
		if (!editingList) return [];
		const existing = new Set(entriesForList(editingList.id).map((e) => e.product_id));
		const available = products.filter((p) => !existing.has(p.id));
		const search = editSearch.toLowerCase().trim();
		const filtered = search
			? available.filter(
					(p) =>
						p.title.toLowerCase().includes(search) ||
						modelName(p.model).toLowerCase().includes(search)
				)
			: available;
		return filtered.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
	}

	function canAddEntry(): boolean {
		if (addProductSelection.trim() === '') return false;
		if (addProductMode === 'absolute') {
			return addProductPrice !== '' && Number(addProductPrice) >= 0;
		}
		return (
			addProductDiscount !== '' &&
			Number(addProductDiscount) >= 0 &&
			Number(addProductDiscount) <= 100
		);
	}

	// Delete dialog
	let listToDelete = $state<{ id: string; name: string; assignedCount: number } | null>(null);
	let deleteLoading = $state(false);

	function openEditDialog(list: (typeof priceLists)[number]) {
		editingList = { ...list };
		editName = list.name;
		editDescription = list.description || '';
		editSearch = '';
		addProductSelection = '';
		addProductPrice = '';
		addProductDiscount = '';
		addProductMode = 'absolute';
		editingEntryPrices = {};
		entrySaveLoading = {};
		document.body.style.overflow = 'hidden';
	}

	function closeEditDialog() {
		editingList = null;
		editName = '';
		editDescription = '';
		editSearch = '';
		addProductSelection = '';
		addProductPrice = '';
		addProductDiscount = '';
		addProductMode = 'absolute';
		editingEntryPrices = {};
		entrySaveLoading = {};
		document.body.style.overflow = '';
	}

	function openDeleteDialog(list: (typeof priceLists)[number]) {
		listToDelete = {
			id: list.id,
			name: list.name,
			assignedCount: clientsForList(list.id).length
		};
		document.body.style.overflow = 'hidden';
	}

	function closeDeleteDialog() {
		listToDelete = null;
		deleteLoading = false;
		document.body.style.overflow = '';
	}

	function openTableModal() {
		tableExpanded = true;
		document.body.style.overflow = 'hidden';
	}

	function closeTableModal() {
		tableExpanded = false;
		document.body.style.overflow = '';
	}
</script>

<svelte:head>
	<title>Tarifas - magikalInvoice</title>
</svelte:head>

{#snippet formAlerts()}
	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar la tarifa</p>
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
				<p class="font-medium">{form.message || 'Tarifa guardada'}</p>
			</div>
		</div>
	{/if}
{/snippet}

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Tags class="h-6 w-6 text-[#3ecf8e]" />
			Tarifas
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Colecciones de precios asignables a varios clientes. Resuelve entre precio por cliente, tarifa
			asignada y precio de catálogo.
		</p>
	</div>

	{@render formAlerts()}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		{#if canManage}
			<Card class="xl:col-span-1">
				<CardHeader>
					<CardTitle>Nueva tarifa</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						action="?/createList"
						method="POST"
						class="space-y-4"
						use:enhance={() => {
							createLoading = true;
							return async ({ result, update }) => {
								createLoading = false;
								if (result.type === 'success') {
									resetCreateForm();
								}
								await update();
							};
						}}
					>
						<Input
							bind:value={newName}
							label="Nombre"
							name="name"
							placeholder="Mayorista, distribuidor, vip..."
							required
							disabled={createLoading}
						/>

						<div class="flex w-full flex-col gap-1.5">
							<label
								for="description"
								class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
								>Descripción</label
							>
							<textarea
								id="description"
								name="description"
								bind:value={newDescription}
								rows="3"
								placeholder="Detalle breve de la tarifa"
								disabled={createLoading}
								class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							></textarea>
						</div>

						<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-3">
							<label class="flex items-start gap-2.5 text-sm text-[#171717]">
								<input
									type="checkbox"
									bind:checked={applyPercentageChecked}
									disabled={createLoading}
									class="mt-0.5 h-4 w-4 rounded border-[#dfdfdf] text-[#3ecf8e] focus:ring-[#3ecf8e]"
								/>
								<span>
									<span class="font-medium">Aplicar descuento al catálogo</span>
									<span class="block text-[11px] text-[#707070]">
										Genera entradas absolutas para todos los productos con el porcentaje indicado.
									</span>
								</span>
							</label>
							{#if applyPercentageChecked}
								<div class="mt-3">
									<Input
										bind:value={applyPercentageValue}
										label="Descuento (%)"
										name="apply_percentage"
										type="number"
										min="0"
										max="100"
										step="any"
										placeholder="10"
										disabled={createLoading}
										prefix="%"
									/>
									{#if applyPercentageValue !== '' && Number(applyPercentageValue) >= 0}
										<p class="mt-1 text-[11px] text-[#707070]">
											Ej: producto a RD$1,000 → <span class="font-mono font-medium text-[#171717]"
												>{formatCurrency(1000 * (1 - Number(applyPercentageValue) / 100))}</span
											>
										</p>
									{/if}
								</div>
							{/if}
						</div>

						<Button type="submit" class="flex-1" disabled={createLoading || !canCreate}>
							Crear tarifa
						</Button>
					</form>
				</CardContent>
			</Card>
		{/if}

		<Card class="xl:col-span-2">
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>Tarifas existentes</CardTitle>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 text-[#707070] hover:text-[#171717]"
					title="Ampliar lista"
					onclick={openTableModal}
				>
					<Maximize2 class="h-4 w-4" />
				</Button>
			</CardHeader>
			<CardContent class="p-0">
				{@render listsTable()}
			</CardContent>
		</Card>
	</div>
</div>

{#snippet listsTable()}
	<div class="border-b border-[#ededed] bg-[#fafafa] px-6 py-3">
		<div class="flex items-center gap-3">
			<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Buscar por nombre o descripción..."
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
					<th class="px-6 py-4 font-bold uppercase">Nombre</th>
					<th class="px-6 py-4 font-bold uppercase">Descripción</th>
					<th class="px-6 py-4 text-right font-bold uppercase">Entradas</th>
					<th class="px-6 py-4 text-right font-bold uppercase">Clientes</th>
					{#if canManage}
						<th class="px-6 py-4 text-right font-bold uppercase">Acciones</th>
					{/if}
				</tr>
			</thead>
			<tbody class="divide-y divide-[#ededed]">
				{#if filteredLists.length === 0}
					<tr>
						<td colspan={canManage ? 5 : 4} class="px-6 py-12 text-center text-xs text-[#707070]"
							>Aún no hay tarifas registradas.</td
						>
					</tr>
				{:else}
					{#each filteredLists as list (list.id)}
						<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
							<td class="px-6 py-4 font-medium text-[#171717]">{capitalize(list.name)}</td>
							<td class="px-6 py-4 text-xs text-[#707070]"
								>{list.description ? capitalize(list.description) : '—'}</td
							>
							<td class="px-6 py-4 text-right font-mono text-xs text-[#707070]"
								>{entriesForList(list.id).length}</td
							>
							<td class="px-6 py-4 text-right font-mono text-xs text-[#707070]"
								>{clientsForList(list.id).length}</td
							>
							{#if canManage}
								<td class="px-6 py-4 text-right whitespace-nowrap">
									<div class="flex items-center justify-end gap-1.5">
										<Button
											variant="ghost"
											size="icon"
											class="h-8 w-8 text-[#707070] hover:text-[#171717]"
											title="Editar tarifa"
											onclick={() => openEditDialog(list)}
										>
											<Edit3 class="h-4 w-4" />
										</Button>
										{#if isAdmin}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
												title="Borrar tarifa"
												onclick={() => openDeleteDialog(list)}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
{/snippet}

{#if tableExpanded}
	<Dialog
		open
		title="Tarifas existentes"
		class="max-w-none"
		style="width: calc(95vw - 2rem); max-width: calc(95vw - 2rem); max-height: 95vh;"
		onClose={closeTableModal}
	>
		<div class="mb-4 space-y-3">
			{@render formAlerts()}
		</div>
		{@render listsTable()}
	</Dialog>
{/if}

{#if editingList}
	<Dialog
		open
		title="Editar tarifa"
		description="Actualiza los datos de la tarifa y gestiona sus entradas por producto."
		class="max-w-4xl"
		onClose={closeEditDialog}
	>
		<div class="space-y-5">
			<form
				id="edit-list-form"
				action="?/updateList"
				method="POST"
				class="grid grid-cols-1 gap-4 sm:grid-cols-2"
				use:enhance={() => {
					editLoading = true;
					return async ({ result, update }) => {
						editLoading = false;
						if (result.type === 'success') {
							editingList = editingList
								? { ...editingList, name: editName, description: editDescription || null }
								: null;
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="id" value={editingList.id} />
				<Input
					bind:value={editName}
					label="Nombre"
					name="name"
					placeholder="Mayorista"
					required
					disabled={editLoading}
				/>
				<div class="flex flex-col gap-1.5">
					<label
						for="edit-description"
						class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
						>Descripción</label
					>
					<textarea
						id="edit-description"
						name="description"
						bind:value={editDescription}
						rows="1"
						placeholder="Detalle breve"
						disabled={editLoading}
						class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					></textarea>
				</div>
			</form>

			<div class="rounded-lg border border-[#ededed] bg-[#fafafa] p-4">
				<p class="mb-1 text-xs font-medium tracking-wider text-[#707070] uppercase">
					Entradas de la tarifa
				</p>
				<p class="text-[11px] text-[#707070]">
					Cada entrada es un precio absoluto o un % de descuento sobre el catálogo. Los productos
					sin entrada caen al precio de catálogo.
				</p>
			</div>

			{#if canManage}
				<form
					action="?/upsertEntry"
					method="POST"
					use:enhance={() => {
						addProductLoading = true;
						return async ({ result, update }) => {
							addProductLoading = false;
							if (result.type === 'success') {
								addProductSelection = '';
								addProductPrice = '';
								addProductDiscount = '';
							}
							await update();
						};
					}}
					class="flex flex-wrap items-end gap-2"
				>
					<input type="hidden" name="price_list_id" value={editingList.id} />
					<input type="hidden" name="mode" value={addProductMode} />
					<div class="min-w-[200px] flex-1">
						<SearchableSelect
							options={availableProductsForAdd().map((p) => ({
								value: p.id,
								label: `${capitalize(p.title)} · ${modelName(p.model)}`
							}))}
							bind:value={addProductSelection}
							placeholder="Agregar producto..."
							disabled={addProductLoading}
						/>
					</div>
					<input type="hidden" name="product_id" value={addProductSelection} />
					<select
						bind:value={addProductMode}
						disabled={addProductLoading}
						class="h-9 rounded-md border border-[#dfdfdf] bg-white px-2 text-xs text-[#171717] focus-visible:border-[#24b47e] focus-visible:outline-none"
					>
						<option value="absolute">RD$</option>
						<option value="percentage">% off</option>
					</select>
					{#if addProductMode === 'absolute'}
						<div class="relative">
							<span
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 font-mono text-xs text-[#707070]"
								>RD$</span
							>
							<input
								type="number"
								name="unit_price"
								min="0"
								step="any"
								bind:value={addProductPrice}
								placeholder="Precio"
								disabled={addProductLoading}
								class="h-9 w-28 rounded-md border border-[#dfdfdf] bg-white py-1 pr-2 pl-9 text-right font-mono text-xs text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:opacity-50"
							/>
						</div>
					{:else}
						<div class="relative">
							<span
								class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 font-mono text-xs text-[#707070]"
								>%</span
							>
							<input
								type="number"
								name="discount_percentage"
								min="0"
								max="100"
								step="any"
								bind:value={addProductDiscount}
								placeholder="10"
								disabled={addProductLoading}
								class="h-9 w-20 rounded-md border border-[#dfdfdf] bg-white py-1 pr-2 pl-7 text-right font-mono text-xs text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:opacity-50"
							/>
						</div>
					{/if}
					<Button type="submit" size="sm" disabled={addProductLoading || !canAddEntry()}>
						<Plus class="h-4 w-4" />
						Agregar
					</Button>
				</form>
			{/if}

			<div class="overflow-hidden rounded-md border border-[#dfdfdf]">
				<table class="w-full text-left text-sm text-[#171717]">
					<thead
						class="border-b border-[#ededed] bg-[#fafafa] text-[10px] tracking-wider text-[#707070] uppercase"
					>
						<tr>
							<th class="px-4 py-2 pr-3 font-semibold">Producto</th>
							<th class="px-4 py-2 pr-3 text-right font-semibold">Catálogo</th>
							<th class="px-4 py-2 pr-3 text-right font-semibold">Precio de tarifa</th>
							<th class="px-4 py-2 pr-3 text-right font-semibold">Diferencia</th>
							{#if canManage}
								<th class="w-10 px-4 py-2 text-right font-semibold"></th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-[#ededed]">
						{#each entriesForList(editingList.id) as entry (entry.product_id)}
							{@const product = productById(entry.product_id)}
							{@const key = entryKey(entry.product_id)}
							{@const isPercentage = entry.discount_percentage !== null}
							{@const catalogPrice = product ? Number(product.price_without_taxes) : 0}
							{@const computedPrice = isPercentage
								? Math.round(catalogPrice * (1 - Number(entry.discount_percentage) / 100) * 100) /
									100
								: Number(entry.unit_price)}
							{@const currentEditVal = editingEntryPrices[key]}
							{@const displayPrice =
								currentEditVal !== undefined ? Number(currentEditVal) : computedPrice}
							{@const diff = displayPrice - catalogPrice}
							<tr>
								<td class="px-4 py-2.5 pr-3 text-sm text-[#171717]">
									<div class="flex flex-col">
										<span>{product ? capitalize(product.title) : 'Producto eliminado'}</span>
										<span class="text-[10px] text-[#707070]"
											>{modelName(product?.model ?? null)}</span
										>
									</div>
								</td>
								<td class="px-4 py-2.5 pr-3 text-right font-mono text-xs text-[#707070]"
									>{formatCurrency(catalogPrice)}</td
								>
								<td class="px-4 py-2.5 pr-3 text-right">
									{#if canManage && !isPercentage}
										<form
											action="?/upsertEntry"
											method="POST"
											use:enhance={() => {
												entrySaveLoading[key] = true;
												return async ({ result, update }) => {
													entrySaveLoading[key] = false;
													if (result.type === 'success') {
														delete editingEntryPrices[key];
													}
													await update();
												};
											}}
											class="relative inline-block"
										>
											<input type="hidden" name="price_list_id" value={editingList.id} />
											<input type="hidden" name="product_id" value={entry.product_id} />
											<input type="hidden" name="mode" value="absolute" />
											<span
												class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 font-mono text-xs text-[#707070]"
												>RD$</span
											>
											<input
												type="number"
												name="unit_price"
												min="0"
												step="any"
												value={currentEditVal ?? String(entry.unit_price)}
												onfocus={() => initEntryEdit(entry.product_id, Number(entry.unit_price))}
												onblur={(e) => {
													if (
														e.currentTarget.form &&
														Number(e.currentTarget.value) !== Number(entry.unit_price)
													) {
														e.currentTarget.form.requestSubmit();
													} else {
														delete editingEntryPrices[key];
													}
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault();
														e.currentTarget.blur();
													}
												}}
												disabled={entrySaveLoading[key]}
												class="h-8 w-28 rounded-md border border-[#dfdfdf] bg-white py-1 pr-2 pl-8 text-right font-mono text-xs text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:opacity-50"
											/>
										</form>
									{:else if isPercentage}
										<div class="flex flex-col items-end">
											<span class="font-mono text-sm text-[#171717]"
												>{formatCurrency(computedPrice)}</span
											>
											<span class="text-[10px] text-[#707070]"
												>{Number(entry.discount_percentage)}% off catálogo</span
											>
										</div>
									{:else}
										<span class="font-mono text-sm text-[#171717]"
											>{formatCurrency(Number(entry.unit_price))}</span
										>
									{/if}
								</td>
								<td
									class="px-4 py-2.5 pr-3 text-right font-mono text-xs {diff < 0
										? 'text-[#24b47e]'
										: diff > 0
											? 'text-[#e2005a]'
											: 'text-[#707070]'}"
								>
									{diff > 0 ? '+' : ''}{formatCurrency(diff)}
								</td>
								{#if canManage}
									<td class="px-4 py-2.5 text-right">
										<form
											action="?/deleteEntry"
											method="POST"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
												};
											}}
										>
											<input type="hidden" name="price_list_id" value={editingList.id} />
											<input type="hidden" name="product_id" value={entry.product_id} />
											<Button
												type="submit"
												variant="ghost"
												size="icon"
												class="h-7 w-7 text-[#707070] hover:text-[#e2005a]"
												title="Eliminar entrada"
											>
												<Trash2 class="h-3.5 w-3.5" />
											</Button>
										</form>
									</td>
								{/if}
							</tr>
						{:else}
							<tr>
								<td
									colspan={canManage ? 5 : 4}
									class="px-4 py-8 text-center text-xs text-[#707070]"
								>
									Esta tarifa no tiene entradas. Agrega productos arriba.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="flex items-center justify-between text-xs text-[#707070]">
				<span>{entriesForList(editingList.id).length} entrada(s)</span>
				<span>{clientsForList(editingList.id).length} cliente(s) asignado(s)</span>
			</div>
		</div>

		{#snippet footer()}
			<Button type="button" variant="outline" disabled={editLoading} onclick={closeEditDialog}
				>Cerrar</Button
			>
			<Button type="submit" form="edit-list-form" disabled={editLoading}>
				{#if editLoading}
					Guardando...
				{:else}
					Guardar cambios
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}

{#if listToDelete}
	<Dialog
		open
		title="Confirmar eliminación"
		description="Esta acción no se puede deshacer."
		class="max-w-md"
		onClose={closeDeleteDialog}
	>
		<div class="space-y-3">
			<p class="text-sm leading-relaxed text-[#707070]">
				¿Seguro que deseas eliminar la tarifa <strong class="text-[#171717]"
					>{capitalize(listToDelete.name)}</strong
				>? Todas sus entradas se borrarán.
			</p>
			{#if listToDelete.assignedCount > 0}
				<div
					class="rounded-md border border-[#e2005a]/20 bg-[#e2005a]/10 p-3 text-xs text-[#e2005a]"
				>
					Esta tarifa tiene {listToDelete.assignedCount} cliente(s) asignado(s). Reasigna o desasigna
					antes de borrar.
				</div>
			{/if}

			<form
				id="delete-list-form"
				action="?/deleteList"
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
				<input type="hidden" name="id" value={listToDelete.id} />
			</form>
		</div>

		{#snippet footer()}
			<Button type="button" variant="outline" disabled={deleteLoading} onclick={closeDeleteDialog}
				>Cancelar</Button
			>
			<Button
				type="submit"
				form="delete-list-form"
				variant="destructive"
				disabled={deleteLoading || (listToDelete?.assignedCount ?? 0) > 0}
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
