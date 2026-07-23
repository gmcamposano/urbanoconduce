<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import {
		Plus,
		Trash2,
		ArrowLeft,
		Calculator,
		FileText,
		Save,
		DollarSign,
		AlertTriangle,
		Zap
	} from '@lucide/svelte';
	import QuickAddDialog from '$lib/components/QuickAddDialog.svelte';

	type ProductOption = {
		id: string;
		title: string;
		price_without_taxes: number | string;
		model: string | null;
		client_id?: string | null;
	};

	type ClientOption = {
		id: string;
		client_type: string;
		full_name: string | null;
		company_name: string | null;
		alias: string | null;
		email: string | null;
	};

	let { data, form } = $props();

	const products = $derived(data.products || []);
	const colors = $derived(data.colors || []);
	const models = $derived(data.models || []);

	function toTitleCase(str: string): string {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	function getModelName(modelId: string | null): string {
		if (!modelId) return '-';
		const found = models.find((m) => m.id === modelId);
		return found?.model ?? '-';
	}

	function getProductLabel(product: ProductOption): string {
		const modelName = getModelName(product.model);
		const formattedTitle = toTitleCase(product.title);
		return modelName === '-' ? formattedTitle : `${formattedTitle} - ${toTitleCase(modelName)}`;
	}

	function getClientName(client: ClientOption): string {
		return client.client_type === 'company'
			? toTitleCase(client.company_name || client.alias || 'Empresa sin nombre')
			: toTitleCase(client.full_name || 'Cliente sin nombre');
	}

	function getAvailableColors(itemId: string, productId: string): (typeof colors)[number][] {
		if (!productId) return colors;
		const currentColor = items.find((i) => i.id === itemId)?.color;
		const usedColorsByOthers = items
			.filter((i) => i.id !== itemId && i.product_id === productId && i.color)
			.map((i) => i.color);
		return colors.filter((c) => c.color === currentColor || !usedColorsByOthers.includes(c.color));
	}

	function getAvailableProducts(itemId: string): ProductOption[] {
		const currentProductId = items.find((i) => i.id === itemId)?.product_id;
		return clientProducts.filter((product) => {
			if (product.id === currentProductId) return true;
			const otherItemsWithProduct = items.filter(
				(i) => i.id !== itemId && i.product_id === product.id
			);
			if (otherItemsWithProduct.length === 0) return true;
			const hasColorSelected = otherItemsWithProduct.some((i) => i.color);
			if (!hasColorSelected) return false;
			const usedColors = otherItemsWithProduct.map((i) => i.color).filter(Boolean);
			const availableColorsForProduct = colors.filter((c) => !usedColors.includes(c.color));
			return availableColorsForProduct.length > 0;
		});
	}

	// Set up date defaults
	const formattedToday = new SvelteDate().toISOString().split('T')[0];
	const formattedDue = new SvelteDate(Date.now() + 30 * 24 * 60 * 60 * 1000)
		.toISOString()
		.split('T')[0];

	// Form field reactive states
	let invoiceNumber = $state('');
	let selectedClientId = $state('');

	const clientProducts = $derived.by((): ProductOption[] => {
		return [...products].sort((a, b) =>
			getProductLabel(a).localeCompare(getProductLabel(b), undefined, { sensitivity: 'base' })
		);
	});

	let invoiceDate = $state(formattedToday);
	let dueDate = $state(formattedDue);

	const clients = $derived((data.clients || []) as ClientOption[]);
	const clientPrices = $derived(data.clientPrices || []);

	const selectedClient = $derived(clients.find((c) => c.id === selectedClientId) || null);
	const clientEmail = $derived(selectedClient?.email || '');

	function handleClientChange() {
		const validProductIds = new Set(clientProducts.map((p) => p.id));
		items = items.map((item) => {
			if (item.product_id && !validProductIds.has(item.product_id)) {
				return { ...item, product_id: '', model: null, unit_price: 0 };
			}
			if (item.product_id) {
				const cp = clientPrices.find(
					(p) => p.client_id === selectedClientId && p.product_id === item.product_id
				);
				const product = clientProducts.find((p) => p.id === item.product_id);
				return {
					...item,
					unit_price: cp ? Number(cp.unit_price) : Number(product?.price_without_taxes || 0)
				};
			}
			return item;
		});
	}

	let notes = $state('');
	type TaxMode = 'none' | 'included' | 'added';
	let taxMode = $state<TaxMode>('none');
	let discountAmount = $state<number>(0);

	// Line items state
	function createItem() {
		return {
			id: crypto.randomUUID(),
			product_id: '',
			color: '',
			model: null as string | null,
			quantity: 1,
			unit_price: 0
		};
	}

	let items = $state<
		Array<{
			id: string;
			product_id: string;
			color: string;
			model: string | null;
			quantity: number;
			unit_price: number;
		}>
	>([createItem()]);

	let loading = $state(false);
	let createMissingVariants = $state(false);
	let quickAddOpen = $state(false);
	let missingVariantConfirm = $state<Array<{
		productId: string;
		productTitle: string;
		color: string;
	}> | null>(null);
	let createMissingDialogOpen = $state(false);
	let formElement = $state<HTMLFormElement | null>(null);

	const canAddItem = $derived(!!items[items.length - 1]?.product_id);

	const isFormValid = $derived(
		selectedClientId.trim() !== '' &&
			items.length > 0 &&
			items.every((item) => item.product_id && item.unit_price > 0)
	);

	function cleanupItems() {
		if (items.length > 1) {
			const filtered = items.filter((item, index) => index === items.length - 1 || item.product_id);
			if (filtered.length === 0) {
				items = [createItem()];
			} else if (filtered.length < items.length) {
				items = filtered;
			}
		}
	}

	function addItem() {
		items.push(createItem());
		cleanupItems();
	}

	function removeItem(id: string) {
		if (items.length > 1) {
			items = items.filter((item) => item.id !== id);
			cleanupItems();
		}
	}

	function handleQuickAdd(rows: Array<{ productId: string; color: string }>) {
		items = items.filter((i) => i.product_id);
		for (const row of rows) {
			const item = createItem();
			applyProductToItem(item, row.productId);
			item.color = row.color;
			items.push(item);
		}
		if (items.length === 0) items = [createItem()];
		quickAddOpen = false;
	}

	// Totals calculations (derived)
	const totalQuantity = $derived(
		items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
	);

	const lineTotal = $derived(
		items.reduce(
			(sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
			0
		)
	);

	const taxRate = 18;
	const subtotal = $derived.by(() => (taxMode === 'included' ? lineTotal / 1.18 : lineTotal));
	const taxAmount = $derived.by(() => {
		if (taxMode === 'none') return 0;
		if (taxMode === 'included') return lineTotal - subtotal;
		return subtotal * (taxRate / 100);
	});
	const totalAmount = $derived.by(() => {
		const discount = Number(discountAmount) || 0;
		if (taxMode === 'none') return Math.max(0, subtotal - discount);
		return Math.max(0, subtotal + taxAmount - discount);
	});

	// Helpers to add or remove line items

	function applyProductToItem(
		item: {
			id: string;
			product_id: string;
			model: string | null;
			unit_price: number;
			color: string;
		},
		productId: string
	) {
		item.product_id = productId;
		const product = clientProducts.find((entry) => entry.id === productId);
		const clientPrice = clientPrices.find(
			(cp) => cp.client_id === selectedClientId && cp.product_id === productId
		);
		item.unit_price = clientPrice
			? Number(clientPrice.unit_price)
			: Number(product?.price_without_taxes || 0);
		item.model = product?.model ?? null;
		if (item.color) {
			const availableColors = getAvailableColors(item.id, productId);
			const colorStillAvailable = availableColors.some((c) => c.color === item.color);
			if (!colorStillAvailable) item.color = '';
		}
	}

	// Formatter helper
	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>Nueva proforma - magikalInvoice</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<!-- Top back navigation link -->
	<div>
		<a
			href={resolve('/dashboard/proforma')}
			class="inline-flex items-center gap-1.5 text-xs font-medium text-[#707070] transition-colors duration-200 hover:text-[#171717]"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Volver al panel
		</a>
	</div>

	<!-- Header Title -->
	<div class="border-b border-[#ededed] pb-4">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<FileText class="h-6 w-6 text-[#3ecf8e]" />
			Crear nueva proforma
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Completa los datos del cliente, selecciona productos y ajusta impuestos para emitir la
			proforma.
		</p>
	</div>

	<!-- Error Banner -->
	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<svg
				class="mt-0.5 h-5 w-5 shrink-0 text-[#e2005a]"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<div>
				<p class="font-medium">No se pudo publicar la proforma</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Create Form -->
	<form
		bind:this={formElement}
		action="?/createInvoice"
		method="POST"
		use:enhance={({ formData }) => {
			loading = true;
			formData.set('create_missing_variants', createMissingVariants ? 'true' : 'false');
			return async ({ result, update }) => {
				if (result.type === 'failure' && result.data?.missingVariants) {
					missingVariantConfirm = result.data.missingVariants as Array<{
						productId: string;
						productTitle: string;
						color: string;
					}>;
					createMissingDialogOpen = true;
					loading = false;
					createMissingVariants = false;
					await update({ reset: false });
					return;
				}
				loading = false;
				createMissingVariants = false;
				await update({ reset: false });
			};
		}}
		class="space-y-6"
	>
		<!-- Serialize items array as a JSON string to submit through standard formData -->
		<input type="hidden" name="items" value={JSON.stringify(items)} />

		<Card>
			<CardHeader>
				<CardTitle>1. Datos principales de la proforma</CardTitle>
			</CardHeader>
			<CardContent class="grid grid-cols-1 gap-5 md:grid-cols-3">
				<Input
					label="ID / número de proforma"
					name="invoice_number"
					bind:value={invoiceNumber}
					placeholder={data.invoiceNumberPreview || 'INV-2026-0001'}
					disabled={loading}
				/>

				<input type="hidden" name="status" value="pending" />

				<Select
					label="Cliente"
					name="client_id"
					bind:value={selectedClientId}
					disabled={loading}
					required
					onchange={handleClientChange}
				>
					<option value="">Selecciona un cliente</option>
					{#each clients as client (client.id)}
						<option value={client.id}>
							{getClientName(client)}
						</option>
					{/each}
				</Select>

				<input
					type="hidden"
					name="client_name"
					value={selectedClient
						? selectedClient.client_type === 'company'
							? selectedClient.company_name || selectedClient.alias || ''
							: selectedClient.full_name || ''
						: ''}
				/>

				<Input
					label="Correo del cliente"
					name="client_email"
					type="email"
					value={clientEmail}
					placeholder="Se autocompleta al seleccionar cliente"
					readonly
					disabled={loading}
				/>

				<Input
					label="Fecha de emisión"
					name="invoice_date"
					type="date"
					bind:value={invoiceDate}
					required
					disabled={loading}
				/>

				<Input
					label="Fecha de vencimiento"
					name="due_date"
					type="date"
					bind:value={dueDate}
					required
					disabled={loading}
				/>
			</CardContent>
		</Card>

		<!-- Line Items Card -->
		<Card>
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>2. Conceptos de cobro</CardTitle>
				<div class="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="flex items-center gap-1"
						onclick={() => (quickAddOpen = true)}
						disabled={loading || !selectedClientId || !clientProducts.length}
					>
						<Zap class="h-3.5 w-3.5" />
						Añadir rápido
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="flex items-center gap-1"
						onclick={addItem}
						disabled={loading || !canAddItem}
					>
						<Plus class="h-3.5 w-3.5" />
						Añadir fila
					</Button>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				{#if !selectedClientId}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						Selecciona un cliente primero para ver sus productos.
					</div>
				{:else if !clientProducts.length}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						Este cliente no tiene productos. Crea al menos uno en la sección Productos.
					</div>
				{/if}
				{#if !colors.length}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						No hay colores disponibles. Crea al menos uno en la sección Colores.
					</div>
				{/if}
				<div class="w-full overflow-x-auto">
					<table class="w-full table-fixed text-left text-xs text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-1/4 px-3 py-2.5 font-semibold">Producto</th>
								<th class="w-1/4 px-3 py-2.5 font-semibold">Modelo</th>
								<th class="w-1/5 px-3 py-2.5 font-semibold">Color</th>
								<th class="w-24 px-3 py-2.5 text-center font-semibold">Cant.</th>
								<th class="w-32 px-3 py-2.5 text-right font-semibold"> Precio unit. </th>
								<th class="w-1/6 px-3 py-2.5 text-right font-semibold">Total</th>
								<th class="w-8 px-3 py-2.5"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#each items as item (item.id)}
								{@const availableProducts = getAvailableProducts(item.id) ?? []}
								{@const availableColors = getAvailableColors(item.id, item.product_id) ?? []}
								<tr class="hover:bg-[#fafafa]">
									<td class="px-3 py-2">
										<SearchableSelect
											options={availableProducts.map((p: ProductOption) => ({
												value: p.id,
												label: getProductLabel(p)
											}))}
											bind:value={item.product_id}
											placeholder={selectedClientId ? 'Selecciona' : 'Primero elige un cliente'}
											disabled={loading || !selectedClientId || availableProducts.length === 0}
											fuzzy
											onchange={(value) => applyProductToItem(item, value)}
										/>
									</td>
									<td class="px-3 py-2">
										<input
											type="text"
											readonly
											value={item.product_id ? getModelName(item.model) : '-'}
											class="h-9 w-full rounded-md border border-[#dfdfdf] bg-[#fafafa] px-3 py-2 text-xs text-[#707070] capitalize read-only:cursor-not-allowed"
										/>
									</td>
									<td class="px-3 py-2">
										<Select
											label=""
											name="color"
											bind:value={item.color}
											disabled={loading || availableColors.length === 0}
											class="text-xs capitalize"
										>
											<option value="">Color</option>
											{#if availableColors.length === 0}
												<option value="" disabled>No hay colores</option>
											{/if}
											{#each availableColors as color (color.id)}
												<option value={color.color}>{color.color}</option>
											{/each}
										</Select>
									</td>
									<td class="px-3 py-2">
										<input
											type="number"
											required
											min="1"
											step="any"
											bind:value={item.quantity}
											disabled={loading}
											class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-center font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
										/>
									</td>
									<td class="px-3 py-2">
										<div class="relative">
											<span
												class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-sm text-[#707070]"
												>RD$</span
											>
											<input
												type="number"
												required
												min="0"
												step="any"
												bind:value={item.unit_price}
												disabled={loading}
												class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-10 text-right font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
											/>
										</div>
									</td>
									<td class="px-3 py-2">
										<div class="flex h-9 items-center justify-end px-3">
											<span class="font-mono text-sm text-[#707070]">
												{formatCurrency(
													(Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
												)}
											</span>
										</div>
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
								<td colspan="7" class="px-3 py-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="flex w-full items-center gap-1.5 text-xs text-[#707070] hover:text-[#3ecf8e]"
										onclick={addItem}
										disabled={loading || !canAddItem}
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

		<!-- Bottom Calculation / Settings Grid -->
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
			<!-- Notes Card -->
			<Card>
				<CardHeader>
					<CardTitle>3. Términos y notas</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="flex flex-col gap-1.5">
						<label
							for="notes"
							class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
							>Términos / notas de la proforma</label
						>
						<textarea
							id="notes"
							name="notes"
							rows="4"
							bind:value={notes}
							placeholder="Gracias por su preferencia. El pago vence en 30 días mediante transferencia bancaria."
							disabled={loading}
							class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
						></textarea>
					</div>
				</CardContent>
			</Card>

			<!-- Summary Pricing Card -->
			<Card class="relative overflow-hidden">
				<div
					class="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-[#3ecf8e]/10 blur-[50px]"
				></div>
				<CardHeader>
					<CardTitle class="flex items-center gap-1.5">
						<Calculator class="h-4.5 w-4.5 text-[#24b47e]" />
						Resumen y totales
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-5">
					<!-- Tax & Discount inputs -->
					<div class="space-y-3 border-b border-[#ededed] pb-5">
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">Impuestos</p>
								<span
									class="rounded-full border border-[#ededed] bg-[#fafafa] px-2.5 py-1 text-[10px] font-medium tracking-wider text-[#707070] uppercase"
								>
									{taxMode === 'none'
										? 'Sin ITBIS'
										: taxMode === 'included'
											? 'Incluye impuestos'
											: 'Incluir ITBIS'}
								</span>
							</div>
							<div
								class="grid grid-cols-1 gap-2 rounded-lg border border-[#dfdfdf] bg-[#fafafa] p-1.5 sm:grid-cols-3"
							>
								<label class="cursor-pointer">
									<input
										type="radio"
										name="tax_mode"
										value="none"
										bind:group={taxMode}
										disabled={loading}
										class="peer sr-only"
									/>
									<div
										class="rounded-md border border-transparent px-3 py-2 text-center text-sm font-medium text-[#707070] transition-colors peer-checked:border-[#24b47e] peer-checked:bg-white peer-checked:text-[#171717] peer-checked:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
									>
										Sin ITBIS
									</div>
								</label>
								<label class="cursor-pointer">
									<input
										type="radio"
										name="tax_mode"
										value="included"
										bind:group={taxMode}
										disabled={loading}
										class="peer sr-only"
									/>
									<div
										class="rounded-md border border-transparent px-3 py-2 text-center text-sm font-medium text-[#707070] transition-colors peer-checked:border-[#24b47e] peer-checked:bg-white peer-checked:text-[#171717] peer-checked:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
									>
										Incluye impuestos
									</div>
								</label>
								<label class="cursor-pointer sm:col-start-3">
									<input
										type="radio"
										name="tax_mode"
										value="added"
										bind:group={taxMode}
										disabled={loading}
										class="peer sr-only"
									/>
									<div
										class="rounded-md border border-transparent px-3 py-2 text-center text-sm font-medium text-[#707070] transition-colors peer-checked:border-[#24b47e] peer-checked:bg-white peer-checked:text-[#171717] peer-checked:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
									>
										Incluir ITBIS
									</div>
								</label>
							</div>
							<p class="text-xs text-[#707070]">
								{taxMode === 'none'
									? 'Sin ITBIS, impuesto en 0.'
									: taxMode === 'included'
										? 'Incluye impuestos: subtotal neto desde precio con ITBIS.'
										: 'Incluir ITBIS: suma 18% al total final.'}
							</p>
						</div>

						<div class="flex justify-end">
							<div class="w-full max-w-sm">
								<Input
									label="Descuento ($)"
									name="discount_amount"
									type="number"
									min="0"
									step="any"
									bind:value={discountAmount}
									disabled={loading}
								/>
							</div>
						</div>
					</div>

					<!-- Pricing breakdown details -->
					<div class="rounded-xl border border-[#ededed] bg-[#fafafa] p-4">
						<div class="space-y-3 text-sm text-[#707070]">
							<div class="flex items-center justify-between">
								<span>Cantidad de artículos</span>
								<span class="font-mono font-medium text-[#171717]">{totalQuantity}</span>
							</div>
							<div class="flex items-center justify-between">
								<span>{taxMode === 'included' ? 'Subtotal neto' : 'Subtotal'}</span>
								<span class="font-mono font-medium text-[#171717]">{formatCurrency(subtotal)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span>Impuesto ({taxRate}%)</span>
								<span class="font-mono font-medium text-[#171717]">{formatCurrency(taxAmount)}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span>Descuento</span>
								<span class="font-mono font-medium text-[#171717]"
									>-{formatCurrency(discountAmount || 0)}</span
								>
							</div>
						</div>

						<div
							class="mt-4 flex items-center justify-between border-t border-[#dfdfdf] pt-4 text-base font-medium"
						>
							<span class="flex items-center gap-1 text-[#24b47e]">
								<DollarSign class="h-4.5 w-4.5" />
								Total a pagar
							</span>
							<span class="font-mono text-xl text-[#171717]">{formatCurrency(totalAmount)}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Submit Buttons -->
		<div class="flex justify-end gap-3 border-t border-[#ededed] pt-6">
			<a href={resolve('/dashboard/proforma')}>
				<Button variant="outline" disabled={loading}>Cancelar</Button>
			</a>

			<Button type="submit" disabled={loading || !isFormValid} class="flex items-center gap-1.5">
				{#if loading}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
					></div>
					Guardando proforma...
				{:else}
					<Save class="h-4 w-4" />
					Guardar proforma
				{/if}
			</Button>
		</div>
	</form>
</div>

{#if createMissingDialogOpen && missingVariantConfirm}
	<Dialog
		open
		title="Crear variantes faltantes"
		description="Algunos conceptos no tienen una variante de inventario. ¿Deseas crearlas ahora?"
		class="max-w-md"
		onClose={() => {
			createMissingDialogOpen = false;
			missingVariantConfirm = null;
			createMissingVariants = false;
		}}
	>
		<div class="space-y-3">
			<div class="flex items-start gap-2 text-sm text-[#e2005a]">
				<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
				<p>Las siguientes variantes se crearán con stock 0:</p>
			</div>
			<ul
				class="max-h-48 space-y-2 overflow-y-auto rounded-md border border-[#ededed] bg-[#fafafa] p-3"
			>
				{#each missingVariantConfirm as variant (variant.productId + ':' + (variant.color || 'none'))}
					<li class="text-sm text-[#171717]">
						<span class="font-medium">{toTitleCase(variant.productTitle)}</span>
						{#if variant.color}
							<span class="text-[#707070]">· {toTitleCase(variant.color)}</span>
						{:else}
							<span class="text-[#707070]">· Sin color</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		{#snippet footer()}
			<button
				type="button"
				class="rounded-md border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
				onclick={() => {
					createMissingDialogOpen = false;
					missingVariantConfirm = null;
					createMissingVariants = false;
				}}
			>
				Cancelar
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50"
				disabled={loading}
				onclick={() => {
					createMissingVariants = true;
					createMissingDialogOpen = false;
					formElement?.requestSubmit();
				}}
			>
				{#if loading}
					Creando...
				{:else}
					<Plus class="h-4 w-4" />
					Crear variantes y guardar
				{/if}
			</button>
		{/snippet}
	</Dialog>
{/if}

{#if quickAddOpen}
	<QuickAddDialog
		open
		products={clientProducts}
		{models}
		{colors}
		existingItems={items}
		onClose={() => (quickAddOpen = false)}
		onAdd={handleQuickAdd}
	/>
{/if}

{#if loading}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
		role="status"
		aria-live="polite"
	>
		<div
			class="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-[#dfdfdf] bg-white p-6 text-center shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
		>
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-[#171717]/20 border-t-[#3ecf8e]"
			></div>
			<p class="text-sm font-medium text-[#171717]">
				{#if createMissingVariants}
					Guardando variantes nuevas...
				{:else}
					Revisando si hay una variante nueva, esto puede tardar unos segundos...
				{/if}
			</p>
		</div>
	</div>
{/if}
