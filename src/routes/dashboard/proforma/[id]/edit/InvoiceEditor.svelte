<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import { ArrowLeft, Calculator, DollarSign, FileText, Plus, Save, Trash2 } from '@lucide/svelte';
	import type { InvoiceEditorData } from '$lib/invoiceEditor';
	import type { ActionData } from './$types';

	type InvoiceFormItem = {
		id: string;
		product_id: string;
		color: string;
		model: string | null;
		quantity: number;
		unit_price: number;
	};

	type EditorState = {
		invoiceNumber: string;
		facturaTipo: string;
		ncf: string;
		selectedClientId: string;
		clientName: string;
		clientEmail: string;
		invoiceDate: string;
		dueDate: string;
		status: 'draft' | 'pending' | 'paid' | 'overdue';
		notes: string;
		includeTax: boolean;
		discountAmount: number;
		items: InvoiceFormItem[];
	};

	type TaxMode = 'none' | 'included' | 'added';

	type ProductOption = InvoiceEditorData['products'][number];
	type ClientOption = {
		id: string;
		client_type: string;
		full_name: string | null;
		company_name: string | null;
		alias: string | null;
		email: string | null;
	};

	let {
		invoice,
		products,
		colors,
		models,
		clients,
		clientPrices,
		initial,
		form: actionForm,
		isAdmin
	}: Pick<InvoiceEditorData, 'invoice' | 'products' | 'colors' | 'models'> & {
		clients: ClientOption[];
		clientPrices: { product_id: string; client_id: string; unit_price: number }[];
		initial: EditorState;
		form: ActionData;
		isAdmin?: boolean;
	} = $props();

	function createEditorState(source: EditorState): EditorState {
		return {
			...source,
			items: source.items.map((item) => ({ ...item }))
		};
	}

	let editor = $state<EditorState>({
		invoiceNumber: '',
		facturaTipo: 'proforma',
		ncf: '',
		selectedClientId: '',
		clientName: '',
		clientEmail: '',
		invoiceDate: '',
		dueDate: '',
		status: 'pending',
		notes: '',
		includeTax: false,
		discountAmount: 0,
		items: []
	});

	onMount(() => {
		editor = createEditorState(initial);
		taxMode = initial.includeTax ? 'added' : 'none';
	});

	function toTitleCase(str: string): string {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	const clientProducts = $derived.by((): ProductOption[] => {
		return [...products].sort((a, b) =>
			getProductLabel(a).localeCompare(getProductLabel(b), undefined, { sensitivity: 'base' })
		);
	});

	const selectedClient = $derived(clients.find((c) => c.id === editor.selectedClientId) || null);
	const clientEmail = $derived(selectedClient?.email || editor.clientEmail || '');

	const canAddItem = $derived(!!editor.items[editor.items.length - 1]?.product_id);

	const isFormValid = $derived(
		editor.selectedClientId.trim() !== '' &&
			editor.items.length > 0 &&
			editor.items.every((item) => item.product_id && item.unit_price > 0)
	);

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

	function getClientLabel(): string {
		if (!selectedClient) return '';

		return getClientName(selectedClient);
	}

	function getAvailableColors(itemId: string, productId: string): (typeof colors)[number][] {
		if (!productId) return colors;
		const currentColor = editor.items.find((i) => i.id === itemId)?.color;
		const usedColorsByOthers = editor.items
			.filter((i) => i.id !== itemId && i.product_id === productId && i.color)
			.map((i) => i.color);
		return colors.filter((c) => c.color === currentColor || !usedColorsByOthers.includes(c.color));
	}

	function getAvailableProducts(itemId: string): ProductOption[] {
		const currentProductId = editor.items.find((i) => i.id === itemId)?.product_id;
		return clientProducts.filter((product) => {
			if (product.id === currentProductId) return true;
			const otherItemsWithProduct = editor.items.filter(
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

	function createItem(): InvoiceFormItem {
		return {
			id: crypto.randomUUID(),
			product_id: '',
			color: '',
			model: null,
			quantity: 1,
			unit_price: 0
		};
	}

	function cleanupItems() {
		if (editor.items.length > 1) {
			const filtered = editor.items.filter(
				(item, index) => index === editor.items.length - 1 || item.product_id
			);
			if (filtered.length === 0) {
				editor.items = [createItem()];
			} else if (filtered.length < editor.items.length) {
				editor.items = filtered;
			}
		}
	}

	let loading = $state(false);
	let taxMode = $state<TaxMode>('none');

	const totalQuantity = $derived(
		editor.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
	);

	const lineTotal = $derived(
		editor.items.reduce(
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
		const discount = Number(editor.discountAmount) || 0;
		if (taxMode === 'none') return Math.max(0, subtotal - discount);
		return Math.max(0, subtotal + taxAmount - discount);
	});

	function addItem() {
		editor.items.push(createItem());
		cleanupItems();
	}

	function removeItem(id: string) {
		if (editor.items.length > 1) {
			editor.items = editor.items.filter((item) => item.id !== id);
			cleanupItems();
		}
	}

	function applyProductToItem(item: InvoiceFormItem, productId: string) {
		item.product_id = productId;
		const product = clientProducts.find((entry) => entry.id === productId);
		const clientPrice = clientPrices.find(
			(cp) => cp.client_id === editor.selectedClientId && cp.product_id === productId
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

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>Editar proforma - magikalInvoice</title>
</svelte:head>

{#if invoice}
	<div class="mx-auto flex max-w-4xl flex-1 flex-col justify-start space-y-6 text-[#171717]">
		<div>
			<a
				href={resolve(`/dashboard/proforma/${invoice.id}`)}
				class="inline-flex items-center gap-1.5 text-xs font-medium text-[#707070] transition-colors duration-200 hover:text-[#171717]"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				Volver a la proforma
			</a>
		</div>

		<div class="border-b border-[#ededed] pb-4">
			<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
				<FileText class="h-6 w-6 text-[#3ecf8e]" />
				Editar proforma
			</h1>
			<p class="mt-0.5 text-xs text-[#707070]">
				Completa los datos del cliente, selecciona productos y ajusta impuestos para guardar los
				cambios.
			</p>
		</div>

		{#if actionForm?.error}
			<div
				class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
			>
				<svg
					class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#e2005a]"
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
					<p class="font-medium">No se pudo guardar la proforma</p>
					<p class="mt-0.5 text-xs text-[#707070]">{actionForm.error}</p>
				</div>
			</div>
		{/if}

		<form
			action="?/updateInvoice"
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
			class="space-y-6"
		>
			<input type="hidden" name="items" value={JSON.stringify(editor.items)} />

			<Card>
				<CardHeader>
					<CardTitle>1. Datos principales de la proforma</CardTitle>
				</CardHeader>
				<CardContent class="grid grid-cols-1 gap-5 md:grid-cols-3">
					<Input
						label="ID / número de proforma"
						name="invoice_number"
						bind:value={editor.invoiceNumber}
						disabled={loading}
					/>

					{#if isAdmin}
						<Select
							label="Tipo de proforma"
							name="factura_tipo"
							bind:value={editor.facturaTipo}
							disabled={loading}
						>
							<option value="proforma">Proforma</option>
						</Select>

						{#if editor.facturaTipo === 'valor_fiscal'}
							<Input
								label="NCF"
								name="ncf"
								bind:value={editor.ncf}
								placeholder="Ej: A0101010101"
								disabled={loading}
							/>
						{/if}
					{/if}

					<input type="hidden" name="status" value={editor.status} />

					<input type="hidden" name="client_id" value={editor.selectedClientId} />

					<Input
						label="Cliente"
						value={getClientLabel()}
						readonly
						disabled={loading}
						class="bg-[#fafafa] text-[#707070]"
					/>

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
						bind:value={editor.invoiceDate}
						required
						disabled={loading}
					/>

					<Input
						label="Fecha de vencimiento"
						name="due_date"
						type="date"
						bind:value={editor.dueDate}
						required
						disabled={loading}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between">
					<CardTitle>2. Conceptos de cobro</CardTitle>
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
				</CardHeader>
				<CardContent class="p-0">
					{#if !editor.selectedClientId}
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
									<th class="w-32 px-3 py-2.5 text-right font-semibold">Precio unit.</th>
									<th class="w-1/6 px-3 py-2.5 text-right font-semibold">Total</th>
									<th class="w-8 px-3 py-2.5"></th>
								</tr>
							</thead>
							<tbody class="divide-y divide-[#ededed]">
								{#each editor.items as item (item.id)}
									{@const availableProducts = getAvailableProducts(item.id) ?? []}
									{@const availableColors = getAvailableColors(item.id, item.product_id) ?? []}
									<tr class="hover:bg-[#fafafa]">
										<td class="px-3 py-2">
											<SearchableSelect
												options={availableProducts.map((p) => ({
													value: p.id,
													label: getProductLabel(p)
												}))}
												bind:value={item.product_id}
												placeholder={editor.selectedClientId
													? 'Selecciona'
													: 'Primero elige un cliente'}
												disabled={loading ||
													!editor.selectedClientId ||
													availableProducts.length === 0}
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
													readonly
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
													disabled={editor.items.length <= 1 || loading}
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

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
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
								bind:value={editor.notes}
								placeholder="Gracias por su preferencia. El pago vence en 30 días mediante transferencia bancaria."
								disabled={loading}
								class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
							></textarea>
						</div>
					</CardContent>
				</Card>

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
						<div class="space-y-3 border-b border-[#ededed] pb-5">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">
										Impuestos
									</p>
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
										bind:value={editor.discountAmount}
										disabled={loading}
									/>
								</div>
							</div>
						</div>

						<div class="rounded-xl border border-[#ededed] bg-[#fafafa] p-4">
							<div class="space-y-3 text-sm text-[#707070]">
								<div class="flex items-center justify-between">
									<span>Cantidad de artículos</span>
									<span class="font-mono font-medium text-[#171717]">{totalQuantity}</span>
								</div>
								<div class="flex items-center justify-between">
									<span>{taxMode === 'included' ? 'Subtotal neto' : 'Subtotal'}</span>
									<span class="font-mono font-medium text-[#171717]"
										>{formatCurrency(subtotal)}</span
									>
								</div>
								<div class="flex items-center justify-between">
									<span>Impuesto ({taxRate}%)</span>
									<span class="font-mono font-medium text-[#171717]"
										>{formatCurrency(taxAmount)}</span
									>
								</div>
								<div class="flex items-center justify-between">
									<span>Descuento</span>
									<span class="font-mono font-medium text-[#171717]"
										>-{formatCurrency(editor.discountAmount || 0)}</span
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

			<div class="flex justify-end gap-3 border-t border-[#ededed] pt-6">
				<a href={resolve(`/dashboard/proforma/${invoice.id}`)}>
					<Button variant="outline" disabled={loading}>Cancelar</Button>
				</a>

				<Button type="submit" disabled={loading || !isFormValid} class="flex items-center gap-1.5">
					{#if loading}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
						></div>
						Guardando cambios...
					{:else}
						<Save class="h-4 w-4" />
						Guardar cambios
					{/if}
				</Button>
			</div>
		</form>
	</div>
{/if}
