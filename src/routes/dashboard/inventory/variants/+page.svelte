<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { Tags, Plus, Trash2, SwatchBook } from '@lucide/svelte';

	let { data, form } = $props();

	const variants = $derived(data.variants || []);
	const products = $derived(data.products || []);
	const colors = $derived(data.colors || []);
	const models = $derived(data.models || []);

	let loading = $state(false);
	let selectedProduct = $state('');
	let selectedColor = $state('');
	let sku = $state('');
	let minStock = $state('0');
	let purchasePrice = $state('');
	let searchQuery = $state('');

	function getProductLabel(product: (typeof products)[number]): string {
		const client = product.clients as unknown as {
			client_type: string;
			full_name: string | null;
			company_name: string | null;
			alias: string | null;
		};
		const clientName =
			client?.client_type === 'company'
				? client?.company_name || client?.alias || 'Empresa'
				: client?.full_name || 'Persona';
		const modelName = models.find((m) => m.id === product.model)?.model || '';
		return `${clientName} — ${product.title}${modelName ? ` (${modelName})` : ''}`;
	}

	function formatInventoryColor(color: string): string {
		if (!color) return 'Sin color';
		return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
	}

	const filteredVariants = $derived.by(() => {
		if (!searchQuery.trim()) return variants;
		const query = searchQuery.toLowerCase().trim();
		return variants.filter((v) => {
			const product = products.find((p) => p.id === v.product_id);
			return (
				(product?.title || '').toLowerCase().includes(query) ||
				v.color.toLowerCase().includes(query) ||
				(v.sku || '').toLowerCase().includes(query)
			);
		});
	});

	const isFormValid = $derived(
		selectedProduct.trim() !== '' && !Number.isNaN(Number(minStock)) && Number(minStock) >= 0
	);
</script>

<svelte:head>
	<title>Variantes - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<SwatchBook class="h-6 w-6 text-[#3ecf8e]" />
			Variantes de productos
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Administra colores, SKU y stock mínimo por producto.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">Error</p>
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
				<p class="font-medium">{form.message}</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>Nueva variante</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action="?/createVariant"
					method="POST"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						return async ({ result, update }) => {
							loading = false;
							if (result.type === 'success') {
								selectedProduct = '';
								selectedColor = '';
								sku = '';
								minStock = '0';
								purchasePrice = '';
							}
							await update();
						};
					}}
				>
					<SearchableSelect
						label="Producto"
						options={products.map((p) => ({ value: p.id, label: getProductLabel(p) }))}
						bind:value={selectedProduct}
						placeholder="Selecciona un producto"
						disabled={loading || products.length === 0}
					/>
					<input type="hidden" name="product_id" value={selectedProduct} />

					<Select
						label="Color"
						name="color"
						bind:value={selectedColor}
						disabled={loading || colors.length === 0}
					>
						<option value="">Sin color</option>
						{#each colors as color (color.id)}
							<option value={color.color}>{color.color}</option>
						{/each}
					</Select>

					<Input
						bind:value={sku}
						label="SKU"
						name="sku"
						placeholder="Opcional"
						disabled={loading}
					/>

					<Input
						bind:value={minStock}
						label="Stock mínimo"
						name="min_stock"
						type="number"
						min="0"
						step="1"
						disabled={loading}
					/>

					<Input
						bind:value={purchasePrice}
						label="Costo de compra"
						name="purchase_price"
						type="number"
						min="0"
						step="any"
						placeholder="Opcional"
						disabled={loading}
					/>

					<Button type="submit" disabled={loading || !isFormValid} class="w-full">
						<Plus class="mr-1.5 h-4 w-4" />
						Crear variante
					</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Listado de variantes</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="border-b border-[#ededed] bg-[#fafafa] px-6 py-3">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Buscar producto, color o SKU..."
						class="w-full bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
					/>
				</div>
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-4 font-bold uppercase">Producto</th>
								<th class="px-6 py-4 font-bold uppercase">Color</th>
								<th class="px-6 py-4 font-bold uppercase">SKU</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Mínimo</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Costo</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if filteredVariants.length === 0}
								<tr>
									<td colspan="6" class="px-6 py-12 text-center text-xs text-[#707070]">
										No hay variantes registradas.
									</td>
								</tr>
							{:else}
								{#each filteredVariants as variant (variant.id)}
									{@const product = products.find((p) => p.id === variant.product_id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-medium text-[#171717]">
											{product ? getProductLabel(product) : '—'}
										</td>
										<td class="px-6 py-4 text-xs text-[#707070]"
											>{formatInventoryColor(variant.color)}</td
										>
										<td class="px-6 py-4 text-xs text-[#707070]">{variant.sku || '—'}</td>
										<td class="px-6 py-4 text-right font-mono text-[#707070]"
											>{variant.min_stock}</td
										>
										<td class="px-6 py-4 text-right font-mono text-[#707070]">
											{variant.purchase_price
												? new Intl.NumberFormat('es-DO', {
														style: 'currency',
														currency: 'DOP'
													}).format(variant.purchase_price)
												: '—'}
										</td>
										<td class="px-6 py-4 text-right">
											<form
												action="?/deleteVariant"
												method="POST"
												class="inline"
												use:enhance={() => {
													return async ({ update }) => await update();
												}}
											>
												<input type="hidden" name="id" value={variant.id} />
												<Button
													type="submit"
													variant="ghost"
													size="icon"
													class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
												>
													<Trash2 class="h-4 w-4" />
												</Button>
											</form>
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
</div>
