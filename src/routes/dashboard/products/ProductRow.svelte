<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import { Tags, Copy, Edit3, Trash2 } from '@lucide/svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';

	type ClientPrice = { client_id: string; product_id: string; unit_price: number };
	type ClientOption = {
		id: string;
		client_type: string;
		full_name: string | null;
		company_name: string | null;
		alias: string | null;
	};
	type Product = {
		id: string;
		title: string;
		description: string | null;
		price_without_taxes: number;
		model: string | null;
		created_at: string;
	};
	type ModelOption = { id: string; model: string };

	let {
		product,
		models,
		clients,
		overrides,
		canManage,
		capitalize,
		sentenceCase,
		formatCurrency,
		openSingleDuplicateModal,
		startEditing,
		openDeleteDialog
	}: {
		product: Product;
		models: ModelOption[];
		clients: ClientOption[];
		overrides: ClientPrice[];
		canManage: boolean;
		capitalize: (s: string) => string;
		sentenceCase: (s: string) => string;
		formatCurrency: (n: number) => string;
		openSingleDuplicateModal: (p: Product) => void;
		startEditing: (p: Product) => void;
		openDeleteDialog: (p: Product) => void;
	} = $props();

	let showPricesModal = $state(false);

	function openPricesModal() {
		showPricesModal = true;
		document.body.style.overflow = 'hidden';
	}

	function closePricesModal() {
		showPricesModal = false;
		document.body.style.overflow = '';
	}

	const catalogPrice = $derived(Number(product.price_without_taxes));

	function getClientLabel(client: ClientOption): string {
		if (client.client_type === 'company') {
			return capitalize(client.company_name || client.alias || 'Empresa sin nombre');
		}
		return capitalize(client.full_name || 'Cliente sin nombre');
	}

	function getClientById(clientId: string): ClientOption | undefined {
		return clients.find((c) => c.id === clientId);
	}

	function availableClientsForAdd(): ClientOption[] {
		const existing = new Set(overrides.map((cp) => cp.client_id));
		return clients
			.filter((c) => !existing.has(c.id))
			.sort((a, b) => getClientLabel(a).localeCompare(getClientLabel(b)));
	}

	let addClientSelection = $state('');
	let addPriceInput = $state('');
	let addPriceLoading = $state(false);

	function canAddClientPrice(): boolean {
		return (
			addClientSelection.trim() !== '' &&
			addPriceInput !== '' &&
			Number(addPriceInput) >= 0
		);
	}

	let editingPrices = $state<Record<string, string>>({});
	let priceSaveLoading = $state<Record<string, boolean>>({});

	function priceEditKey(clientId: string): string {
		return `${product.id}::${clientId}`;
	}

	function initPriceEdit(clientId: string, currentPrice: number) {
		editingPrices[priceEditKey(clientId)] = String(currentPrice);
	}

	let priceToDelete = $state<{
		client_id: string;
		clientName: string;
		catalogPrice: number;
	} | null>(null);
	let deletePriceLoading = $state(false);

	function openDeletePriceDialog(clientId: string) {
		const client = getClientById(clientId);
		if (!client) return;
		priceToDelete = {
			client_id: clientId,
			clientName: getClientLabel(client),
			catalogPrice
		};
		document.body.style.overflow = 'hidden';
	}

	function closeDeletePriceDialog() {
		priceToDelete = null;
		deletePriceLoading = false;
		document.body.style.overflow = '';
	}
</script>

