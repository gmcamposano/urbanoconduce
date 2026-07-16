<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { ArrowLeft, Plus, Trash2, Save, Package, Tags } from '@lucide/svelte';

	let { data, form } = $props();

	const products = $derived(data.products || []);
	const colors = $derived(data.colors || []);
	const models = $derived(data.models || []);
	const clients = $derived(data.clients || []);
	const warehouses = $derived(data.warehouses || []);

	let loading = $state(false);
	let selectedClientId = $state('');
	const invoiceNumber = $derived(data.invoiceNumberPreview);
	let invoiceDate = $state(new Date().toISOString().split('T')[0]);
	let notes = $state('');
	let selectedWarehouse = $state('');
	let items = $state<Array<{ id: string; product_id: string; color: string; quantity: number }>>([
		{ id: crypto.randomUUID(), product_id: '', color: '', quantity: 1 }
	]);

	$effect(() => {
		if (warehouses.length && !selectedWarehouse) {
			const defaultWh = warehouses.find((w) => w.is_default);
			selectedWarehouse = defaultWh?.id || warehouses[0]?.id || '';
		}
	});

	const selectedClient = $derived(clients.find((c) => c.id === selectedClientId));

	function toTitleCase(str: string): string {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	function getClientName(client: (typeof clients)[number]): string {
		return client.client_type === 'company'
			? toTitleCase(client.company_name || client.alias || 'Empresa sin nombre')
			: toTitleCase(client.full_name || 'Cliente sin nombre');
	}

	function getModelName(modelId: string | null): string {
		if (!modelId) return '-';
		const found = models.find((m) => m.id === modelId);
		return found?.model ?? '-';
	}

	function getProductLabel(product: (typeof products)[number]): string {
		const modelName = getModelName(product.model);
		const formattedTitle = toTitleCase(product.title);
		return modelName === '-' ? formattedTitle : `${formattedTitle} - ${toTitleCase(modelName)}`;
	}

	const clientProducts = $derived.by(() => {
		if (!selectedClientId) return [];
		return products
			.filter((p) => p.client_id === selectedClientId)
			.sort((a, b) =>
				getProductLabel(a).localeCompare(getProductLabel(b), undefined, { sensitivity: 'base' })
			);
	});

	function addItem() {
		items = [...items, { id: crypto.randomUUID(), product_id: '', color: '', quantity: 1 }];
	}

	function removeItem(id: string) {
		if (items.length > 1) {
			items = items.filter((i) => i.id !== id);
		}
	}

	const isFormValid = $derived(
		selectedClientId && items.length > 0 && items.every((i) => i.product_id && i.quantity > 0)
	);
</script>

<svelte:head>
	<title>Nuevo despacho interno - magikalInvoice</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div>
		<a
			href={resolve('/dashboard/inventory')}
			class="inline-flex items-center gap-1.5 text-xs font-medium text-[#707070] transition-colors duration-200 hover:text-[#171717]"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Volver al inventario
		</a>
	</div>

	<div class="border-b border-[#ededed] pb-4">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Package class="h-6 w-6 text-[#3ecf8e]" />
			Nuevo despacho interno
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Documento sin valor comercial para suministrar mercancía a una tienda propia.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar el despacho</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	<form
		action="?/createDispatch"
		method="POST"
		class="space-y-6"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
	>
		<input type="hidden" name="invoice_number" value={invoiceNumber} />
		<input type="hidden" name="items" value={JSON.stringify(items)} />
		<input type="hidden" name="warehouse_id" value={selectedWarehouse} />

		<Card>
			<CardHeader>
				<CardTitle>1. Datos del despacho</CardTitle>
			</CardHeader>
			<CardContent class="grid grid-cols-1 gap-5 md:grid-cols-2">
				<Input
					label="Número de despacho"
					name="invoice_number_display"
					value={invoiceNumber}
					disabled
				/>

				<SearchableSelect
					label="Tienda / cliente destino"
					options={clients.map((c) => ({ value: c.id, label: getClientName(c) }))}
					bind:value={selectedClientId}
					placeholder="Selecciona un cliente"
					disabled={loading || clients.length === 0}
				/>
				<input type="hidden" name="client_id" value={selectedClientId} />
				<input
					type="hidden"
					name="client_name"
					value={selectedClient
						? selectedClient.client_type === 'company'
							? selectedClient.company_name || selectedClient.alias || ''
							: selectedClient.full_name || ''
						: ''}
				/>
				<input type="hidden" name="client_email" value={selectedClient?.email || ''} />

				<Input
					label="Fecha de despacho"
					name="invoice_date"
					type="date"
					bind:value={invoiceDate}
					required
					disabled={loading}
				/>

				<SearchableSelect
					label="Bodega de origen"
					options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
					bind:value={selectedWarehouse}
					placeholder="Selecciona una bodega"
					disabled={loading || warehouses.length === 0}
				/>

				<div class="flex w-full flex-col gap-1.5 md:col-span-2">
					<label
						for="notes"
						class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase">Notas</label
					>
					<textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows="3"
						placeholder="Observaciones del despacho"
						disabled={loading}
						class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
					></textarea>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>2. Productos despachados</CardTitle>
				<Button type="button" variant="outline" size="sm" onclick={addItem} disabled={loading}>
					<Plus class="h-3.5 w-3.5" />
					Añadir fila
				</Button>
			</CardHeader>
			<CardContent class="p-0">
				{#if !selectedClientId}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						Selecciona un cliente primero para ver sus productos.
					</div>
				{:else if !clientProducts.length}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						Este cliente no tiene productos.
					</div>
				{/if}
				<div class="w-full overflow-x-auto">
					<table class="w-full table-fixed text-left text-xs text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-2/5 px-3 py-2.5 font-semibold">Producto</th>
								<th class="w-1/4 px-3 py-2.5 font-semibold">Color</th>
								<th class="w-24 px-3 py-2.5 text-center font-semibold">Cant.</th>
								<th class="w-8 px-3 py-2.5"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#each items as item (item.id)}
								<tr class="hover:bg-[#fafafa]">
									<td class="px-3 py-2">
										<SearchableSelect
											options={clientProducts.map((p) => ({
												value: p.id,
												label: getProductLabel(p)
											}))}
											bind:value={item.product_id}
											placeholder={selectedClientId ? 'Selecciona' : '—'}
											disabled={loading || !selectedClientId || clientProducts.length === 0}
										/>
									</td>
									<td class="px-3 py-2">
										<Select
											label=""
											name="color"
											bind:value={item.color}
											disabled={loading || colors.length === 0}
											class="text-xs capitalize"
										>
											<option value="">Sin color</option>
											{#each colors as color (color.id)}
												<option value={color.color}>{color.color}</option>
											{/each}
										</Select>
									</td>
									<td class="px-3 py-2">
										<input
											type="number"
											required
											min="1"
											step="1"
											bind:value={item.quantity}
											disabled={loading}
											class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-center font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
										/>
									</td>
									<td class="px-3 py-2">
										<div class="flex h-9 items-center justify-end">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												class="h-9 w-9 text-[#707070] hover:text-[#e2005a]"
												disabled={items.length <= 1 || loading}
												onclick={() => removeItem(item.id)}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										</div>
									</td>
								</tr>
							{/each}
							<tr class="hover:bg-transparent">
								<td colspan="4" class="px-3 py-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="flex w-full items-center gap-1.5 text-xs text-[#707070] hover:text-[#3ecf8e]"
										onclick={addItem}
										disabled={loading}
									>
										<Plus class="h-3.5 w-3.5" />
										Añadir fila
									</Button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>

		<div class="flex justify-end gap-3 border-t border-[#ededed] pt-6">
			<a href={resolve('/dashboard/inventory')}>
				<Button variant="outline" disabled={loading}>Cancelar</Button>
			</a>
			<Button type="submit" disabled={loading || !isFormValid} class="flex items-center gap-1.5">
				{#if loading}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
					></div>
					Guardando...
				{:else}
					<Save class="h-4 w-4" />
					Crear despacho
				{/if}
			</Button>
		</div>
	</form>
</div>
