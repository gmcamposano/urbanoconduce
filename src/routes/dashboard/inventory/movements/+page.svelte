<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { History, Search } from '@lucide/svelte';

	let { data } = $props();

	const movements = $derived(data.movements || []);
	const models = $derived(data.models || []);

	let searchQuery = $state('');

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

	function movementLabel(type: string): string {
		const labels: Record<string, string> = {
			initial: 'Carga inicial',
			purchase: 'Compra',
			sale: 'Venta',
			internal_transfer: 'Despacho interno',
			return: 'Devolución',
			adjustment: 'Ajuste'
		};
		return labels[type] || type;
	}

	function movementBadgeVariant(type: string): 'success' | 'danger' | 'warning' | 'info' {
		switch (type) {
			case 'initial':
			case 'purchase':
			case 'return':
				return 'success';
			case 'sale':
			case 'internal_transfer':
				return 'danger';
			case 'adjustment':
				return 'warning';
			default:
				return 'info';
		}
	}

	const filteredMovements = $derived.by(() => {
		if (!searchQuery.trim()) return movements;
		const query = searchQuery.toLowerCase().trim();
		return movements.filter((m) => {
			const variant = m.product_variants as unknown as {
				color: string;
				products: {
					title: string;
					model: string | null;
				};
			};
			const product = variant?.products;
			return (
				(product?.title || '').toLowerCase().includes(query) ||
				(variant?.color || '').toLowerCase().includes(query) ||
				movementLabel(m.type).toLowerCase().includes(query)
			);
		});
	});

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('es-DO', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Historial de movimientos - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<History class="h-6 w-6 text-[#3ecf8e]" />
			Historial de movimientos
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">Entradas, salidas y ajustes de inventario.</p>
	</div>

	<div class="relative">
		<div class="flex items-center gap-3 rounded-md border border-[#dfdfdf] bg-white px-3 py-2">
			<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Buscar producto, color o tipo..."
				class="flex-1 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
			/>
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
							<th class="px-6 py-4 font-bold uppercase">Fecha</th>
							<th class="px-6 py-4 font-bold uppercase">Producto</th>
							<th class="px-6 py-4 font-bold uppercase">Modelo</th>
							<th class="px-6 py-4 font-bold uppercase">Color</th>
							<th class="px-6 py-4 font-bold uppercase">Tipo</th>
							<th class="px-6 py-4 text-right font-bold uppercase">Cantidad</th>
							<th class="px-6 py-4 font-bold uppercase">Notas</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[#ededed]">
						{#if filteredMovements.length === 0}
							<tr>
								<td colspan="7" class="px-6 py-12 text-center text-xs text-[#707070]">
									No hay movimientos registrados.
								</td>
							</tr>
						{:else}
							{#each filteredMovements as movement (movement.id)}
								{@const variant = movement.product_variants as unknown as {
									color: string;
									products: {
										title: string;
										model: string | null;
									};
								}}
								<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
									<td class="px-6 py-4 text-xs whitespace-nowrap text-[#707070]">
										{formatDate(movement.created_at)}
									</td>
									<td class="px-6 py-4 font-medium text-[#171717]">
										{capitalize(variant?.products?.title || '—')}
									</td>
									<td class="px-6 py-4 text-xs text-[#707070]">
										{getModelName(variant?.products?.model || null)}
									</td>
									<td class="px-6 py-4 text-xs text-[#707070]">
										{formatInventoryColor(variant?.color || '')}
									</td>
									<td class="px-6 py-4">
										<Badge variant={movementBadgeVariant(movement.type)}>
											{movementLabel(movement.type)}
										</Badge>
									</td>
									<td class="px-6 py-4 text-right font-mono">
										<span class={movement.quantity > 0 ? 'text-[#24b47e]' : 'text-[#e2005a]'}
											>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span
										>
									</td>
									<td class="px-6 py-4 text-xs text-[#707070]">{movement.notes || '—'}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>
</div>
