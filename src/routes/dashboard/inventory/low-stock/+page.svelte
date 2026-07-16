<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { AlertTriangle, Plus } from '@lucide/svelte';

	let { data } = $props();

	const items = $derived(data.items || []);
	const models = $derived(data.models || []);

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
</script>

<svelte:head>
	<title>Stock bajo - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<AlertTriangle class="h-6 w-6 text-[#e2005a]" />
			Stock bajo
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Variantes con stock igual o menor al mínimo configurado.
		</p>
	</div>

	<div class="flex justify-end">
		<a
			href={resolve('/dashboard/inventory/initial-stock')}
			class="inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] shadow-sm shadow-black/5 transition-colors hover:bg-[#24b47e] active:translate-y-px"
		>
			<Plus class="h-4 w-4" />
			Cargar mercancía
		</a>
	</div>

	<Card>
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
							<th class="px-6 py-4 text-right font-bold uppercase">Stock</th>
							<th class="px-6 py-4 text-right font-bold uppercase">Mínimo</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[#ededed]">
						{#if items.length === 0}
							<tr>
								<td colspan="6" class="px-6 py-12 text-center text-xs text-[#707070]">
									No hay variantes con stock bajo.
								</td>
							</tr>
						{:else}
							{#each items as item (item.variant_id)}
								<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
									<td class="px-6 py-4 font-medium text-[#171717]"
										>{capitalize(item.product_title)}</td
									>
									<td class="px-6 py-4 text-xs text-[#707070]">{item.client_name}</td>
									<td class="px-6 py-4 text-xs text-[#707070]">{getModelName(item.model_id)}</td>
									<td class="px-6 py-4 text-xs text-[#707070]"
										>{formatInventoryColor(item.color)}</td
									>
									<td class="px-6 py-4 text-right font-mono">
										<Badge variant={item.stock <= 0 ? 'danger' : 'warning'}>{item.stock}</Badge>
									</td>
									<td class="px-6 py-4 text-right font-mono text-[#707070]">{item.min_stock}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>
</div>
