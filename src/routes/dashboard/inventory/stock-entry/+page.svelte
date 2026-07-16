<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import { ArrowDownToLine, Search, Package, Tags } from '@lucide/svelte';

	let { data, form } = $props();

	const items = $derived(data.items || []);
	const models = $derived(data.models || []);
	const warehouses = $derived(data.warehouses || []);

	let searchQuery = $state('');
	let selectedWarehouse = $state('');
	let notes = $state('');
	let loading = $state(false);

	$effect(() => {
		if (warehouses.length && !selectedWarehouse) {
			const defaultWh = warehouses.find((w) => w.is_default);
			selectedWarehouse = defaultWh?.id || warehouses[0]?.id || '';
		}
	});

	function formatInventoryColor(color: string): string {
		if (!color) return 'Sin color';
		return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
	}

	function getModelName(modelId: string | null): string {
		if (!modelId) return '—';
		const model = models.find((m) => m.id === modelId);
		return model ? model.model.charAt(0).toUpperCase() + model.model.slice(1).toLowerCase() : '—';
	}

	function capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);
	}

	const filteredItems = $derived.by(() => {
		if (!searchQuery.trim()) return items;
		const query = searchQuery.toLowerCase().trim();
		return items.filter(
			(i) =>
				i.product_title.toLowerCase().includes(query) ||
				i.client_name.toLowerCase().includes(query) ||
				i.color.toLowerCase().includes(query) ||
				(i.sku || '').toLowerCase().includes(query)
		);
	});

	const hasAnyQuantity = $derived(filteredItems.length > 0);
</script>

<svelte:head>
	<title>Entrada de mercancía - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<ArrowDownToLine class="h-6 w-6 text-[#3ecf8e]" />
			Entrada de mercancía
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Registra mercancía recibida. Se registrará como movimiento de tipo "compra". El costo
			ingresado actualiza el precio de compra de la variante.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717] shadow-sm"
		>
			<Package class="mt-0.5 h-5 w-5 shrink-0 text-[#24b47e]" />
			<div>
				<p class="font-medium">{form.message}</p>
				<p class="mt-0.5 text-xs text-[#707070]">El inventario se actualizó correctamente.</p>
			</div>
		</div>
	{/if}

	<form
		action="?/recordStockEntry"
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
		<Card>
			<CardHeader>
				<CardTitle>Configuración</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<SearchableSelect
					label="Bodega"
					options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
					bind:value={selectedWarehouse}
					placeholder="Selecciona una bodega"
					disabled={warehouses.length === 0}
				/>
				<input type="hidden" name="warehouse_id" value={selectedWarehouse} />

				{#if warehouses.length === 0}
					<p class="text-xs text-[#707070]">No hay bodegas configuradas.</p>
				{/if}

				<div class="flex w-full flex-col gap-1.5">
					<label
						for="notes"
						class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
						>Notas generales</label
					>
					<textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows="2"
						placeholder="Ej. Factura compra #1234, proveedor X"
						disabled={loading}
						class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					></textarea>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>Variantes</CardTitle>
				<div class="flex items-center gap-3 rounded-md border border-[#dfdfdf] bg-white px-3 py-2">
					<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Buscar producto, cliente, color o SKU..."
						class="flex-1 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
					/>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-4 font-bold uppercase">Producto</th>
								<th class="px-6 py-4 font-bold uppercase">Cliente</th>
								<th class="px-6 py-4 font-bold uppercase">Modelo</th>
								<th class="px-6 py-4 font-bold uppercase">Color</th>
								<th class="px-6 py-4 font-bold uppercase">SKU</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Stock actual</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Costo actual</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Cantidad</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Nuevo costo (opcional)</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if filteredItems.length === 0}
								<tr>
									<td colspan="9" class="px-6 py-12 text-center text-xs text-[#707070]">
										No hay variantes disponibles.
									</td>
								</tr>
							{:else}
								{#each filteredItems as item (item.variant_id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-medium text-[#171717]"
											>{capitalize(item.product_title)}</td
										>
										<td class="px-6 py-4 text-xs text-[#707070]">{item.client_name}</td>
										<td class="px-6 py-4 text-xs text-[#707070]">{getModelName(item.model_id)}</td>
										<td class="px-6 py-4 text-xs text-[#707070]"
											>{formatInventoryColor(item.color)}</td
										>
										<td class="px-6 py-4 text-xs text-[#707070]">{item.sku || '—'}</td>
										<td class="px-6 py-4 text-right font-mono text-[#171717]">{item.stock}</td>
										<td class="px-6 py-4 text-right font-mono text-xs text-[#707070]"
											>{formatCurrency(item.purchase_price)}</td
										>
										<td class="px-6 py-4 text-right">
											<input
												type="number"
												name="quantity_{item.variant_id}"
												min="0"
												step="1"
												placeholder="0"
												disabled={loading}
												class="w-24 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-right text-sm text-[#171717] transition-colors placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</td>
										<td class="px-6 py-4 text-right">
											<input
												type="number"
												name="price_{item.variant_id}"
												min="0"
												step="0.01"
												placeholder="—"
												disabled={loading}
												class="w-28 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-right text-sm text-[#171717] transition-colors placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>

		<div class="flex justify-end">
			<Button type="submit" disabled={loading || !hasAnyQuantity}>
				{#if loading}
					Guardando...
				{:else}
					<ArrowDownToLine class="mr-1.5 h-4 w-4" />
					Registrar entrada
				{/if}
			</Button>
		</div>
	</form>
</div>
