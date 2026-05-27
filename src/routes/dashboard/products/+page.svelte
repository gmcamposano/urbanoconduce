<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Package, Tags } from '@lucide/svelte';

	let { data, form } = $props();

	const products = $derived(data.products || []);

	let loading = $state(false);

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val);
	}
</script>

<svelte:head>
	<title>Productos - FacturaFlow</title>
</svelte:head>

<div class="space-y-6 flex-1 flex flex-col justify-start text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="text-2xl font-medium text-[#171717] tracking-tight flex items-center gap-2">
			<Package class="h-6 w-6 text-[#3ecf8e]" />
			Productos
		</h1>
		<p class="text-[#707070] text-xs mt-0.5">Crea tu catálogo de servicios o productos con su precio sin impuestos.</p>
	</div>

	{#if form?.error}
		<div class="bg-[#e2005a]/10 border border-[#e2005a]/20 p-4 rounded-xl text-sm text-[#e2005a] flex items-start gap-2.5 shadow-sm">
			<Tags class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<div>
				<p class="font-medium">No se pudo guardar el producto</p>
				<p class="text-xs text-[#707070] mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-[#3ecf8e]/12 border border-[#3ecf8e]/25 p-4 rounded-xl text-sm text-[#171717] flex items-start gap-2.5 shadow-sm">
			<Tags class="h-5 w-5 flex-shrink-0 mt-0.5 text-[#24b47e]" />
			<div>
				<p class="font-medium">Producto guardado</p>
				<p class="text-xs text-[#707070] mt-0.5">Ya está disponible para facturar.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
				>
					<Input label="Título" name="title" placeholder="Consultoría SEO" required disabled={loading} />

					<div class="flex flex-col gap-1.5 w-full">
						<label for="description" class="text-[11px] font-medium uppercase tracking-[0.12em] text-[#707070]">Descripción</label>
						<textarea
							id="description"
							name="description"
							rows="4"
							placeholder="Detalle breve del producto o servicio"
							disabled={loading}
							class="w-full bg-white border border-[#dfdfdf] rounded-[6px] p-3 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:border-[#24b47e] resize-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
						></textarea>
					</div>

					<Input label="Precio sin impuestos (RD$)" name="price_without_taxes" type="number" min="0" step="any" required disabled={loading} />

					<Button type="submit" class="w-full" disabled={loading}>Guardar producto</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Catálogo de productos</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="overflow-x-auto w-full">
					<table class="w-full text-sm text-left text-[#171717]">
						<thead class="text-xs uppercase bg-[#fafafa] text-[#707070] border-b border-[#ededed] tracking-wider">
							<tr>
								<th class="px-6 py-4 font-bold">Título</th>
								<th class="px-6 py-4 font-bold">Descripción</th>
								<th class="px-6 py-4 font-bold text-right">Precio</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if products.length === 0}
								<tr>
									<td colspan="3" class="px-6 py-12 text-center text-[#707070] text-xs">Aún no hay productos registrados.</td>
								</tr>
							{:else}
								{#each products as product (product.id)}
									<tr class="hover:bg-[#fafafa] transition-colors duration-150">
										<td class="px-6 py-4 font-medium text-[#171717]">{product.title}</td>
										<td class="px-6 py-4 text-xs text-[#707070]">{product.description || '—'}</td>
										<td class="px-6 py-4 text-right font-mono text-[#171717]">{formatCurrency(Number(product.price_without_taxes))}</td>
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
