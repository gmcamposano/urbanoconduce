<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Edit3, Package, Tags, Trash2 } from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const products = $derived(data.products || []);

	let loading = $state(false);
	let editingProduct = $state<{
		id: string;
		title: string;
		description: string | null;
		price_without_taxes: number;
	} | null>(null);
	let editLoading = $state(false);
	let editTitle = $state('');
	let editDescription = $state('');
	let editPriceWithoutTaxes = $state('');
	let productToDelete = $state<{ id: string; title: string } | null>(null);
	let deleteLoading = $state(false);
	let title = $state('');
	let description = $state('');
	let priceWithoutTaxes = $state('');

	function startEditing(product: (typeof products)[number]) {
		editingProduct = { ...product };
		editTitle = product.title;
		editDescription = product.description || '';
		editPriceWithoutTaxes = String(product.price_without_taxes ?? '');
	}

	function closeEditDialog() {
		editingProduct = null;
		editTitle = '';
		editDescription = '';
		editPriceWithoutTaxes = '';
		editLoading = false;
	}

	function openDeleteDialog(product: (typeof products)[number]) {
		productToDelete = {
			id: product.id,
			title: product.title
		};
	}

	function closeDeleteDialog() {
		productToDelete = null;
		deleteLoading = false;
	}

	function resetForm() {
		title = '';
		description = '';
		priceWithoutTaxes = '';
	}

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val);
	}
</script>

<svelte:head>
	<title>Productos - FacturaFlow</title>
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
			<Tags class="mt-0.5 h-5 w-5 flex-shrink-0" />
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
			<Tags class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#24b47e]" />
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
					<Input
						bind:value={title}
						label="Título"
						name="title"
						placeholder="Consultoría SEO"
						required
						disabled={loading}
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
							bind:value={description}
							rows="4"
							placeholder="Detalle breve del producto o servicio"
							disabled={loading}
							class="w-full resize-none rounded-[6px] border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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

					<div class="flex gap-3">
						<Button type="submit" class="flex-1" disabled={loading}>Guardar producto</Button>
					</div>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Catálogo de productos</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-4 font-bold">Título</th>
								<th class="px-6 py-4 font-bold">Descripción</th>
								<th class="px-6 py-4 text-right font-bold">Precio</th>
								{#if canManage}
									<th class="px-6 py-4 text-right font-bold">Acciones</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if products.length === 0}
								<tr>
									<td
										colspan={canManage ? 4 : 3}
										class="px-6 py-12 text-center text-xs text-[#707070]"
										>Aún no hay productos registrados.</td
									>
								</tr>
							{:else}
								{#each products as product (product.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-medium text-[#171717]">{product.title}</td>
										<td class="px-6 py-4 text-xs text-[#707070]">{product.description || '—'}</td>
										<td class="px-6 py-4 text-right font-mono text-[#171717]"
											>{formatCurrency(Number(product.price_without_taxes))}</td
										>
										{#if canManage}
											<td class="px-6 py-4 text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-1.5">
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

			<Input
				bind:value={editTitle}
				label="Título"
				name="title"
				placeholder="Consultoría SEO"
				required
				disabled={editLoading}
			/>

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
					class="w-full resize-none rounded-[6px] border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
					>{productToDelete.title}</strong
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