<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
	<td class="px-3 py-4 text-center">
		<button
			type="button"
			class="flex h-6 w-6 items-center justify-center rounded text-[#707070] transition-colors hover:bg-[#ededed] hover:text-[#171717]"
			onclick={openPricesModal}
			aria-label="Precios por cliente"
			title="Precios por cliente"
		>
			<Tags class="h-4 w-4" />
		</button>
	</td>
	<td class="px-6 py-5 text-right font-mono text-xs whitespace-nowrap text-[#707070]"
		>{new Date(product.created_at).toLocaleDateString('es-DO', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})}</td
	>
	<td class="px-6 py-4 font-medium text-[#171717]">{capitalize(product.title)}</td>
	<td class="px-6 py-4 text-xs text-[#707070] capitalize">
		{product.model ? models.find((m) => m.id === product.model)?.model || '—' : '—'}
	</td>
	<td class="px-6 py-4 text-xs text-[#707070]"
		>{product.description ? sentenceCase(product.description) : '—'}</td
	>
	<td class="px-6 py-4 text-right font-mono text-[#171717]">
		<div class="flex flex-col items-end gap-1">
			<span>{formatCurrency(catalogPrice)}</span>
			{#if overrides.length > 0}
				<span
					class="inline-flex items-center rounded-full bg-[#fafafa] px-2 py-0.5 text-[10px] font-medium text-[#707070]"
				>
					{overrides.length} precio{overrides.length !== 1 ? 's' : ''} por cliente
				</span>
			{/if}
		</div>
	</td>
	<td class="px-6 py-4 text-right font-mono text-xs text-[#707070]"
		>{formatCurrency(catalogPrice * 1.18)}</td
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
{#if showPricesModal}
	{@const addableClients = availableClientsForAdd()}
	<Dialog
		open
		title="Precios por cliente — {capitalize(product.title)}"
		description="Precio de catálogo: {formatCurrency(catalogPrice)}"
		class="max-w-3xl"
		onClose={closePricesModal}
	>
		{#if overrides.length > 0}
			<table class="w-full text-left text-sm text-[#171717]">
				<thead
					class="border-b border-[#ededed] text-[10px] tracking-wider text-[#707070] uppercase"
				>
					<tr>
						<th class="py-2 pr-3 font-semibold">Cliente</th>
						<th class="py-2 pr-3 text-right font-semibold">Precio por cliente</th>
						<th class="py-2 text-right font-semibold">Diferencia</th>
						{#if canManage}
							<th class="w-10 py-2 text-right font-semibold"></th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-[#ededed]">
					{#each overrides as cp (cp.client_id)}
						{@const client = getClientById(cp.client_id)}
						{@const editKey = priceEditKey(cp.client_id)}
						{@const currentEditVal = editingPrices[editKey]}
						{@const displayPrice =
								currentEditVal !== undefined ? Number(currentEditVal) : Number(cp.unit_price)}
						{@const diff = displayPrice - catalogPrice}
						<tr>
							<td class="py-2.5 pr-3 text-sm text-[#171717]">
								{client ? getClientLabel(client) : 'Cliente eliminado'}
							</td>
							<td class="py-2.5 pr-3 text-right">
								{#if canManage}
									<form
										action="?/upsertClientPrice"
										method="POST"
										use:enhance={() => {
											priceSaveLoading[editKey] = true;
											return async ({ result, update }) => {
												priceSaveLoading[editKey] = false;
												if (result.type === 'success') {
													delete editingPrices[editKey];
												}
												await update();
											};
										}}
										class="relative inline-block"
									>
										<input type="hidden" name="product_id" value={product.id} />
										<input type="hidden" name="client_id" value={cp.client_id} />
										<span
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 font-mono text-xs text-[#707070]"
											>RD$</span
										>
										<input
											type="number"
											name="unit_price"
											min="0"
											step="any"
											value={currentEditVal ?? String(cp.unit_price)}
											onfocus={() => initPriceEdit(cp.client_id, Number(cp.unit_price))}
											onblur={(e) => {
												if (
													e.currentTarget.form &&
													Number(e.currentTarget.value) !== Number(cp.unit_price)
												) {
													e.currentTarget.form.requestSubmit();
												} else {
													delete editingPrices[editKey];
												}
											}}
											onkeydown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													e.currentTarget.blur();
												}
											}}
											disabled={priceSaveLoading[editKey]}
											class="h-8 w-28 rounded-md border border-[#dfdfdf] bg-white py-1 pr-2 pl-8 text-right font-mono text-xs text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:opacity-50"
										/>
									</form>
								{:else}
									<span class="font-mono text-sm text-[#171717]"
										>{formatCurrency(Number(cp.unit_price))}</span
									>
								{/if}
							</td>
							<td
								class="py-2.5 pr-3 text-right font-mono text-xs {diff < 0
									? 'text-[#24b47e]'
									: diff > 0
										? 'text-[#e2005a]'
										: 'text-[#707070]'}"
							>
								{diff > 0 ? '+' : ''}{formatCurrency(diff)}
							</td>
							{#if canManage}
								<td class="py-2.5 text-right">
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 text-[#707070] hover:text-[#e2005a]"
										title="Eliminar precio por cliente"
										onclick={() => openDeletePriceDialog(cp.client_id)}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="text-xs text-[#707070]">
				Este producto no tiene precios por cliente. Todos los clientes pagan el precio de
				catálogo.
			</p>
		{/if}

		{#if canManage}
			{#if addableClients.length > 0}
				<form
					action="?/upsertClientPrice"
					method="POST"
					use:enhance={() => {
						addPriceLoading = true;
						return async ({ result, update }) => {
							addPriceLoading = false;
							if (result.type === 'success') {
								addClientSelection = '';
								addPriceInput = '';
							}
							await update();
						};
					}}
					class="mt-3 flex flex-wrap items-end gap-2 border-t border-[#ededed] pt-3"
				>
					<input type="hidden" name="product_id" value={product.id} />
					<input type="hidden" name="client_id" value={addClientSelection} />
					<div class="min-w-[180px] flex-1">
						<SearchableSelect
							options={addableClients.map((c) => ({
								value: c.id,
								label: getClientLabel(c)
							}))}
							bind:value={addClientSelection}
							placeholder="Agregar cliente..."
							disabled={addPriceLoading}
						/>
					</div>
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
							bind:value={addPriceInput}
							placeholder="Precio"
							disabled={addPriceLoading}
							class="h-9 w-28 rounded-md border border-[#dfdfdf] bg-white py-1 pr-2 pl-9 text-right font-mono text-xs text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:opacity-50"
						/>
					</div>
					<Button
						type="submit"
						size="sm"
						disabled={addPriceLoading || !canAddClientPrice()}>Agregar</Button
					>
				</form>
			{:else}
				<p class="mt-3 border-t border-[#ededed] pt-3 text-[11px] text-[#707070]">
					Todos los clientes ya tienen precio por cliente para este producto.
				</p>
			{/if}
		{/if}
	</Dialog>
{/if}

{#if priceToDelete}
	<Dialog
		open
		title="Eliminar precio por cliente"
		description="El cliente volverá al precio de catálogo al facturar."
		class="max-w-md"
		onClose={closeDeletePriceDialog}
	>
		<div class="space-y-3">
			<p class="text-sm leading-relaxed text-[#707070]">
				¿Seguro que deseas eliminar el precio por cliente de
				<strong class="text-[#171717]">{priceToDelete.clientName}</strong> para
				<strong class="text-[#171717]">{capitalize(product.title)}</strong>? Al facturar a este
				cliente se usará el precio de catálogo
				<strong class="font-mono text-[#171717]"
					>{formatCurrency(priceToDelete.catalogPrice)}</strong
				>.
			</p>

			<form
				id="delete-client-price-form-{product.id}"
				action="?/deleteClientPrice"
				method="POST"
				use:enhance={() => {
					deletePriceLoading = true;
					return async ({ result, update }) => {
						deletePriceLoading = false;
						if (result.type === 'success') {
							closeDeletePriceDialog();
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="product_id" value={product.id} />
				<input type="hidden" name="client_id" value={priceToDelete.client_id} />
			</form>
		</div>

		{#snippet footer()}
			<Button
				type="button"
				variant="outline"
				disabled={deletePriceLoading}
				onclick={closeDeletePriceDialog}>Cancelar</Button
			>
			<Button
				type="submit"
				form="delete-client-price-form-{product.id}"
				variant="destructive"
				disabled={deletePriceLoading}
			>
				{#if deletePriceLoading}
					Eliminando...
				{:else}
					Eliminar
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}
