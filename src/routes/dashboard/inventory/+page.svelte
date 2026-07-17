<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		Warehouse,
		ArrowUp,
		ArrowDown,
		Search,
		AlertTriangle,
		Package,
		History,
		Plus,
		ArrowDownToLine
	} from '@lucide/svelte';

	let { data } = $props();

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
					i.color.toLowerCase().includes(query) ||
					(i.sku || '').toLowerCase().includes(query)
			);
		}
		return result;
	});

	const sortedItems = $derived.by(() => {
		const sorted = [...filteredItems];
		const dir = sortOrder === 'asc' ? 1 : -1;
		sorted.sort((a, b) => {
			switch (sortBy) {
				case 'product':
					return a.product_title.toLowerCase().localeCompare(b.product_title.toLowerCase()) * dir;
				case 'model':
					return getModelName(a.model_id).localeCompare(getModelName(b.model_id)) * dir;
				case 'stock':
					return (a.stock - b.stock) * dir;
				case 'color':
					return a.color.localeCompare(b.color) * dir;
				default:
					return 0;
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
					placeholder="Buscar producto, color o SKU..."
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
							<th class="px-6 py-4 font-bold uppercase">Modelo</th>
							<th class="px-6 py-4 font-bold uppercase">Color</th>
							<th class="px-6 py-4 font-bold uppercase">SKU</th>
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
									<td class="px-6 py-4 text-xs text-[#707070]">{getModelName(item.model_id)}</td>
									<td class="px-6 py-4 text-xs text-[#707070]"
										>{formatInventoryColor(item.color)}</td
									>
									<td class="px-6 py-4 text-xs text-[#707070]">{item.sku || '—'}</td>
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
